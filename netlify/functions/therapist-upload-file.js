// therapist-upload-file.js
// Uploads a file to Supabase Storage for therapist invoice submissions
// Accepts base64 data, returns the storage path

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const STORAGE_BUCKET = 'therapist-documents';

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
        body: JSON.stringify({ error: 'Therapist profile not found' })
      };
    }

    const { base64Data, folder, filename } = JSON.parse(event.body);

    if (!base64Data || !base64Data.startsWith('data:')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid file data' })
      };
    }

    // Parse the data URL
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid base64 format' })
      };
    }

    const mimeType = matches[1];
    const rawBase64 = matches[2];
    const buffer = Buffer.from(rawBase64, 'base64');

    // Only allow uploads to this therapist's own folder
    const therapistId = therapistProfile.id;
    const allowedFolders = [`invoices/${therapistId}`, `receipts/${therapistId}`];
    if (!allowedFolders.some(f => folder.startsWith(f))) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Unauthorized folder' })
      };
    }

    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] || 'bin';
    const storagePath = `${folder}/${filename}.${ext}`;

    console.log(`Uploading: ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Upload failed: ${uploadError.message}` })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, path: storagePath })
    };

  } catch (error) {
    console.error('Error in therapist-upload-file:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
