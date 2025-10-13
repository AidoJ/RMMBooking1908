const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body);

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' })
      };
    }

    console.log('🔍 Looking up customer by email:', email);

    // Look up customer by email (service role bypasses RLS)
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone, customer_code, is_guest')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('❌ Error looking up customer:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error looking up customer' })
      };
    }

    if (customer) {
      console.log('✅ Customer found:', customer.customer_code);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          found: true,
          customer: {
            id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
            customer_code: customer.customer_code,
            is_guest: customer.is_guest
          }
        })
      };
    } else {
      console.log('🆕 Customer not found - new customer');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ found: false })
      };
    }

  } catch (error) {
    console.error('❌ Error in customer lookup:', error);
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

