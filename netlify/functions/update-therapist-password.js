// update-therapist-password.js - Handle therapist password changes

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify Supabase Auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization token' })
      };
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Invalid token:', authError?.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }

    console.log('✅ Authenticated user:', user.id, user.email);

    // Parse request body
    const { new_password } = JSON.parse(event.body);

    if (!new_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'New password is required' })
      };
    }

    // Validate password requirements
    if (new_password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Password must be at least 6 characters long' })
      };
    }

    // Verify user is a therapist
    const { data: therapistProfile, error: profileError } = await supabase
      .from('therapist_profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !therapistProfile) {
      console.error('❌ Therapist profile not found:', profileError);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'This endpoint is for therapists only' })
      };
    }

    // Update password in Supabase Auth using service role
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update password' })
      };
    }

    console.log('✅ Password updated successfully for user:', user.email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password updated successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error in update-therapist-password handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
