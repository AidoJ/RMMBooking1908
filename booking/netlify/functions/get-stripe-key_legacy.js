// Netlify function to serve Stripe publishable key
// This allows us to use environment variables securely

exports.handler = async (event, context) => {
  try {
    // Return the Stripe publishable key from environment variables
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Stripe publishable key not configured'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publishableKey: publishableKey
      })
    };

  } catch (error) {
    console.error('Error getting Stripe key:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to get Stripe key'
      })
    };
  }
};