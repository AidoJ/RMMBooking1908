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
    const { amount, currency = 'aud', giftCardData } = JSON.parse(event.body);

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

    if (!giftCardData || !giftCardData.card_holder_name || !giftCardData.card_holder_email) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Card holder name and email are required' }),
      };
    }

    // Create or retrieve Stripe customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: giftCardData.card_holder_email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          name: giftCardData.card_holder_name,
          email: giftCardData.card_holder_email,
          phone: giftCardData.card_holder_phone || null,
        });
      }
    } catch (customerError) {
      console.error('Error creating/retrieving customer:', customerError);
      // Continue without customer if there's an issue
    }

    // Create payment intent for IMMEDIATE CAPTURE (gift cards are prepaid)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      capture_method: 'automatic', // KEY: Immediate capture for gift cards
      customer: customer ? customer.id : undefined,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'gift_card',
        gift_card_code: giftCardData.code || '',
        recipient_name: giftCardData.recipient_name || '',
        recipient_email: giftCardData.recipient_email || '',
        purchaser_name: giftCardData.purchaser_name || giftCardData.card_holder_name,
        purchaser_email: giftCardData.purchaser_email || giftCardData.card_holder_email,
        admin_created: 'true',
      },
      description: `Gift Card ${giftCardData.code ? `(${giftCardData.code})` : ''} - $${amount}`,
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        customer_id: customer ? customer.id : null,
        amount: paymentIntent.amount / 100, // Convert back to dollars for reference
        currency: paymentIntent.currency,
      }),
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        details: error.message,
      }),
    };
  }
};