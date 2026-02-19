// therapist-get-invoice-files.js
// Returns just the file path columns for a specific invoice
// Used by therapist app to load files on demand (avoids sending blobs in list queries)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
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
    // Verify auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing authorization' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid token' })
      };
    }

    // Get therapist profile
    const { data: therapistProfile, error: profileError } = await supabase
      .from('therapist_profiles')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !therapistProfile) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Therapist profile not found' })
      };
    }

    const { invoice_id } = JSON.parse(event.body);

    if (!invoice_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing invoice_id' })
      };
    }

    // Fetch only file columns, and verify the invoice belongs to this therapist
    const { data, error } = await supabase
      .from('therapist_payments')
      .select('therapist_invoice_url, parking_receipt_url')
      .eq('id', invoice_id)
      .eq('therapist_id', therapistProfile.id)
      .single();

    if (error) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Invoice not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };

  } catch (error) {
    console.error('Error in therapist-get-invoice-files:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
