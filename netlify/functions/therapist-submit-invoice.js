// therapist-submit-invoice.js
// Allows therapists to submit invoices via service role (bypasses RLS)
// Files are stored in Supabase Storage, only paths saved to DB

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const STORAGE_BUCKET = 'therapist-documents';

/**
 * Upload a base64 data URL to Supabase Storage
 * Returns the storage path (not the full URL)
 */
async function uploadFileToStorage(base64DataUrl, folder, filename) {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:')) {
    return null;
  }

  // Parse the data URL: data:image/png;base64,xxxxx or data:application/pdf;base64,xxxxx
  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    console.error('❌ Invalid base64 data URL format');
    return null;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Convert base64 to Buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Determine file extension from mime type
  const extMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'application/pdf': 'pdf',
  };
  const ext = extMap[mimeType] || 'bin';
  const storagePath = `${folder}/${filename}.${ext}`;

  console.log(`📤 Uploading to storage: ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB, ${mimeType})`);

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('❌ Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  console.log(`✅ File uploaded: ${storagePath}`);
  return storagePath;
}

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

    // Upload files to Supabase Storage (if they are base64 data)
    const timestamp = Date.now();
    const weekEnd = invoiceData.week_end_date || 'unknown';

    if (invoiceData.therapist_invoice_url && invoiceData.therapist_invoice_url.startsWith('data:')) {
      const storagePath = await uploadFileToStorage(
        invoiceData.therapist_invoice_url,
        `invoices/${therapistId}`,
        `invoice_${weekEnd}_${timestamp}`
      );
      invoiceData.therapist_invoice_url = storagePath;
    }

    if (invoiceData.parking_receipt_url && invoiceData.parking_receipt_url.startsWith('data:')) {
      const storagePath = await uploadFileToStorage(
        invoiceData.parking_receipt_url,
        `receipts/${therapistId}`,
        `receipt_${weekEnd}_${timestamp}`
      );
      invoiceData.parking_receipt_url = storagePath;
    }

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

    console.log('✅ Invoice submitted successfully:', data[0]?.id);

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
