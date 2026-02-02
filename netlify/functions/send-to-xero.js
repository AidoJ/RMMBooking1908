const fetch = require('node-fetch');

/**
 * Send Therapist Invoice to Xero via EmailJS
 *
 * Required environment variables:
 * - XERO_INBOX_EMAIL: The Xero inbox email address
 * - EMAILJS_PRIVATE_KEY: EmailJS private/access key
 */

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_XERO_TEMPLATE = 'template_xero_invoice';

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
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      therapist_name,
      invoice_number,
      invoice_date,
      total_amount,
      invoice_file_base64,
      week_period
    } = JSON.parse(event.body);

    const xeroEmail = process.env.XERO_INBOX_EMAIL;

    if (!xeroEmail) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'XERO_INBOX_EMAIL not configured' }),
      };
    }

    if (!EMAILJS_PRIVATE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'EMAILJS_PRIVATE_KEY not configured' }),
      };
    }

    if (!invoice_file_base64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invoice file is required' }),
      };
    }

    // Parse base64 data URL
    let fileContent = invoice_file_base64;
    let contentType = 'application/pdf';
    let fileExtension = 'pdf';

    if (invoice_file_base64.startsWith('data:')) {
      const matches = invoice_file_base64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        fileContent = matches[2]; // Raw base64 only

        if (contentType.includes('png')) fileExtension = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) fileExtension = 'jpg';
        else fileExtension = 'pdf';
      }
    }

    // Create filename
    const safeTherapistName = (therapist_name || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    const safeInvoiceNumber = (invoice_number || 'NA').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Invoice_${safeTherapistName}_${safeInvoiceNumber}.${fileExtension}`;

    console.log('📧 Sending invoice to Xero via EmailJS:', {
      therapistName: therapist_name,
      invoiceNumber: invoice_number,
      xeroEmail: xeroEmail.substring(0, 15) + '...',
      filename: filename,
      contentType: contentType,
      fileSizeKB: Math.round(fileContent.length * 0.75 / 1024)
    });

    // Template params - keep variables small, attachment separate
    const templateParams = {
      to_email: xeroEmail,
      therapist_name: therapist_name || '',
      invoice_number: invoice_number || 'N/A',
      invoice_date: invoice_date || '',
      total_amount: '$' + parseFloat(total_amount || 0).toFixed(2),
      week_period: week_period || '',
      // Attachment parameters for EmailJS
      invoice_attachment: fileContent,
      invoice_filename: filename,
      invoice_content_type: contentType
    };

    // Send via EmailJS API
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://rejuvenators.com.au'
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
      console.error('❌ EmailJS error:', errorText);
      throw new Error(`EmailJS error: ${errorText}`);
    }

    console.log('✅ Invoice sent to Xero successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invoice sent to Xero successfully'
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
