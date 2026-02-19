// therapist-get-invoices.js
// Allows therapists to retrieve their invoices via service role (bypasses RLS)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
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
    // Verify Supabase Auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing authorization token' })
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
        body: JSON.stringify({ success: false, error: 'Invalid or expired token' })
      };
    }

    console.log('✅ Authenticated user:', user.id, user.email);

    // Get therapist profile using auth_id
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
        body: JSON.stringify({ success: false, error: 'Therapist profile not found' })
      };
    }

    const therapistId = therapistProfile.id;
    console.log('📋 Fetching invoices for therapist:', therapistId);

    // Retrieve invoices using service role (bypasses RLS)
    // Exclude therapist_invoice_url and parking_receipt_url blob columns to avoid Lambda payload limit
    const { data, error } = await supabase
      .from('therapist_payments')
      .select(`
        id,
        therapist_id,
        week_start_date,
        week_end_date,
        calculated_fees,
        booking_count,
        booking_ids,
        therapist_invoice_number,
        therapist_invoice_date,
        therapist_invoiced_fees,
        therapist_parking_amount,
        therapist_total_claimed,
        therapist_notes,
        submitted_at,
        variance_fees,
        admin_approved_fees,
        admin_approved_parking,
        admin_total_approved,
        admin_notes,
        reviewed_at,
        paid_amount,
        paid_date,
        eft_reference,
        payment_notes,
        status,
        processed_at
      `)
      .eq('therapist_id', therapistId)
      .order('week_start_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    console.log(`✅ Retrieved ${data?.length || 0} invoices`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };

  } catch (error) {
    console.error('❌ Error in therapist-get-invoices:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
