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

// JWT secret for admin tokens
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

    console.log('🔐 Admin authentication attempt:', email);

    // Query admin_users table using service role (bypasses RLS)
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('password', password) // TODO: In production, use bcrypt/hashed passwords
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.error('❌ Authentication failed:', email, error?.message || 'User not found');
      
      // Log failed attempt for security monitoring
      try {
        await supabase
          .from('admin_activity_log')
          .insert({
            user_id: null,
            action: 'login_failed',
            table_name: 'admin_users',
            record_id: email,
            ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
          });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid email or password' })
      };
    }

    console.log('✅ Authentication successful:', user.email, 'Role:', user.role);

    // Update last_login timestamp
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Log successful login
    try {
      await supabase
        .from('admin_activity_log')
        .insert({
          user_id: user.id,
          action: 'login_success',
          table_name: 'admin_users',
          record_id: user.id,
          ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip']
        });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: userWithoutPassword,
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

