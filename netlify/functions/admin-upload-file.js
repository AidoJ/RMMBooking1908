// admin-upload-file.js
// Uploads a file to Supabase Storage for admin manual invoice entries
// Returns the storage path (not the full URL)

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

    // Verify admin
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' })
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

    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] || 'bin';
    const storagePath = `${folder}/${filename}.${ext}`;

    console.log(`Uploading to storage: ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

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
      body: JSON.stringify({ path: storagePath })
    };

  } catch (error) {
    console.error('Error in admin-upload-file:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
