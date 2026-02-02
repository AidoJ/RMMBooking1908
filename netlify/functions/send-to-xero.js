const nodemailer = require('nodemailer');

/**
 * Send Therapist Invoice to Xero via Gmail SMTP
 *
 * Required environment variables:
 * - XERO_INBOX_EMAIL: The Xero inbox email address
 * - GMAIL_USER: Gmail address for sending
 * - GMAIL_APP_PASSWORD: Gmail App Password
 */

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
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!xeroEmail) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'XERO_INBOX_EMAIL not configured' }),
      };
    }

    if (!gmailUser || !gmailAppPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gmail credentials not configured (GMAIL_USER, GMAIL_APP_PASSWORD)' }),
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
        fileContent = matches[2];

        if (contentType.includes('png')) fileExtension = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) fileExtension = 'jpg';
        else fileExtension = 'pdf';
      }
    }

    // Create filename
    const safeTherapistName = (therapist_name || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    const safeInvoiceNumber = (invoice_number || 'NA').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Invoice_${safeTherapistName}_${safeInvoiceNumber}.${fileExtension}`;

    console.log('📧 Sending invoice to Xero via Gmail:', {
      therapistName: therapist_name,
      invoiceNumber: invoice_number,
      xeroEmail: xeroEmail.substring(0, 15) + '...',
      filename: filename,
      contentType: contentType,
      fileSizeKB: Math.round(fileContent.length * 0.75 / 1024)
    });

    // Create Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });

    // Send email
    const result = await transporter.sendMail({
      from: `"Rejuvenators" <${gmailUser}>`,
      to: xeroEmail,
      subject: `Invoice - ${therapist_name} - ${invoice_number || 'N/A'}`,
      text: `Therapist: ${therapist_name}
Invoice Number: ${invoice_number || 'N/A'}
Invoice Date: ${invoice_date || 'N/A'}
Week Period: ${week_period || 'N/A'}
Total Amount: $${parseFloat(total_amount || 0).toFixed(2)}`,
      attachments: [
        {
          filename: filename,
          content: fileContent,
          encoding: 'base64',
          contentType: contentType
        }
      ]
    });

    console.log('✅ Invoice sent to Xero:', result.messageId);

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
