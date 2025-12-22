const { createClient } = require('@supabase/supabase-js');
const multipart = require('lambda-multipart-parser');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse multipart form data
    const result = await multipart.parse(event);

    if (!result.files || result.files.length === 0) {
      throw new Error('No file provided');
    }

    const file = result.files[0];
    const fieldName = result.fieldName || 'document';

    console.log(`📤 Uploading file: ${file.filename} (${file.contentType})`);

    // Sanitize filename - remove special characters that Supabase doesn't allow
    const sanitizedFilename = file.filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `therapist-registrations/${timestamp}-${sanitizedFilename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('therapist-documents')
      .upload(fileName, file.content, {
        contentType: file.contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('therapist-documents')
      .getPublicUrl(fileName);

    console.log(`✅ File uploaded successfully: ${publicUrl}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        filename: file.filename
      }),
    };

  } catch (error) {
    console.error('❌ Upload error:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'File upload failed'
      }),
    };
  }
};
