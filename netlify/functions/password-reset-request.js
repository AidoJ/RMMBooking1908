// password-reset-request.js - Initiate password reset flow
// User submits email → generates token → sends reset link

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_RESET_TEMPLATE = 'template_passwordreset'; // You'll create this template

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
    const { email, app } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Email is required' })
      };
    }

    console.log('🔐 Password reset requested for:', email);

    // Check if user exists and is active
    const { data: user, error: userError } = await supabase
      .from('admin_users')
      .select('id, email, first_name, role, is_active')
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    // Always return success to prevent email enumeration attacks
    if (userError || !user) {
      console.log('⚠️ User not found or inactive:', email);
      // Return success anyway (security best practice)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      };
    }

    // Delete any existing unused tokens for this user
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)
      .is('used_at', null);

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token in database
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('❌ Error creating reset token:', tokenError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to generate reset token' })
      };
    }

    // Determine which app to link to (admin or therapist)
    const baseUrl = 'https://booking.rejuvenators.com';
    const resetPath = app === 'therapist' ? '/therapist/reset-password' : '/admin/reset-password';
    const resetLink = `${baseUrl}${resetPath}?token=${token}`;

    // Send reset email
    try {
      await sendResetEmail(user.email, user.first_name, resetLink);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Error sending reset email:', emailError);
      // Delete the token if email fails
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('token', token);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to send reset email' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    };

  } catch (error) {
    console.error('❌ Password reset request error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

// Send password reset email using EmailJS
async function sendResetEmail(email, firstName, resetLink) {
  if (!EMAILJS_PRIVATE_KEY) {
    throw new Error('EmailJS private key not configured');
  }

  const templateParams = {
    to_email: email,
    user_name: firstName,
    reset_link: resetLink,
    expiry_hours: '1'
  };

  const emailData = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_RESET_TEMPLATE,
    user_id: EMAILJS_PUBLIC_KEY,
    accessToken: EMAILJS_PRIVATE_KEY,
    template_params: templateParams
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS error: ${response.status} - ${errorText}`);
  }

  return { success: true };
}
