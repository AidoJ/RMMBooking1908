const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Centralized email configuration
const EMAIL_CONFIG = {
  adminNotificationEmail: 'info@rejuvenators.com',
  businessContactEmail: 'info@rejuvenators.com',
  businessName: 'Rejuvenators Mobile Massage',
  businessPhone: '1300 302 542'
};

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    let bookingId, response, customerMessage;
    
    // Handle both JSON and form data
    if (event.headers['content-type']?.includes('application/json')) {
      const parsed = JSON.parse(event.body);
      bookingId = parsed.bookingId;
      response = parsed.response;
      customerMessage = parsed.customerMessage;
    } else {
      // Handle form data
      const params = new URLSearchParams(event.body);
      bookingId = params.get('bookingId');
      response = params.get('response');
      customerMessage = params.get('customerMessage');
    }
    
    if (!bookingId || !response) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking ID and response are required' })
      };
    }

    // Validate response
    if (!['accept', 'decline'].includes(response)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Response must be "accept" or "decline"' })
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch booking data
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Update booking status
    const newStatus = response === 'accept' ? 'quote_accepted' : 'quote_declined';
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (response === 'accept') {
      updateData.quote_accepted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (updateError) {
      throw updateError;
    }

    // Log admin notification (Phase 2 will add actual email sending)
    await logAdminNotification(booking, response, customerMessage);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/html'
      },
      body: generateResponsePage(booking, response)
    };

  } catch (error) {
    console.error('Error processing quote response:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'text/html'
      },
      body: generateErrorPage(error.message)
    };
  }
};

async function logAdminNotification(booking, response, customerMessage) {
  const subject = `Quote ${response.toUpperCase()}: ${booking.business_name || 'Quote Request'}`;
  
  const notificationData = {
    to: EMAIL_CONFIG.adminNotificationEmail,
    subject: subject,
    quoteId: booking.id.substring(0, 8).toUpperCase(),
    company: booking.business_name || 'Not specified',
    contact: booking.corporate_contact_name,
    email: booking.corporate_contact_email,
    phone: booking.corporate_contact_phone,
    eventDate: new Date(booking.booking_time).toLocaleDateString('en-AU'),
    amount: booking.price,
    response: response,
    customerMessage: customerMessage,
    timestamp: new Date().toISOString()
  };

  // Log the notification - Phase 2 will implement actual email sending
  console.log('📧 Admin Notification Required:', JSON.stringify(notificationData, null, 2));
  
  // TODO Phase 2: Send actual email via EmailJS or preferred service
  return notificationData;
}

function generateResponsePage(booking, response) {
  const isAccepted = response === 'accept';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Quote ${response.charAt(0).toUpperCase() + response.slice(1)} - ${EMAIL_CONFIG.businessName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Helvetica', Arial, sans-serif;
          color: #333;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: #007e8c;
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .header p {
          margin: 5px 0 0 0;
          font-style: italic;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .status {
          font-size: 32px;
          margin-bottom: 10px;
        }
        .status-text {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .accepted { color: #52c41a; }
        .declined { color: #f5222d; }
        .details {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 8px;
          margin: 30px 0;
          text-align: left;
        }
        .details h3 {
          margin-top: 0;
          color: #007e8c;
        }
        .detail-row {
          margin: 10px 0;
        }
        .detail-row strong {
          display: inline-block;
          min-width: 120px;
        }
        .next-steps {
          background: ${isAccepted ? '#f6ffed' : '#fff2f0'};
          border: 2px solid ${isAccepted ? '#b7eb8f' : '#ffccc7'};
          padding: 25px;
          border-radius: 8px;
          margin: 30px 0;
        }
        .next-steps h3 {
          margin-top: 0;
          color: ${isAccepted ? '#389e0d' : '#cf1322'};
        }
        .next-steps ul {
          margin: 15px 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
        }
        .contact-info {
          background: #007e8c;
          color: white;
          padding: 25px;
          text-align: center;
          margin-top: 30px;
        }
        .contact-info p {
          margin: 5px 0;
        }
        @media (max-width: 600px) {
          body { padding: 10px; }
          .content { padding: 30px 20px; }
          .details, .next-steps { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${EMAIL_CONFIG.businessName.toUpperCase()}</h1>
          <p>Mobile Massage</p>
        </div>
        
        <div class="content">
          <div class="status ${isAccepted ? 'accepted' : 'declined'}">
            ${isAccepted ? '✅' : '❌'}
          </div>
          <div class="status-text ${isAccepted ? 'accepted' : 'declined'}">
            Quote ${isAccepted ? 'Accepted!' : 'Declined'}
          </div>
          
          <div class="details">
            <h3>Quote Details</h3>
            <div class="detail-row">
              <strong>Quote ID:</strong> ${booking.id.substring(0, 8).toUpperCase()}
            </div>
            <div class="detail-row">
              <strong>Company:</strong> ${booking.business_name || 'Not specified'}
            </div>
            <div class="detail-row">
              <strong>Contact:</strong> ${booking.corporate_contact_name}
            </div>
            <div class="detail-row">
              <strong>Amount:</strong> $${booking.price}
            </div>
            <div class="detail-row">
              <strong>Event Date:</strong> ${new Date(booking.booking_time).toLocaleDateString('en-AU')}
            </div>
          </div>
          
          <div class="next-steps">
            <h3>What happens next?</h3>
            ${isAccepted ? `
              <p>🎉 <strong>Thank you for accepting our quote!</strong> Our team has been notified and will contact you within 24 hours to:</p>
              <ul>
                <li>Confirm final details and logistics</li>
                <li>Process payment arrangements</li>
                <li>Assign your therapist team</li>
                <li>Send confirmation with therapist details</li>
              </ul>
              <p>We look forward to providing an exceptional massage experience for your team!</p>
            ` : `
              <p><strong>We understand this quote wasn't suitable for your needs.</strong> Our team has been notified and may reach out to discuss alternative options.</p>
              <p>If you have specific feedback about the quote or would like to discuss different arrangements, please don't hesitate to contact us directly.</p>
              <p>Thank you for considering ${EMAIL_CONFIG.businessName} for your corporate wellness needs.</p>
            `}
          </div>
        </div>
        
        <div class="contact-info">
          <p><strong>Questions or need immediate assistance?</strong></p>
          <p>📧 ${EMAIL_CONFIG.businessContactEmail} | 📞 ${EMAIL_CONFIG.businessPhone}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateErrorPage(errorMessage) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Error - ${EMAIL_CONFIG.businessName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .error { color: #f5222d; }
        h1 { color: #007e8c; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${EMAIL_CONFIG.businessName}</h1>
        <div class="error">
          <h2>⚠️ Something went wrong</h2>
          <p>${errorMessage}</p>
          <p>Please contact us at ${EMAIL_CONFIG.businessContactEmail} or ${EMAIL_CONFIG.businessPhone} if you continue to experience issues.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}