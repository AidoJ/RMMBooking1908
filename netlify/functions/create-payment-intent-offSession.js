const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const {
      amount,
      currency = 'aud',
      stripe_customer_id,
      stripe_payment_method_id,
      bookingData
    } = JSON.parse(event.body);

    // Validate required fields
    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Valid amount is required' }),
      };
    }

    if (!stripe_customer_id || !stripe_payment_method_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Customer ID and Payment Method ID are required for off-session payments' }),
      };
    }

    console.log('Creating off-session payment intent for:', {
      amount,
      customer: stripe_customer_id,
      payment_method: stripe_payment_method_id,
      booking_id: bookingData?.booking_id
    });

    // Create payment intent for AUTHORIZATION (not immediate capture)
    // Using saved payment method for off-session payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: stripe_customer_id,
      payment_method: stripe_payment_method_id,
      confirm: true, // Automatically confirm the payment
      capture_method: 'manual', // KEY: This authorizes but doesn't capture payment
      off_session: true, // KEY: Allows charging without customer present
      metadata: {
        booking_id: bookingData?.booking_id || bookingData?.id || '',
        customer_email: bookingData?.customer_email || bookingData?.email || '',
        service_name: bookingData?.service_name || '',
        booking_time: bookingData?.booking_time || '',
        therapist_fee: bookingData?.therapist_fee?.toString() || '0',
        occurrence_number: bookingData?.occurrence_number?.toString() || '',
      },
      description: `Subsequent Occurrence Authorization - ${bookingData?.service_name || 'Service'} (Occurrence #${bookingData?.occurrence_number || 'N/A'})`,
    });

    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });

    // Check if payment was successful
    if (paymentIntent.status === 'requires_capture') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({
          success: true,
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        }),
      };
    } else {
      // Payment failed or requires action
      console.error('Payment authorization failed:', {
        status: paymentIntent.status,
        last_payment_error: paymentIntent.last_payment_error
      });

      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({
          error: 'Payment authorization failed',
          status: paymentIntent.status,
          message: paymentIntent.last_payment_error?.message || 'Unknown error',
        }),
      };
    }
  } catch (error) {
    console.error('Payment Intent Creation Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        message: error.message
      }),
    };
  }
};
