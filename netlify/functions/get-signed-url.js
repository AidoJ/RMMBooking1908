// get-signed-url.js
// Generates a temporary signed URL for files in Supabase Storage
// Used by admin panel and therapist app to view invoices/receipts on demand

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Verify auth token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const { path, bucket } = event.queryStringParameters || {};

    if (!path) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing path parameter' })
      };
    }

    const storageBucket = bucket || 'therapist-documents';

    // Generate signed URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('❌ Error creating signed URL:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate URL' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: data.signedUrl })
    };

  } catch (error) {
    console.error('❌ Error in get-signed-url:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
