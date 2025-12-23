const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { registrationId } = JSON.parse(event.body);

    if (!registrationId) {
      throw new Error('Registration ID is required');
    }

    console.log(`📧 Sending signed agreement email for registration: ${registrationId}`);

    // ===================================================
    // STEP 1: Fetch Registration Data
    // ===================================================
    const { data: registration, error: regError } = await supabase
      .from('therapist_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError) throw regError;
    if (!registration) throw new Error('Registration not found');

    if (!registration.signed_agreement_pdf_url) {
      throw new Error('Signed agreement PDF not yet generated');
    }

    console.log(`✓ Registration data fetched`);

    // ===================================================
    // STEP 2: Send Email via EmailJS with PDF Link
    // ===================================================

    const templateParams = {
      to_email: registration.email,
      to_name: registration.first_name,
      first_name: registration.first_name,
      last_name: registration.last_name,
      registration_id: registration.id.substring(0, 8).toUpperCase(),
      submitted_date: formatDate(registration.submitted_at),
      pdf_download_url: registration.signed_agreement_pdf_url,
      pdf_filename: `Rejuvenators-Agreement-${registration.last_name}-${registration.id.substring(0, 8)}.pdf`
    };

    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_THERAPIST_REG, // EmailJS template ID (max 12 chars)
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    console.log(`✅ Email sent successfully to ${registration.email}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: `Signed agreement sent to ${registration.email}`
      }),
    };

  } catch (error) {
    console.error('❌ Error sending email:', error);

    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email'
      }),
    };
  }
};

// ===================================================
// HELPER FUNCTIONS
// ===================================================
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
