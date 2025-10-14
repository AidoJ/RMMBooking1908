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
    const bookingData = JSON.parse(event.body);

    console.log('📝 Creating booking:', bookingData.booking_id);

    // Insert booking into database (service role bypasses RLS)
    const { data, error } = await supabase
      .from('bookings')
      .insert([bookingData])
      .select();

    if (error) {
      console.error('❌ Error creating booking:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Error creating booking',
          details: error.message 
        })
      };
    }

    console.log('✅ Booking created successfully:', data[0]?.booking_id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        booking: data[0]
      })
    };

  } catch (error) {
    console.error('❌ Error in create-booking:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

