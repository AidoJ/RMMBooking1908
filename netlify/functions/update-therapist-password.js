// update-therapist-password.js - Handle therapist password changes

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

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
    // Verify JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid authorization token' })
      };
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }

    // Parse request body
    const { user_id, current_password, new_password } = JSON.parse(event.body);

    if (!user_id || !current_password || !new_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Verify the user is updating their own password
    if (decoded.userId !== user_id) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You can only change your own password' })
      };
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, password, role')
      .eq('id', user_id)
      .single();

    if (fetchError || !user) {
      console.error('Error fetching user:', fetchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Verify user is a therapist
    if (user.role !== 'therapist') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'This endpoint is for therapists only' })
      };
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(current_password, user.password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Current password is incorrect' })
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password in database
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ password: hashedPassword })
      .eq('id', user_id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update password' })
      };
    }

    console.log('✅ Password updated successfully for user:', user_id);

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
