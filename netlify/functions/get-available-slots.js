/**
 * Get Available Slots Function
 *
 * Returns available time slots and therapists for a given date.
 * Filters therapists by service area using the booking's location.
 * Used by the client reschedule page.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Point-in-polygon check - EXACTLY like frontend/admin
function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Calculate distance between two coordinates in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if therapist covers the booking location
function therapistCoversLocation(therapist, bookingLat, bookingLng) {
  if (therapist.latitude == null || therapist.longitude == null) {
    console.log(`⚠️ Therapist ${therapist.id} missing location data`);
    return false;
  }

  // Check polygon first
  if (therapist.service_area_polygon && Array.isArray(therapist.service_area_polygon) && therapist.service_area_polygon.length >= 3) {
    const inPolygon = isPointInPolygon({ lat: bookingLat, lng: bookingLng }, therapist.service_area_polygon);
    console.log(`📍 Therapist ${therapist.id}: polygon check = ${inPolygon}`);
    if (inPolygon) return true;
  }

  // Fallback to radius
  if (therapist.service_radius_km != null) {
    const dist = getDistanceKm(bookingLat, bookingLng, therapist.latitude, therapist.longitude);
    console.log(`📍 Therapist ${therapist.id}: distance ${dist.toFixed(2)}km, radius ${therapist.service_radius_km}km`);
    return dist <= therapist.service_radius_km;
  }

  return false;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const {
      date,
      service_id,
      duration,
      gender,
      booking_id,
      latitude,
      longitude
    } = event.queryStringParameters || {};

    if (!date || !service_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Date and service_id are required' })
      };
    }

    // Parse coordinates
    const bookingLat = latitude ? parseFloat(latitude) : null;
    const bookingLng = longitude ? parseFloat(longitude) : null;

    if (!bookingLat || !bookingLng) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking latitude and longitude are required for therapist filtering' })
      };
    }

    console.log(`📍 Filtering therapists for location: ${bookingLat}, ${bookingLng}`);

    const durationMinutes = parseInt(duration) || 60;
    const genderPreference = gender || 'any';
    const dayOfWeek = new Date(date).getDay();

    // Fetch business settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value');

    let businessOpeningHour = 9;
    let businessClosingHour = 17;
    let beforeServiceBuffer = 15;
    let afterServiceBuffer = 15;

    if (settings) {
      for (const s of settings) {
        if (s.key === 'business_opening_time') businessOpeningHour = Number(s.value);
        if (s.key === 'business_closing_time') businessClosingHour = Number(s.value);
        if (s.key === 'before_service_buffer_time') beforeServiceBuffer = Number(s.value);
        if (s.key === 'after_service_buffer_time') afterServiceBuffer = Number(s.value);
      }
    }

    // Get therapists who provide this service
    const { data: therapistLinks } = await supabase
      .from('therapist_services')
      .select('therapist_id')
      .eq('service_id', service_id);

    const therapistIds = (therapistLinks || []).map(link => link.therapist_id);

    if (therapistIds.length === 0) {
      console.log('❌ No therapists found for this service');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ therapists: [], therapistAvailability: {} })
      };
    }

    // Fetch active therapists with location data
    const { data: allTherapists } = await supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, gender, profile_pic, is_active, latitude, longitude, service_radius_km, service_area_polygon')
      .in('id', therapistIds)
      .eq('is_active', true);

    if (!allTherapists || allTherapists.length === 0) {
      console.log('❌ No active therapists found');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ therapists: [], therapistAvailability: {} })
      };
    }

    console.log(`📊 Found ${allTherapists.length} therapists for service, checking coverage...`);

    // Filter therapists by service area coverage
    let therapists = allTherapists.filter(t => therapistCoversLocation(t, bookingLat, bookingLng));

    console.log(`📍 ${therapists.length} therapists cover the booking location`);

    // Filter by gender if specified
    if (genderPreference && genderPreference !== 'any') {
      therapists = therapists.filter(t => t.gender === genderPreference);
      console.log(`👤 ${therapists.length} therapists after gender filter (${genderPreference})`);
    }

    if (therapists.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ therapists: [], therapistAvailability: {} })
      };
    }

    // Get availability for each therapist on this day
    const therapistAvailability = {};

    for (const therapist of therapists) {
      // Get working hours for the day
      const { data: availabilities } = await supabase
        .from('therapist_availability')
        .select('start_time, end_time')
        .eq('therapist_id', therapist.id)
        .eq('day_of_week', dayOfWeek);

      if (!availabilities || availabilities.length === 0) {
        console.log(`⏰ Therapist ${therapist.id} has no availability on day ${dayOfWeek}`);
        continue;
      }

      // Check for time-off on this date
      const { data: timeOffs } = await supabase
        .from('therapist_time_off')
        .select('start_time, end_time')
        .eq('therapist_id', therapist.id)
        .eq('is_active', true)
        .lte('start_date', date)
        .gte('end_date', date);

      if (timeOffs && timeOffs.length > 0) {
        const allDayTimeOff = timeOffs.find(t => !t.start_time && !t.end_time);
        if (allDayTimeOff) {
          console.log(`⛔ Therapist ${therapist.id} has all-day time-off on ${date}`);
          continue;
        }
      }

      const { start_time, end_time } = availabilities[0];

      // Get existing bookings for this therapist on this date
      let bookingsQuery = supabase
        .from('bookings')
        .select('booking_time, duration_minutes')
        .eq('therapist_id', therapist.id)
        .gte('booking_time', date + 'T00:00:00')
        .lt('booking_time', date + 'T23:59:59')
        .in('status', ['requested', 'confirmed', 'timeout_reassigned', 'seeking_alternate', 'reschedule_requested']);

      // Exclude current booking if provided (for rescheduling)
      if (booking_id) {
        bookingsQuery = bookingsQuery.neq('id', booking_id);
      }

      const { data: existingBookings } = await bookingsQuery;

      // Build available time slots
      const slots = [];
      for (let hour = businessOpeningHour; hour <= businessClosingHour; hour++) {
        const slotStart = `${hour.toString().padStart(2, '0')}:00`;

        // Check if slot is within therapist's working hours
        if (slotStart < start_time || slotStart >= end_time) {
          continue;
        }

        // Check for overlap with existing bookings
        const slotStartDate = new Date(`${date}T${slotStart}`);
        const slotEndDate = new Date(slotStartDate.getTime() + durationMinutes * 60000 + afterServiceBuffer * 60000);
        let overlaps = false;

        for (const booking of existingBookings || []) {
          const bookingStart = new Date(booking.booking_time);
          const bookingDuration = booking.duration_minutes || 60;
          const bookingEnd = new Date(bookingStart.getTime() + bookingDuration * 60000 + afterServiceBuffer * 60000);
          const bookingStartWithBuffer = new Date(bookingStart.getTime() - beforeServiceBuffer * 60000);

          if (slotStartDate < bookingEnd && slotEndDate > bookingStartWithBuffer) {
            overlaps = true;
            break;
          }
        }

        // Check if slot overlaps with partial time-off
        if (!overlaps && timeOffs && timeOffs.length > 0) {
          for (const timeOff of timeOffs) {
            if (timeOff.start_time && timeOff.end_time) {
              const offStart = new Date(`${date}T${timeOff.start_time}`);
              const offEnd = new Date(`${date}T${timeOff.end_time}`);
              if (slotStartDate < offEnd && slotEndDate > offStart) {
                overlaps = true;
                break;
              }
            }
          }
        }

        // Check if slot is in the past (for today)
        const now = new Date();
        const minBookingTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
        if (slotStartDate < minBookingTime) {
          continue;
        }

        if (!overlaps) {
          slots.push(slotStart);
        }
      }

      if (slots.length > 0) {
        therapistAvailability[therapist.id] = slots;
        console.log(`✅ Therapist ${therapist.first_name} has ${slots.length} available slots`);
      }
    }

    // Filter therapists to only those with available slots
    const availableTherapists = therapists.filter(t => therapistAvailability[t.id]?.length > 0);

    console.log(`📊 Final result: ${availableTherapists.length} therapists with available slots`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        therapists: availableTherapists.map(t => ({
          id: t.id,
          first_name: t.first_name,
          last_name: t.last_name,
          gender: t.gender,
          profile_pic: t.profile_pic
        })),
        therapistAvailability
      })
    };

  } catch (error) {
    console.error('Get available slots error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get available slots', message: error.message })
    };
  }
};
