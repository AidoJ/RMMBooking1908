// therapist-submit-invoice.js
// Allows therapists to submit invoices via service role (bypasses RLS)

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseServiceKey || !JWT_SECRET) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Verify JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing or invalid authorization header' })
      };
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('❌ Invalid token:', err.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid or expired token' })
      };
    }

    const userId = decoded.userId;
    console.log('✅ Authenticated user:', userId);

    // Get therapist profile
    const { data: therapistProfile, error: profileError } = await supabase
      .from('therapist_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (profileError || !therapistProfile) {
      console.error('❌ Therapist profile not found:', profileError);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Therapist profile not found' })
      };
    }

    const therapistId = therapistProfile.id;

    // Parse invoice data from request
    const invoiceData = JSON.parse(event.body);

    // Verify therapist_id matches authenticated user
    if (invoiceData.therapist_id !== therapistId) {
      console.error('❌ Therapist ID mismatch');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: Cannot submit invoice for another therapist' })
      };
    }

    console.log('📝 Submitting invoice for therapist:', therapistId);
    console.log('Invoice data:', invoiceData);

    // Insert invoice using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('therapist_payments')
      .insert([invoiceData])
      .select();

    if (error) {
      console.error('❌ Error inserting invoice:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    console.log('✅ Invoice submitted successfully:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };

  } catch (error) {
    console.error('❌ Error in therapist-submit-invoice:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
