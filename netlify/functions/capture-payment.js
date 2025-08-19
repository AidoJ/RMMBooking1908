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
    const { payment_intent_id, booking_id, completed_by } = JSON.parse(event.body);

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

    // Step 1: Verify booking exists and is in correct state
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

    if (booking.payment_status === 'captured') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Payment has already been captured' }),
      };
    }

    // Step 2: Capture the payment via Stripe
    const paymentIntent = await stripe.paymentIntents.capture(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment capture failed');
    }

    // Step 3: Update booking status in database
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'captured',
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: completed_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      // If database update fails, we have a problem - payment was captured but booking not updated
      console.error('CRITICAL: Payment captured but booking update failed:', updateError);
      throw new Error('Database update failed after payment capture');
    }

    // Step 4: Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'completed',
        notes: `Job completed and payment captured. Completed by: ${completed_by}`,
        changed_by: completed_by,
        changed_at: new Date().toISOString(),
      });

    console.log(`✅ Payment captured for booking ${booking_id}:`, paymentIntent.id);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        success: true,
        payment_intent: paymentIntent.id,
        amount_captured: paymentIntent.amount_received,
        booking_status: 'completed',
        payment_status: 'captured',
      }),
    };

  } catch (error) {
    console.error('Payment Capture Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: 'Failed to capture payment',
        message: error.message 
      }),
    };
  }
};