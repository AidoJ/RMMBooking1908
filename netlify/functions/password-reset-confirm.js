// password-reset-confirm.js - Complete password reset flow
// User submits token + new password → validates → updates password

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const { token, new_password } = JSON.parse(event.body);

    if (!token || !new_password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Token and new password are required'
        })
      };
    }

    console.log('🔐 Password reset confirmation requested');

    // Validate password strength
    if (new_password.length < PASSWORD_MIN_LENGTH) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Password must be at least 8 characters long'
        })
      };
    }

    if (!PASSWORD_REGEX.test(new_password)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        })
      };
    }

    // Look up the reset token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (tokenError || !resetToken) {
      console.log('⚠️ Invalid or expired token');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired reset token'
        })
      };
    }

    // Check if token has already been used
    if (resetToken.used_at) {
      console.log('⚠️ Token already used');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'This reset token has already been used'
        })
      };
    }

    // Check if token has expired
    const expiresAt = new Date(resetToken.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      console.log('⚠️ Token expired');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'This reset token has expired'
        })
      };
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update user's password
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', resetToken.user_id);

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to update password'
        })
      };
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    if (markUsedError) {
      console.error('❌ Error marking token as used:', markUsedError);
      // Password was updated successfully, so don't fail the request
    }

    console.log('✅ Password reset successful for user:', resetToken.user_id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.'
      })
    };

  } catch (error) {
    console.error('❌ Password reset confirmation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
