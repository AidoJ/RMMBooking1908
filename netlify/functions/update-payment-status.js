const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { booking_id, payment_intent_id, payment_status } = JSON.parse(event.body);

    if (!booking_id || !payment_intent_id || !payment_status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    console.log(`📝 Updating payment status for ${booking_id} to ${payment_status}`);

    // Update booking with payment details
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: payment_status,
        payment_intent_id: payment_intent_id,
        status: payment_status === 'authorized' ? 'confirmed' : 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', booking_id)
      .select();

    if (updateError) {
      console.error('❌ Error updating booking:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update booking', details: updateError.message })
      };
    }

    if (!updatedBooking || updatedBooking.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    console.log(`✅ Payment status updated successfully for ${booking_id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking: updatedBooking[0]
      })
    };

  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
