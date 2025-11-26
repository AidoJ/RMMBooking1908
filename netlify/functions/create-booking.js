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
        const timeOnly = baseBookingData.booking_time.split('T')[1].substring(0, 5); // Extract HH:MM
        const dateTime = `${dateOnly}T${timeOnly}:00`;

        // Generate booking_id with hyphen suffix: RB2511001-1, RB2511001-2, etc.
        const repeatBookingId = `${initialBookingId}-${i + 1}`;

        const repeatBooking = {
          ...baseBookingData,
          booking_id: repeatBookingId, // RB2511001-1, RB2511001-2, etc.
          request_id: requestId, // Same for all: REQ2511001
          occurrence_number: i + 1,
          booking_time: dateTime,
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

