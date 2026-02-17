const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);

// Detect Australian timezone from coordinates
function detectTimezoneFromCoords(lat, lng) {
  if (!lat || !lng) {
    console.warn('⚠️ No coordinates provided for timezone detection, using Sydney');
    return 'Australia/Sydney';
  }

  // Western Australia (Perth - no DST)
  if (lng >= 112.5 && lng < 129) return 'Australia/Perth';

  // Northern Territory (Darwin - no DST)
  if (lat > -26 && lng >= 129 && lng < 138) return 'Australia/Darwin';

  // South Australia (Adelaide - has DST)
  if (lat <= -26 && lng >= 129 && lng < 141) return 'Australia/Adelaide';

  // Queensland (Brisbane - no DST)
  if (lat > -29 && lng >= 138 && lng < 154) return 'Australia/Brisbane';

  // Victoria (Melbourne - has DST)
  if (lat <= -34 && lng >= 141 && lng < 150) return 'Australia/Melbourne';

  // Tasmania (Hobart - has DST)
  if (lat <= -40) return 'Australia/Hobart';

  // NSW/ACT (Sydney - has DST) - default for eastern Australia
  if (lng >= 141) return 'Australia/Sydney';

  console.warn('⚠️ Could not determine timezone, defaulting to Sydney');
  return 'Australia/Sydney';
}

// Check if date falls within Australian DST period
function isAustralianDST(date) {
  const year = date.getFullYear();

  // DST starts: First Sunday in October at 2:00 AM
  const octFirst = new Date(year, 9, 1); // October = month 9
  const octFirstDay = octFirst.getDay();
  const dstStart = new Date(year, 9, 1 + (octFirstDay === 0 ? 0 : 7 - octFirstDay), 2, 0, 0);

  // DST ends: First Sunday in April at 3:00 AM
  const aprFirst = new Date(year, 3, 1); // April = month 3
  const aprFirstDay = aprFirst.getDay();
  const dstEnd = new Date(year, 3, 1 + (aprFirstDay === 0 ? 0 : 7 - aprFirstDay), 3, 0, 0);

  // DST runs from October to April (crosses year boundary)
  return date >= dstStart || date < dstEnd;
}

// Helper: Normalize Australian phone numbers to international format
function normalizeAustralianPhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+61')) return cleaned;
  if (cleaned.startsWith('61')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+61' + cleaned.substring(1);
  return '+61' + cleaned;
}

// Helper: Send SMS to admin
async function sendAdminSMS(phoneNumber, message) {
  try {
    const normalizedPhone = normalizeAustralianPhone(phoneNumber);
    if (!normalizedPhone) {
      console.error('❌ Invalid admin phone number');
      return { success: false, error: 'Invalid phone number' };
    }

    const smsUrl = process.env.URL
      ? `${process.env.URL}/.netlify/functions/send-sms`
      : 'https://booking.rejuvenators.com/.netlify/functions/send-sms';

    const response = await fetch(smsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, message: message })
    });

    const contentType = response.headers.get('content-type');
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = { success: response.ok, message: text };
    }
    return result;
  } catch (error) {
    console.error('❌ Error sending admin SMS:', error);
    return { success: false, error: error.message };
  }
}

