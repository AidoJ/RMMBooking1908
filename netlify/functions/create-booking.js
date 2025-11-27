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

    // Convert local booking time to UTC for storage
    // Form sends local time (e.g., "2025-12-29T10:00:00" in Brisbane)
    // We need to convert to UTC before storing in timestamptz column
    if (bookingData.booking_time) {
      const originalTime = bookingData.booking_time;

      // Parse as local time in the detected timezone and convert to UTC
      // Example: "2025-12-29T10:00:00" in Brisbane (UTC+10) → "2025-12-29T00:00:00Z" (UTC)
      const offset = getTimezoneOffset(bookingData.booking_timezone, originalTime);
      const offsetHours = parseInt(offset.split(':')[0]); // e.g., "+10:00" → 10

      // Parse the datetime
      const localDateTime = new Date(originalTime);

      // Subtract the offset to get UTC (Brisbane UTC+10 → subtract 10 hours)
      const utcDateTime = new Date(localDateTime.getTime() - (offsetHours * 60 * 60 * 1000));

      bookingData.booking_time = utcDateTime.toISOString();
      console.log(`🕐 Converted booking_time: ${originalTime} (${bookingData.booking_timezone}) → ${bookingData.booking_time} (UTC)`);
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

        // Extract time from initial booking (which is now in UTC)
        const timeMatch = baseBookingData.booking_time.match(/T(\d{2}:\d{2}:\d{2})/);
        const timeOnly = timeMatch ? timeMatch[1].substring(0, 5) : '00:00'; // Extract HH:MM

        // Create datetime in local timezone, then convert to UTC
        const localDateTime = `${dateOnly}T${timeOnly}:00`;
        const offset = getTimezoneOffset(baseBookingData.booking_timezone, localDateTime);
        const offsetHours = parseInt(offset.split(':')[0]);
        const dateTimeObj = new Date(localDateTime);
        const utcDateTimeObj = new Date(dateTimeObj.getTime() - (offsetHours * 60 * 60 * 1000));
        const dateTimeWithTZ = utcDateTimeObj.toISOString();

        // Generate booking_id with hyphen suffix: RB2511001-1, RB2511001-2, etc.
        const repeatBookingId = `${initialBookingId}-${i + 1}`;

        const repeatBooking = {
          ...baseBookingData,
          booking_id: repeatBookingId, // RB2511001-1, RB2511001-2, etc.
          request_id: requestId, // Same for all: REQ2511001
          occurrence_number: i + 1,
          booking_time: dateTimeWithTZ, // Use timezone-aware timestamp
          status: 'requested', // Repeats start as requested (therapist already accepted series via initial)
          payment_status: 'pending', // Repeats are not yet paid
          // Don't apply discount/gift card to repeats
          discount_amount: 0,
          gift_card_amount: 0,
          discount_code: null,
          gift_card_code: null
        };

        bookingsToInsert.push(repeatBooking);
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

