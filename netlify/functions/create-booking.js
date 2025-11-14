const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);

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
      console.log('🔄 Recurring booking detected - creating parent + child occurrences');

      // Extract recurring-specific data
      const recurringDates = bookingData.recurring_dates || [];
      const totalOccurrences = bookingData.total_occurrences || 1;

      // Prepare parent booking data (remove recurring_dates as it's not a DB column)
      const parentBookingData = { ...bookingData };
      delete parentBookingData.recurring_dates;

      // Insert parent booking into database
      const { data: parentData, error: parentError } = await supabase
        .from('bookings')
        .insert([parentBookingData])
        .select();

      if (parentError) {
        console.error('❌ Error creating parent booking:', parentError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Error creating parent booking',
            details: parentError.message
          })
        };
      }

      const parentBooking = parentData[0];
      console.log('✅ Parent booking created:', parentBooking.booking_id);

      // Create child occurrences in booking_occurrences table
      const occurrences = [];
      for (let i = 0; i < recurringDates.length && i < totalOccurrences; i++) {
        const occurrenceDate = new Date(recurringDates[i]);
        const dateOnly = occurrenceDate.toISOString().split('T')[0];
        const timeOnly = bookingData.booking_time.split('T')[1].substring(0, 5); // Extract HH:MM
        const dateTime = `${dateOnly}T${timeOnly}:00`;

        const occurrence = {
          booking_id: bookingData.booking_id,
          occurrence_number: i + 1,
          occurrence_date: dateOnly,
          occurrence_time: timeOnly,
          occurrence_datetime: dateTime,
          status: 'pending',
          payment_status: 'pending',
          amount: bookingData.price,
          // Apply discount and gift card only to first occurrence
          discount_applied: i === 0 && bookingData.discount_amount > 0,
          discount_amount: i === 0 ? (bookingData.discount_amount || 0) : 0,
          gift_card_applied: i === 0 && bookingData.gift_card_amount > 0,
          gift_card_amount: i === 0 ? (bookingData.gift_card_amount || 0) : 0
        };

        occurrences.push(occurrence);
      }

      // Insert all occurrences
      const { data: occurrencesData, error: occurrencesError } = await supabase
        .from('booking_occurrences')
        .insert(occurrences)
        .select();

      if (occurrencesError) {
        console.error('❌ Error creating booking occurrences:', occurrencesError);
        // Try to rollback parent booking
        await supabase.from('bookings').delete().eq('booking_id', bookingData.booking_id);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Error creating booking occurrences',
            details: occurrencesError.message
          })
        };
      }

      console.log(`✅ Created ${occurrencesData.length} booking occurrences`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          booking: parentBooking,
          occurrences: occurrencesData
        })
      };

    } else {
      // Non-recurring booking - standard flow
      console.log('📝 Creating standard (non-recurring) booking');

      // Insert booking into database (service role bypasses RLS)
      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
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

