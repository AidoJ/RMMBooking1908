const nodemailer = require('nodemailer');

/**
 * Send Therapist Invoice to Xero
 *
 * Uses Nodemailer with Gmail SMTP to send invoices with attachments.
 * EmailJS has a 50KB limit on variables, which is too small for PDF attachments.
 *
 * Required environment variables:
 * - XERO_INBOX_EMAIL: The Xero inbox email address
 * - GMAIL_USER: Gmail address for sending
 * - GMAIL_APP_PASSWORD: Gmail App Password (not regular password)
 */

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
      invoice_file_base64,
      week_period
    } = JSON.parse(event.body);

    // Get environment variables
    const xeroEmail = process.env.XERO_INBOX_EMAIL;
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!xeroEmail) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'XERO_INBOX_EMAIL not configured in Netlify environment variables.' }),
      };
    }

    if (!gmailUser || !gmailAppPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to Netlify environment variables.',
          setup_instructions: 'Create a Gmail App Password at: https://myaccount.google.com/apppasswords'
        }),
      };
    }

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

    // Parse the base64 data URL to extract content type and raw data
    let fileContent = invoice_file_base64;
    let contentType = 'application/pdf';
    let fileExtension = 'pdf';

    if (invoice_file_base64.startsWith('data:')) {
      const matches = invoice_file_base64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        fileContent = matches[2];

        if (contentType.includes('pdf')) {
          fileExtension = 'pdf';
        } else if (contentType.includes('png')) {
          fileExtension = 'png';
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          fileExtension = 'jpg';
        }
      }
    }

    // Create safe filename
    const safeTherapistName = (therapist_name || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    const safeInvoiceNumber = (invoice_number || 'NA').replace(/[^a-zA-Z0-9]/g, '');
    const filename = `Invoice_${safeTherapistName}_${safeInvoiceNumber}.${fileExtension}`;

    console.log('📧 Sending invoice to Xero:', {
      therapistName: therapist_name,
      invoiceNumber: invoice_number,
      totalAmount: total_amount,
      xeroEmail: xeroEmail.substring(0, 15) + '...',
      contentType: contentType,
      filename: filename,
      fileSizeKB: Math.round(fileContent.length * 0.75 / 1024) // Approx decoded size
    });

    // Create Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });

    // Prepare email
    const mailOptions = {
      from: `"Rejuvenators Mobile Massage" <${gmailUser}>`,
      to: xeroEmail,
      subject: `Therapist Invoice - ${therapist_name} - ${invoice_number || 'N/A'}`,
      text: `Therapist Invoice Submission

Therapist: ${therapist_name}
Invoice Number: ${invoice_number || 'N/A'}
Invoice Date: ${invoice_date || 'N/A'}
Week Period: ${week_period || 'N/A'}
Total Amount: $${parseFloat(total_amount || 0).toFixed(2)}

Please find the invoice attached.

---
Sent from Rejuvenators Admin Portal`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a3a5c; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Therapist Invoice</h2>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Therapist:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${therapist_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Invoice Number:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${invoice_number || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Invoice Date:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${invoice_date || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Week Period:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${week_period || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px;"><strong>Total Amount:</strong></td>
                <td style="padding: 10px; font-weight: bold; color: #007e8c;">$${parseFloat(total_amount || 0).toFixed(2)}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; color: #666;">Please find the invoice attached.</p>
          </div>
          <div style="background: #eee; padding: 10px; text-align: center; font-size: 12px; color: #666;">
            Sent from Rejuvenators Admin Portal
          </div>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: fileContent,
          encoding: 'base64',
          contentType: contentType
        }
      ]
    };

    // Send email
    const result = await transporter.sendMail(mailOptions);

    console.log('✅ Invoice sent to Xero successfully:', result.messageId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Invoice sent to Xero successfully',
        messageId: result.messageId,
        details: {
          therapist: therapist_name,
          invoice_number: invoice_number,
          filename: filename
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
