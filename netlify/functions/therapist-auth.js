const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Configuration error: Missing Supabase service role credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// JWT secret for therapist tokens
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRY = '24h'; // Token expires in 24 hours

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Email and password are required' })
      };
    }

    console.log('🔐 Therapist authentication attempt:', email);

    // Query therapist_profiles table using service role (bypasses RLS)
    const { data: therapist, error } = await supabase
      .from('therapist_profiles')
      .select('*')
      .eq('email', email)
      .eq('password', password) // Using same pattern as admin_users
      .eq('is_active', true)
      .single();

    if (error || !therapist) {
      console.error('❌ Authentication failed:', email, error?.message || 'Therapist not found');

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid email or password' })
      };
    }

    console.log('✅ Authentication successful:', therapist.email);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: therapist.user_id || therapist.id,
        therapistId: therapist.id,
        email: therapist.email,
        role: 'therapist',
        firstName: therapist.first_name,
        lastName: therapist.last_name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Return therapist info (without password) and token
    const { password: _, ...therapistWithoutPassword } = therapist;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: therapistWithoutPassword,
        token
      })
    };

  } catch (error) {
    console.error('❌ Authentication error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
