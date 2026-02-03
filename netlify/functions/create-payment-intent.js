const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests FIRST
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
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
    const body = JSON.parse(event.body);
    const { currency = 'aud', bookingData } = body;

    // Parse amount as float to handle string inputs
    const amount = parseFloat(body.amount);

    console.log('📥 Payment intent request:', { amount, currency, bookingData });

    // Validate required fields
    if (!amount || isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid amount:', body.amount);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid amount is required', received: body.amount }),
      };
    }

    const customerEmail = bookingData?.customer_email || bookingData?.email || '';
    const customerName = bookingData?.customer_name || '';

    // Create or retrieve Stripe customer for recurring payments
    let customer;
    if (customerEmail) {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log('Found existing Stripe customer:', customer.id);
      } else {
        // Create new customer
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName,
          metadata: {
            source: 'rejuvenators_booking'
          }
        });
        console.log('Created new Stripe customer:', customer.id);
      }
    }

    // Create payment intent for AUTHORIZATION (not immediate capture)
    const paymentIntentParams = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customer ? customer.id : undefined, // Attach customer for recurring payments
      capture_method: 'manual', // KEY: This authorizes but doesn't capture payment
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        booking_id: bookingData?.booking_id || bookingData?.id || '',
        customer_email: customerEmail,
        service_name: bookingData?.service_name || '',
        booking_time: bookingData?.booking_time || '',
        therapist_fee: bookingData?.therapist_fee?.toString() || '0',
      },
      description: `Booking Authorization - ${bookingData?.service_name || 'Service'}`,
    };

    // For recurring payments, tell Stripe to save the payment method for future use
    if (customer) {
      paymentIntentParams.setup_future_usage = 'off_session';
      console.log('Setting up payment method for future off-session use');
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    console.log('✅ Payment intent created:', paymentIntent.id, 'Amount:', paymentIntent.amount);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        stripe_customer_id: customer ? customer.id : null,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }),
    };
  } catch (error) {
    console.error('❌ Payment Intent Creation Error:', error);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        message: error.message,
        type: error.type,
        code: error.code
      }),
    };
  }
};