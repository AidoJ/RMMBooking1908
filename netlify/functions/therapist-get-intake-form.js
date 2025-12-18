// therapist-get-intake-form.js
// Allows therapists to view intake forms for their assigned bookings

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
    const bookingId = event.queryStringParameters?.booking;

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing booking parameter' })
      };
    }

    console.log('📋 Therapist fetching intake form for booking:', bookingId);

    // Verify this booking belongs to this therapist
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('therapist_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Booking not found' })
      };
    }

    // Verify therapist owns this booking
    if (booking.therapist_id !== therapistId) {
      console.error('❌ Unauthorized: Therapist does not own this booking');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized: You can only view intake forms for your own bookings' })
      };
    }

    // Fetch intake form
    const { data: intakeForm, error: formError } = await supabase
      .from('client_intake_forms')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (formError && formError.code !== 'PGRST116') {
      console.error('❌ Error fetching intake form:', formError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to fetch intake form' })
      };
    }

    console.log('✅ Intake form retrieved successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: intakeForm
      })
    };

  } catch (error) {
    console.error('❌ Error in therapist-get-intake-form:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
