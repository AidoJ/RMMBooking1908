const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get next sequential booking ID
async function getNextBookingId() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}${month}`;

  // Query for the last booking ID in the current month
  const { data: lastBooking, error } = await supabase
    .from('bookings')
    .select('booking_id')
    .ilike('booking_id', `RB${yearMonth}%`)
    .order('booking_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last booking ID:', error);
    return `RB${yearMonth}001`;
  }

  let nextNumber = 1;

  if (lastBooking && lastBooking.booking_id) {
    const match = lastBooking.booking_id.match(/RB\d{4}(\d{3,})$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `RB${yearMonth}${String(nextNumber).padStart(3, '0')}`;
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

    // Check if this is a recurring booking
    const isRecurring = bookingData.is_recurring === true;

    if (isRecurring) {
      console.log('🔄 Recurring booking detected - creating individual records for series');

      // Extract recurring-specific data
      const recurringDates = bookingData.recurring_dates || [];

      // Generate request_id with REQ prefix (not RB) to avoid confusion with booking_id
      const initialBookingId = bookingData.booking_id; // e.g., RB2511001
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
      // Each repeat gets its own sequential booking_id
      for (let i = 0; i < recurringDates.length; i++) {
        const occurrenceDate = new Date(recurringDates[i]);
        const dateOnly = occurrenceDate.toISOString().split('T')[0];
        const timeOnly = baseBookingData.booking_time.split('T')[1].substring(0, 5); // Extract HH:MM
        const dateTime = `${dateOnly}T${timeOnly}:00`;

        // Get next sequential booking_id (e.g., RB2511002, RB2511003, etc.)
        const repeatBookingId = await getNextBookingId();

        const repeatBooking = {
          ...baseBookingData,
          booking_id: repeatBookingId, // Sequential: RB2511002, RB2511003, etc.
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
      cleanBookingData.request_id = bookingData.booking_id.replace('RB', 'REQ');
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

