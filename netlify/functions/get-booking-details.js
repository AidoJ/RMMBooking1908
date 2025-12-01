const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get booking_id from query parameters
    const bookingId = event.queryStringParameters?.booking_id;
    const skipPaymentValidation = event.queryStringParameters?.skip_payment_validation === 'true';

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing booking_id parameter' })
      };
    }

    console.log(`📋 Fetching booking details for: ${bookingId}`);

    // Query booking with service details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_id,
        first_name,
        last_name,
        customer_email,
        customer_phone,
        booking_time,
        duration_minutes,
        price,
        address,
        payment_status,
        payment_intent_id,
        stripe_customer_id,
        stripe_payment_method_id,
        therapist_fee,
        request_id,
        occurrence_number,
        services(name)
      `)
      .eq('booking_id', bookingId)
      .single();

    if (error) {
      console.error('❌ Error fetching booking:', error);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    if (!booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Validate booking is in a state that can accept payment (only if not skipped)
    if (!skipPaymentValidation) {
      const validPaymentStatuses = ['pending', 'authorization_pending', 'authorization_failed', 'failed'];

      if (!validPaymentStatuses.includes(booking.payment_status)) {
        console.log(`⚠️ Booking ${bookingId} has payment_status: ${booking.payment_status} - not requiring payment`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'This booking does not require payment authorization',
            payment_status: booking.payment_status
          })
        };
      }
    }

    // Prepare response data
    const responseData = {
      booking_id: booking.booking_id,
      first_name: booking.first_name,
      last_name: booking.last_name,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      booking_time: booking.booking_time,
      duration_minutes: booking.duration_minutes,
      price: booking.price,
      address: booking.address,
      payment_status: booking.payment_status,
      therapist_fee: booking.therapist_fee,
      service_name: booking.services?.name || 'Massage Service',
      request_id: booking.request_id,
      occurrence_number: booking.occurrence_number
    };

    console.log(`✅ Successfully retrieved booking details for ${bookingId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
