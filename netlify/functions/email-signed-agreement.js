const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

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
    // STEP 2: Download PDF from Supabase Storage
    // ===================================================
    const fileName = `signed-agreements/${registrationId}.pdf`;

    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('therapist-documents')
      .download(fileName);

    if (downloadError) throw downloadError;

    const pdfBuffer = await pdfData.arrayBuffer();
    console.log(`✓ PDF downloaded (${pdfBuffer.byteLength} bytes)`);

    // ===================================================
    // STEP 3: Send Email with Attachment
    // ===================================================

    // Configure email transporter (using environment variables)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Rejuvenators Mobile Massage" <${process.env.SMTP_USER}>`,
      to: registration.email,
      subject: 'Your Signed Independent Contractor Agreement - Rejuvenators',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #007e8c; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">REJUVENATORS<sup>®</sup></h1>
            <p style="margin: 5px 0 0 0; font-style: italic;">Mobile Massage Therapy</p>
          </div>

          <div style="padding: 30px; background: #f5f7fa;">
            <h2 style="color: #007e8c;">Thank You for Your Registration!</h2>

            <p>Dear ${registration.first_name},</p>

            <p>Thank you for completing your Independent Contractor registration with Rejuvenators Mobile Massage.</p>

            <p>Your signed agreement is attached to this email for your records. Please keep this document safe as it contains:</p>

            <ul>
              <li>Your complete registration details</li>
              <li>The full Independent Contractor Agreement</li>
              <li>Your digital signature and acknowledgements</li>
            </ul>

            <h3 style="color: #007e8c; margin-top: 30px;">Next Steps:</h3>

            <ol>
              <li><strong>Review Period:</strong> Our team will review your application within 5-7 business days</li>
              <li><strong>Interview:</strong> If approved, we'll contact you to schedule an interview</li>
              <li><strong>Onboarding:</strong> Upon final approval, you'll receive login credentials for the Therapist App</li>
            </ol>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #007e8c;">
              <h4 style="margin: 0 0 10px 0; color: #007e8c;">Registration Summary</h4>
              <p style="margin: 5px 0;"><strong>Registration ID:</strong> ${registration.id.substring(0, 8).toUpperCase()}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${formatDate(registration.submitted_at)}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${registration.email}</p>
            </div>

            <p>If you have any questions, please don't hesitate to contact us:</p>
            <ul>
              <li>Email: <a href="mailto:recruitment@rejuvenators.com" style="color: #007e8c;">recruitment@rejuvenators.com</a></li>
              <li>Phone: 1300 REJUVENATORS</li>
            </ul>

            <p>We look forward to potentially welcoming you to our team!</p>

            <p style="margin-top: 30px;">Best regards,<br>
            <strong>The Rejuvenators Team</strong></p>
          </div>

          <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">This is an automated email. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Rejuvenators Mobile Massage. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Rejuvenators-Agreement-${registration.last_name}-${registration.id.substring(0, 8)}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

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
