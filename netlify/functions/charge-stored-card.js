const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Charge Stored Card
 *
 * Creates a new payment intent using a customer's saved payment method.
 * Used for recovering declined bookings without requiring the customer
 * to re-enter their card details.
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      booking_id,
      stripe_customer_id,
      amount,
      new_therapist_id,
      recovered_by
    } = JSON.parse(event.body);

    // Validate required fields
    if (!booking_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking ID is required' }),
      };
    }

    if (!stripe_customer_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Stripe customer ID is required' }),
      };
    }

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid amount is required' }),
      };
    }

    if (!new_therapist_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'New therapist ID is required' }),
      };
    }

    console.log(`🔄 Recovering booking ${booking_id} with new therapist ${new_therapist_id}`);

    // Step 1: Verify the booking exists and is declined
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' }),
      };
    }

    if (booking.status !== 'declined') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Cannot recover booking with status: ${booking.status}. Only declined bookings can be recovered.` }),
      };
    }

    // Step 2: Get the customer's saved payment methods
    console.log(`🔍 Looking up payment methods for customer: ${stripe_customer_id}`);

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripe_customer_id,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'No saved payment methods found for this customer',
          suggestion: 'Customer will need to make a new booking with fresh card details'
        }),
      };
    }

    // Use the most recent payment method (first in the list)
    const paymentMethod = paymentMethods.data[0];
    console.log(`💳 Using payment method: ${paymentMethod.id} (${paymentMethod.card.brand} ending ${paymentMethod.card.last4})`);

    // Step 3: Verify the new therapist exists and is active
    const { data: therapist, error: therapistError } = await supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, email, phone, is_active')
      .eq('id', new_therapist_id)
      .single();

    if (therapistError || !therapist) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'New therapist not found' }),
      };
    }

    if (!therapist.is_active) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Selected therapist is not active' }),
      };
    }

    // Step 4: Create a new payment intent with the saved payment method
    // Using manual capture so payment is authorized but not charged until job completion
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'aud',
      customer: stripe_customer_id,
      payment_method: paymentMethod.id,
      capture_method: 'manual', // Authorize only, capture later
      confirm: true, // Confirm immediately with saved payment method
      off_session: true, // Customer is not present
      metadata: {
        booking_id: booking_id,
        recovered_from: 'declined',
        original_therapist_id: booking.therapist_id,
        new_therapist_id: new_therapist_id,
        recovered_by: recovered_by || 'admin',
      },
      description: `Recovered Booking - ${booking.booking_id}`,
    });

    console.log(`✅ Payment authorized: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    if (paymentIntent.status !== 'requires_capture') {
      // Payment failed or needs additional action
      console.error('❌ Payment intent not in expected state:', paymentIntent.status);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Payment authorization failed',
          status: paymentIntent.status,
          message: paymentIntent.last_payment_error?.message || 'Card may have been declined or expired'
        }),
      };
    }

    // Step 5: Update the booking with new therapist and payment info
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        therapist_id: new_therapist_id,
        status: 'confirmed', // Set to confirmed since admin is manually assigning
        payment_intent_id: paymentIntent.id,
        payment_status: 'authorized',
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update booking:', updateError);
      // Try to cancel the payment intent since booking update failed
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (cancelError) {
        console.error('❌ Failed to cancel payment intent after booking update failure:', cancelError);
      }
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update booking', details: updateError.message }),
      };
    }

    // Step 6: Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'recovered',
        notes: `Booking recovered from declined status. New therapist: ${therapist.first_name} ${therapist.last_name}. New payment authorized. Recovered by: ${recovered_by || 'admin'}`,
        changed_by: recovered_by,
        changed_at: new Date().toISOString(),
      });

    // Step 7: Add confirmed status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'confirmed',
        notes: `Booking confirmed with therapist: ${therapist.first_name} ${therapist.last_name}`,
        changed_by: recovered_by,
        changed_at: new Date().toISOString(),
      });

    console.log(`✅ Booking ${booking_id} successfully recovered`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Booking recovered successfully',
        booking_id: booking_id,
        new_therapist: {
          id: therapist.id,
          name: `${therapist.first_name} ${therapist.last_name}`,
          email: therapist.email,
          phone: therapist.phone,
        },
        payment: {
          payment_intent_id: paymentIntent.id,
          amount: amount,
          status: 'authorized',
          card_last4: paymentMethod.card.last4,
          card_brand: paymentMethod.card.brand,
        },
        booking_status: 'confirmed',
      }),
    };

  } catch (error) {
    console.error('❌ Charge Stored Card Error:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Card declined',
          message: error.message,
          code: error.code
        }),
      };
    }

    if (error.type === 'StripeInvalidRequestError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid request',
          message: error.message
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to recover booking',
        message: error.message
      }),
    };
  }
};