// Get timezone offset string for Australian timezone on specific date
function getTimezoneOffset(timezone, dateString) {
  // dateString: "2025-11-27T13:30:00"
  const date = new Date(dateString);

  const timezoneInfo = {
    'Australia/Brisbane': { offset: '+10:00', hasDST: false },
    'Australia/Sydney': { winterOffset: '+10:00', summerOffset: '+11:00', hasDST: true },
    'Australia/Melbourne': { winterOffset: '+10:00', summerOffset: '+11:00', hasDST: true },
    'Australia/Adelaide': { winterOffset: '+09:30', summerOffset: '+10:30', hasDST: true },
    'Australia/Perth': { offset: '+08:00', hasDST: false },
    'Australia/Darwin': { offset: '+09:30', hasDST: false },
    'Australia/Hobart': { winterOffset: '+10:00', summerOffset: '+11:00', hasDST: true }
  };

  const info = timezoneInfo[timezone];
  if (!info) {
    console.warn(`⚠️ Unknown timezone ${timezone}, defaulting to +10:00`);
    return '+10:00';
  }

  if (!info.hasDST) {
    return info.offset;
  }

  // Check if date is in DST period for zones that observe it
  const isDST = isAustralianDST(date);
  return isDST ? info.summerOffset : info.winterOffset;
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const bookingData = JSON.parse(event.body);

    console.log('📝 Creating booking:', bookingData.booking_id);

    // Detect and set booking timezone from coordinates
    if (bookingData.latitude && bookingData.longitude) {
      bookingData.booking_timezone = detectTimezoneFromCoords(
        parseFloat(bookingData.latitude),
        parseFloat(bookingData.longitude)
      );
      console.log(`🕐 Detected timezone: ${bookingData.booking_timezone} for coords (${bookingData.latitude}, ${bookingData.longitude})`);
    } else {
      bookingData.booking_timezone = 'Australia/Sydney';
      console.warn('⚠️ No coordinates in booking data, using default timezone: Australia/Sydney');
    }

    // Convert local booking time to UTC for proper storage
    // Form sends local time (e.g., "2025-12-29T10:00:00" in Brisbane)
    // We convert to UTC and store with timezone reference
    let originalLocalTime = null;
    if (bookingData.booking_time) {
      originalLocalTime = bookingData.booking_time; // Save for recurring bookings
      const timezone = bookingData.booking_timezone;

      // Get the timezone offset for this specific date/time
      const offset = getTimezoneOffset(timezone, originalLocalTime);
      const offsetMatch = offset.match(/([+-])(\d{2}):(\d{2})/);

      if (offsetMatch) {
        const sign = offsetMatch[1] === '+' ? 1 : -1;
        const offsetHours = parseInt(offsetMatch[2]);
        const offsetMinutes = parseInt(offsetMatch[3]);
        const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

        // Parse local time and convert to UTC
        // Local time is treated as if it's in UTC, then we subtract the offset
        const localAsUTC = new Date(originalLocalTime + 'Z'); // Parse as UTC
        const utcTime = new Date(localAsUTC.getTime() - totalOffsetMs);

        bookingData.booking_time = utcTime.toISOString();
        console.log(`🕐 Converted: ${originalLocalTime} (${timezone} ${offset}) → ${bookingData.booking_time} (UTC)`);
      }
    }

    // Validate no time-off for the therapist on the requested date/time
    async function validateNoTimeOff(therapistId, bookingDateTime, durationMinutes) {
      const dateOnly = bookingDateTime.split('T')[0];
      const { data: timeOffs } = await supabase
        .from('therapist_time_off')
        .select('id, start_time, end_time')
        .eq('therapist_id', therapistId)
        .eq('is_active', true)
        .lte('start_date', dateOnly)
        .gte('end_date', dateOnly);

      if (!timeOffs || timeOffs.length === 0) return true;

      for (const timeOff of timeOffs) {
        // All-day time-off (no start_time/end_time) blocks the entire day
        if (!timeOff.start_time && !timeOff.end_time) {
          console.log(`⛔ Therapist ${therapistId} has all-day time-off on ${dateOnly}`);
          return false;
        }

        // Partial time-off — check if booking overlaps with the time-off window
        if (timeOff.start_time && timeOff.end_time) {
          const bookingStart = new Date(bookingDateTime);
          const bookingEnd = new Date(bookingStart.getTime() + (durationMinutes || 60) * 60000);
          const offStart = new Date(`${dateOnly}T${timeOff.start_time}`);
          const offEnd = new Date(`${dateOnly}T${timeOff.end_time}`);

          if (bookingStart < offEnd && bookingEnd > offStart) {
            console.log(`⛔ Therapist ${therapistId} has partial time-off ${timeOff.start_time}-${timeOff.end_time} overlapping booking`);
            return false;
          }
        }
      }

      return true;
    }

    // Check if this is a recurring booking
    const isRecurring = bookingData.is_recurring === true;

    if (isRecurring) {
      console.log('🔄 Recurring booking detected - creating individual records for series');

      // Extract recurring-specific data
      const recurringDates = bookingData.recurring_dates || [];
      const initialBookingId = bookingData.booking_id; // e.g., RB2511001

      // Generate request_id with REQ prefix to distinguish from booking_id
      const requestId = initialBookingId.replace('RB', 'REQ'); // e.g., REQ2511001

      // Prepare base booking data (remove recurring-specific fields)
      const baseBookingData = { ...bookingData };
      delete baseBookingData.recurring_dates;
      delete baseBookingData.recurring_frequency;
      delete baseBookingData.recurring_count;

      // Array to hold all booking records to insert
      const bookingsToInsert = [];

      // 1. Create initial booking (occurrence_number = 0)
      const initialBooking = {
        ...baseBookingData,
        request_id: requestId, // REQ2511001
        occurrence_number: 0,
        // Initial booking keeps payment_status from payment (authorized/paid)
      };
      bookingsToInsert.push(initialBooking);

      // 2. Create repeat bookings (occurrence_number = 1, 2, 3...)
      for (let i = 0; i < recurringDates.length; i++) {
        const occurrenceDate = new Date(recurringDates[i]);
        const dateOnly = occurrenceDate.toISOString().split('T')[0];

        // Extract time from original local time (before UTC conversion)
        // We need to use the same local time for all occurrences
        const timeMatch = originalLocalTime.match(/T(\d{2}:\d{2}:\d{2})/);
        const timeOnly = timeMatch ? timeMatch[1] : '00:00:00';

        // Create local datetime for this occurrence
        const localDateTime = `${dateOnly}T${timeOnly}`;

        // Convert to UTC using same logic as initial booking
        const offset = getTimezoneOffset(baseBookingData.booking_timezone, localDateTime);
        const offsetMatch = offset.match(/([+-])(\d{2}):(\d{2})/);

        let dateTime = localDateTime;
        if (offsetMatch) {
          const sign = offsetMatch[1] === '+' ? 1 : -1;
          const offsetHours = parseInt(offsetMatch[2]);
          const offsetMinutes = parseInt(offsetMatch[3]);
          const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

          const localAsUTC = new Date(localDateTime + 'Z');
          const utcTime = new Date(localAsUTC.getTime() - totalOffsetMs);
          dateTime = utcTime.toISOString();
        }

        // Generate booking_id with hyphen suffix: RB2511001-1, RB2511001-2, etc.
        const repeatBookingId = `${initialBookingId}-${i + 1}`;

        const repeatBooking = {
          ...baseBookingData,
          booking_id: repeatBookingId, // RB2511001-1, RB2511001-2, etc.
          request_id: requestId, // Same for all: REQ2511001
          occurrence_number: i + 1,
          booking_time: dateTime, // Same local time as initial booking
          status: 'requested', // Repeats start as requested (therapist already accepted series via initial)
          payment_status: 'pending', // Repeats are not yet paid
          payment_intent_id: null, // Each occurrence gets its own payment intent (not created yet)
          // Don't apply discount/gift card to repeats
          discount_amount: 0,
          gift_card_amount: 0,
          discount_code: null,
          gift_card_code: null
        };

        bookingsToInsert.push(repeatBooking);
      }

      // Validate no time-off for the therapist on booking dates
      if (bookingData.therapist_id) {
        for (const bk of bookingsToInsert) {
          const isAvailable = await validateNoTimeOff(bookingData.therapist_id, bk.booking_time, bookingData.duration_minutes);
          if (!isAvailable) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Therapist has time-off on the requested date: ' + bk.booking_time.split('T')[0]
              })
            };
          }
        }
      }

      // Insert all bookings in one transaction
      const { data: allBookings, error: insertError } = await supabase
        .from('bookings')
        .insert(bookingsToInsert)
        .select();

      if (insertError) {
        console.error('❌ Error creating recurring bookings:', insertError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Error creating recurring bookings',
            details: insertError.message
          })
        };
      }

      console.log(`✅ Created ${allBookings.length} bookings in series (1 initial + ${recurringDates.length} repeats)`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          booking: allBookings[0], // Return initial booking as primary
          series: allBookings // Return all bookings in series
        })
      };

    } else {
      // Non-recurring booking - standard flow
      console.log('📝 Creating standard (non-recurring) booking');

      // Remove recurring-specific fields that don't exist in bookings table
      const cleanBookingData = { ...bookingData };
      delete cleanBookingData.recurring_dates;
      delete cleanBookingData.recurring_frequency;
      delete cleanBookingData.recurring_count;

      // Add request_id with REQ prefix (convert RB2511001 -> REQ2511001)
      if (bookingData.booking_id && bookingData.booking_id.startsWith('RB')) {
        cleanBookingData.request_id = bookingData.booking_id.replace('RB', 'REQ');
      } else {
        // For other booking types (quotes, etc.), use booking_id as-is
        cleanBookingData.request_id = bookingData.booking_id;
      }
      cleanBookingData.occurrence_number = null; // NULL for non-recurring bookings

      // Validate no time-off for the therapist on the requested date
      if (cleanBookingData.therapist_id && cleanBookingData.booking_time) {
        const isAvailable = await validateNoTimeOff(cleanBookingData.therapist_id, cleanBookingData.booking_time, cleanBookingData.duration_minutes);
        if (!isAvailable) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Therapist has time-off on the requested date'
            })
          };
        }
      }

      // Insert booking into database (service role bypasses RLS)
      const { data, error } = await supabase
        .from('bookings')
        .insert([cleanBookingData])
        .select();

      if (error) {
        console.error('❌ Error creating booking:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Error creating booking',
            details: error.message
          })
        };
      }

      console.log('✅ Booking created successfully:', data[0]?.booking_id);

      // Send SMS notification to admin for new booking request
      const adminMobile = process.env.SUPER_ADMIN_MOBILE_NO;
      if (adminMobile) {
        try {
          // Get therapist name
          let therapistName = 'Unassigned';
          if (bookingData.therapist_id) {
            const { data: therapist } = await supabase
              .from('therapist_profiles')
              .select('first_name, last_name')
              .eq('id', bookingData.therapist_id)
              .single();
            if (therapist) {
              therapistName = `${therapist.first_name} ${therapist.last_name}`;
            }
          }

          // Format date/time for SMS
          const bookingDate = new Date(data[0].booking_time);
          const dateStr = bookingDate.toLocaleDateString('en-AU', {
            weekday: 'short', day: 'numeric', month: 'short', timeZone: bookingData.booking_timezone || 'Australia/Sydney'
          });
          const timeStr = bookingDate.toLocaleTimeString('en-AU', {
            hour: '2-digit', minute: '2-digit', timeZone: bookingData.booking_timezone || 'Australia/Sydney'
          });

          const adminSMS = `📥 NEW BOOKING REQUEST\n\nID: ${data[0].booking_id}\nTherapist: ${therapistName}\nDate: ${dateStr} at ${timeStr}\nClient: ${bookingData.first_name} ${bookingData.last_name}\n\n- Rejuvenators`;

          await sendAdminSMS(adminMobile, adminSMS);
          console.log('📱 Admin SMS notification sent for new booking');
        } catch (smsError) {
          console.error('❌ Error sending admin SMS:', smsError);
          // Don't fail the booking if SMS fails
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          booking: data[0]
        })
      };
    }

  } catch (error) {
    console.error('❌ Error in create-booking:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

