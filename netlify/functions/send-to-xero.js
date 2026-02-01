const fetch = require('node-fetch');

/**
 * Send Therapist Invoice to Xero
 *
 * This function sends the therapist's invoice to Xero via EmailJS.
 * The XERO_INBOX_EMAIL environment variable must be configured.
 */

// EmailJS configuration (same as other functions)
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_XERO_TEMPLATE = 'template_xero_invoice';

// Send email via EmailJS API
async function sendEmailJS(templateParams) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_XERO_TEMPLATE,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS error: ${errorText}`);
  }

  return response;
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      therapist_name,
      invoice_number,
      invoice_date,
      total_amount,
      invoice_file_base64, // Base64 data URL (e.g., data:application/pdf;base64,...)
      week_period
    } = JSON.parse(event.body);

    // Get Xero inbox email from environment variable
    const xeroEmail = process.env.XERO_INBOX_EMAIL;

    if (!xeroEmail) {
      console.error('❌ XERO_INBOX_EMAIL environment variable not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Xero email not configured. Please add XERO_INBOX_EMAIL to Netlify environment variables.' }),
      };
    }

    if (!EMAILJS_PRIVATE_KEY) {
      console.error('❌ EMAILJS_PRIVATE_KEY environment variable not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'EmailJS private key not configured.' }),
      };
    }

    // Validate required fields
    if (!invoice_file_base64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invoice file is required' }),
      };
    }

    if (!therapist_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Therapist name is required' }),
      };
    }

    console.log('📧 Sending invoice to Xero:', {
      therapistName: therapist_name,
      invoiceNumber: invoice_number,
      totalAmount: total_amount,
      xeroEmail: xeroEmail.substring(0, 10) + '...',
      hasInvoice: !!invoice_file_base64
    });

    // Prepare template parameters
    const templateParams = {
      to_email: xeroEmail,
      therapist_name: therapist_name || '',
      invoice_number: invoice_number || 'N/A',
      invoice_date: invoice_date || '',
      total_amount: '$' + parseFloat(total_amount || 0).toFixed(2),
      week_period: week_period || '',
      invoice_attachment: invoice_file_base64, // Base64 file for attachment
      from_name: 'Rejuvenators Mobile Massage'
    };

    // Send via EmailJS
    await sendEmailJS(templateParams);

    console.log('✅ Invoice sent to Xero successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invoice sent to Xero successfully',
        details: {
          therapist: therapist_name,
          invoice_number: invoice_number,
          sent_to: xeroEmail.substring(0, 5) + '***'
        }
      }),
    };

  } catch (error) {
    console.error('❌ Error sending invoice to Xero:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to send invoice to Xero',
        message: error.message
      }),
    };
  }
};
