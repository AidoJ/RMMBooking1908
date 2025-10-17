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

    // Query admin_users table with therapist role (same as admin but filtered by role)
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('role', 'therapist')  // Only allow therapist role
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.error('❌ Authentication failed:', email, error?.message || 'User not found or not a therapist');

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid email or password' })
      };
    }

    console.log('✅ Authentication successful:', user.email, 'Role:', user.role);

    // Get therapist profile data
    const { data: therapistProfile } = await supabase
      .from('therapist_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        therapistProfileId: therapistProfile?.id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Return user info (without password) and include therapist profile
    const { password: _, ...userWithoutPassword } = user;
    const responseData = {
      ...userWithoutPassword,
      therapist_profile: therapistProfile
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: responseData,
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
