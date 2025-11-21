const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { payment_intent_id, booking_id, cancelled_by, reason } = JSON.parse(event.body);

    // Validate required fields
    if (!payment_intent_id || !booking_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Payment intent ID and booking ID are required' }),
      };
    }

    // Step 1: Verify booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('payment_intent_id', payment_intent_id)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Booking not found or payment intent mismatch' }),
      };
    }

    if (booking.payment_status === 'cancelled') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Payment authorization has already been cancelled' }),
      };
    }

    // Step 2: Cancel the payment intent via Stripe (releases authorization)
    const paymentIntent = await stripe.paymentIntents.cancel(payment_intent_id);

    if (paymentIntent.status !== 'canceled') {
      throw new Error('Payment authorization cancellation failed');
    }

    // Step 3: Update booking status in database
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'cancelled',
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelled_by,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('CRITICAL: Payment cancelled but booking update failed:', updateError);
      throw new Error('Database update failed after payment cancellation');
    }

    // Step 4: Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'cancelled',
        notes: `Booking cancelled and payment authorization released. Reason: ${reason}. Cancelled by: ${cancelled_by}`,
        changed_by: cancelled_by,
        changed_at: new Date().toISOString(),
      });

    console.log(`✅ Payment authorization cancelled for booking ${booking_id}:`, paymentIntent.id);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        success: true,
        payment_intent: paymentIntent.id,
        booking_status: 'cancelled',
        payment_status: 'cancelled',
        message: 'Payment authorization released successfully'
      }),
    };

  } catch (error) {
    console.error('Payment Cancellation Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: 'Failed to cancel payment authorization',
        message: error.message 
      }),
    };
  }
};