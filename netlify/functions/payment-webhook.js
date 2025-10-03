const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  console.log('Received Stripe webhook:', stripeEvent.type);

  try {
    switch (stripeEvent.type) {
      case 'payment_intent.requires_capture':
        await handlePaymentAuthorized(stripeEvent.data.object);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentCaptured(stripeEvent.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(stripeEvent.data.object);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentCanceled(stripeEvent.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
    };
  }
};

async function handlePaymentAuthorized(paymentIntent) {
  console.log('Payment authorized (card held):', paymentIntent.id);
  
  const bookingId = paymentIntent.metadata.booking_id;
  
  if (!bookingId) {
    console.error('No booking ID found in payment intent metadata');
    return;
  }

  try {
    // Update booking payment status to authorized (not paid yet)
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'authorized',
        status: 'requested', // Keep as requested until therapist accepts
        payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Booking ${bookingId} payment authorized:`, data);

    // Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: data[0]?.id,
        status: 'payment_authorized',
        notes: 'Payment method authorized - funds held pending therapist acceptance',
        changed_at: new Date().toISOString(),
      });

    // TODO: Send booking request to available therapists
    
  } catch (error) {
    console.error('Error updating booking after payment authorization:', error);
  }
}

async function handlePaymentCaptured(paymentIntent) {
  console.log('Payment captured (money taken):', paymentIntent.id);
  
  const bookingId = paymentIntent.metadata.booking_id;
  
  if (!bookingId) {
    console.error('No booking ID found in payment intent metadata');
    return;
  }

  try {
    // Update booking to completed and paid
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Booking ${bookingId} payment captured and completed:`, data);

    // Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: data[0]?.id,
        status: 'completed',
        notes: 'Payment completed - service completed and paid',
        changed_at: new Date().toISOString(),
      });

    // TODO: Send completion confirmation emails
    
  } catch (error) {
    console.error('Error updating booking after payment capture:', error);
  }
}

async function handlePaymentFailure(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  
  const bookingId = paymentIntent.metadata.booking_id;
  
  if (!bookingId) {
    console.error('No booking ID found in payment intent metadata');
    return;
  }

  try {
    // Update booking payment status
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'failed',
        payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Booking ${bookingId} marked as payment failed`);

    // Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: data[0]?.id,
        status: 'payment_failed',
        notes: 'Payment failed - booking requires manual review',
        changed_at: new Date().toISOString(),
      });

    // TODO: Send payment failure notification
    
  } catch (error) {
    console.error('Error updating booking after payment failure:', error);
  }
}

async function handlePaymentCanceled(paymentIntent) {
  console.log('Payment canceled:', paymentIntent.id);
  
  const bookingId = paymentIntent.metadata.booking_id;
  
  if (!bookingId) {
    console.error('No booking ID found in payment intent metadata');
    return;
  }

  try {
    // Update booking status to canceled
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'cancelled',
        status: 'cancelled',
        payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Booking ${bookingId} marked as canceled`);

    // Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: data[0]?.id,
        status: 'cancelled',
        notes: 'Payment canceled - booking canceled',
        changed_at: new Date().toISOString(),
      });
    
  } catch (error) {
    console.error('Error updating booking after payment cancellation:', error);
  }
}