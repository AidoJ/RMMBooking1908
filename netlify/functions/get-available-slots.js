/**
 * Get Available Slots Function
 *
 * Returns available time slots and therapists for a given date.
 * Used by the client reschedule page.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      booking_id
    } = event.queryStringParameters || {};

    if (!date || !service_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Date and service_id are required' })
      };
    }

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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ therapists: [], therapistAvailability: {} })
      };
    }

    // Fetch active therapists
    let therapistQuery = supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, gender, profile_pic, is_active')
      .in('id', therapistIds)
      .eq('is_active', true);

    // Filter by gender if specified
    if (genderPreference && genderPreference !== 'any') {
      therapistQuery = therapistQuery.eq('gender', genderPreference);
    }

    const { data: therapists } = await therapistQuery;

    if (!therapists || therapists.length === 0) {
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
        continue;
      }

      const { start_time, end_time } = availabilities[0];

      // Get existing bookings for this therapist on this date
      let bookingsQuery = supabase
        .from('bookings')
        .select('booking_time, duration_minutes')
        .eq('therapist_id', therapist.id)
        .gte('booking_time', date + 'T00:00:00')
        .lt('booking_time', date + 'T23:59:59')
        .not('status', 'in', '("cancelled","client_cancelled","declined")');

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
      }
    }

    // Filter therapists to only those with available slots
    const availableTherapists = therapists.filter(t => therapistAvailability[t.id]?.length > 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        therapists: availableTherapists,
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
