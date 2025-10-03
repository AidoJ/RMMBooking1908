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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let quoteId, bookingId, response, customerMessage;

    if (event.httpMethod === 'GET') {
      // Handle GET requests (URL parameters from email links)
      const params = event.queryStringParameters || {};
      quoteId = params.quote_id;  // New: quote-based acceptance
      bookingId = params.id;      // Old: single booking acceptance (for backwards compatibility)
      response = params.action;
      customerMessage = params.message || '';
    } else {
      // Handle POST requests - both JSON and form data
      if (event.headers['content-type']?.includes('application/json')) {
        const parsed = JSON.parse(event.body);
        quoteId = parsed.quoteId;
        bookingId = parsed.bookingId;
        response = parsed.response;
        customerMessage = parsed.customerMessage;
      } else {
        // Handle form data
        const params = new URLSearchParams(event.body);
        quoteId = params.get('quoteId');
        bookingId = params.get('bookingId');
        response = params.get('response');
        customerMessage = params.get('customerMessage');
      }
    }

    if ((!quoteId && !bookingId) || !response) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Quote ID (or Booking ID) and response are required' })
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

    let booking, bookings, quote;

    // Handle quote-based response (multiple bookings) vs single booking response
    if (quoteId) {
      // NEW: Quote-based response - handle multiple bookings
      console.log(`Processing quote-based response for quote: ${quoteId}`);

      // Get quote data first
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError || !quoteData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Quote not found' })
        };
      }

      quote = quoteData;

      // Check if quote has already been responded to
      if (quote.status === 'accepted' || (quote.notes && quote.notes.includes('Quote declined by client'))) {
        // Get first booking for display purposes
        const { data: firstBooking } = await supabase
          .from('bookings')
          .select('*')
          .eq('parent_quote_id', quoteId)
          .limit(1)
          .single();

        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'text/html'
          },
          body: generateQuoteClosedPage(firstBooking || { id: quoteId, status: quote.status })
        };
      }

      // Get all bookings for this quote
      const { data: quoteBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('parent_quote_id', quoteId);

      if (bookingsError || !quoteBookings || quoteBookings.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'No bookings found for this quote' })
        };
      }

      bookings = quoteBookings;
      booking = quoteBookings[0]; // Use first booking for display

      // Update quote status
      const quoteNewStatus = response === 'accept' ? 'accepted' : 'sent'; // Keep as 'sent' for declined to avoid constraint violation
      const updateData = { status: quoteNewStatus };

      // Only set quote_accepted_at for accepted quotes (no declined_at column exists)
      if (response === 'accept') {
        updateData.quote_accepted_at = new Date().toISOString();
      } else {
        // For declined quotes, we'll track the decline in notes or a separate field
        updateData.notes = (quote.notes || '') + `\n[${new Date().toLocaleDateString()}] Quote declined by client`;
      }

      const { error: quoteUpdateError } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quoteId);

      if (quoteUpdateError) {
        throw quoteUpdateError;
      }

      // Update all related bookings
      const bookingNewStatus = response === 'accept' ? 'confirmed' : 'declined';
      const bookingUpdateData = {
        status: bookingNewStatus,
        updated_at: new Date().toISOString()
      };

      // Note: No specific timestamp columns for confirmed/declined status
      // Just using updated_at to track the change

      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update(bookingUpdateData)
        .eq('parent_quote_id', quoteId);

      if (bookingUpdateError) {
        throw bookingUpdateError;
      }

      console.log(`Updated quote ${quoteId} to ${quoteNewStatus} and ${bookings.length} bookings to ${bookingNewStatus}`);

    } else {
      // OLD: Single booking response (backwards compatibility)
      console.log(`Processing single booking response for booking: ${bookingId}`);

      const { data: singleBooking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error || !singleBooking) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Booking not found' })
        };
      }

      booking = singleBooking;

      // Check if booking has already been responded to
      if (booking.status === 'confirmed' || booking.status === 'declined') {
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'text/html'
          },
          body: generateQuoteClosedPage(booking)
        };
      }

      // Update single booking status
      const newStatus = response === 'accept' ? 'confirmed' : 'declined';
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Add a note to indicate this was a quote response
      const currentNotes = booking.notes || '';
      const responseNote = `\n[${new Date().toLocaleDateString()}] Quote ${response}ed via email`;
      updateData.notes = currentNotes + responseNote;

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (updateError) {
        throw updateError;
      }
    }

    // Return success response with admin notification trigger
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/html'
      },
      body: generateResponsePage(booking, response, true, bookings?.length, quoteId ? quote : null)  // Pass quote data for quote-based responses
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

async function sendAdminNotification(booking, response, customerMessage) {
  try {
    console.log('🔧 Setting up admin notification email...');
    
    // EmailJS configuration
    const EMAILJS_SERVICE_ID = 'service_puww2kb';
    const EMAILJS_TEMPLATE_ID = 'admin_quote_notification';
    const EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';
    
    console.log('📋 EmailJS Config:', {
      serviceId: EMAILJS_SERVICE_ID,
      templateId: EMAILJS_TEMPLATE_ID,
      publicKey: EMAILJS_PUBLIC_KEY
    });

    // Prepare template variables based on response type
    const isAccepted = response === 'accept';
    const responseAction = isAccepted ? 'Accepted' : 'Declined';
    const responseActionLower = isAccepted ? 'accepted' : 'declined';
    const responseIcon = isAccepted ? '✅' : '❌';
    
    // Color scheme based on response
    const headerColor = isAccepted ? '#52c41a' : '#f5222d';
    const bannerColor = isAccepted ? '#389e0d' : '#cf1322';
    const nextStepsBg = isAccepted ? '#f6ffed' : '#fff2f0';
    const nextStepsBorder = isAccepted ? '#b7eb8f' : '#ffccc7';
    const nextStepsColor = isAccepted ? '#389e0d' : '#cf1322';
    const nextStepsIcon = isAccepted ? '🎉' : '💭';
    
    // Next steps content
    const urgencyText = isAccepted 
      ? '🎉 Customer Accepted Quote' 
      : '💭 Customer Declined Quote';
    const actionRequired = isAccepted 
      ? 'Contact Customer to Finalize' 
      : 'Follow Up if Appropriate';
    const nextStepsContent = isAccepted 
      ? 'Contact the customer within 24 hours to confirm details, process payment, and assign therapists.'
      : 'Consider reaching out to understand their concerns or offer alternative solutions if appropriate.';

    // Generate quote reference - use actual quote ID if available
    const actualQuoteId = quoteData ? quoteData.id : (booking.parent_quote_id || booking.id);
    const quoteReference = actualQuoteId;
    
    // Format timestamp
    const responseTimestamp = new Date().toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Format event date
    const eventDate = new Date(booking.booking_time).toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Prepare EmailJS template parameters
    const templateParams = {
      // Basic info
      to_email: EMAIL_CONFIG.adminNotificationEmail,
      to_name: 'Admin Team',
      from_name: 'Rejuvenators Mobile Massage',
      reply_to: EMAIL_CONFIG.businessContactEmail,
      
      // Response data
      response_action: responseAction,
      response_action_lower: responseActionLower,
      response_icon: responseIcon,
      response_timestamp: responseTimestamp,
      
      // Quote information
      quote_reference: quoteReference,
      business_name: booking.business_name || 'Not specified',
      contact_name: booking.corporate_contact_name || 'Not specified',
      contact_email: booking.corporate_contact_email || 'Not provided',
      contact_phone: booking.corporate_contact_phone || 'Not provided',
      event_date: eventDate,
      quote_amount: `$${(booking.price || 0).toFixed(2)}`,
      
      // Styling variables
      header_color: headerColor,
      banner_color: bannerColor,
      urgency_text: urgencyText,
      action_required: actionRequired,
      next_steps_bg: nextStepsBg,
      next_steps_border: nextStepsBorder,
      next_steps_color: nextStepsColor,
      next_steps_icon: nextStepsIcon,
      next_steps_content: nextStepsContent
    };

    console.log('📝 Template parameters prepared:', {
      to_email: templateParams.to_email,
      response_action: templateParams.response_action,
      business_name: templateParams.business_name,
      quote_reference: templateParams.quote_reference
    });

    // Send email via EmailJS API
    const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    });

    if (emailjsResponse.ok) {
      console.log('✅ Admin notification email sent successfully');
      return { success: true };
    } else {
      const errorText = await emailjsResponse.text();
      console.error('❌ Failed to send admin notification email:', errorText);
      return { success: false, error: errorText };
    }

  } catch (error) {
    console.error('❌ Error sending admin notification email:', error);
    return { success: false, error: error.message };
  }
}

function generateResponsePage(booking, response, shouldSendAdminEmail = false, bookingCount = 1, quoteData = null) {
  const isAccepted = response === 'accept';

  // Use quote data for quote-based responses, otherwise use booking data
  const displayData = quoteData || booking;
  const displayAmount = quoteData ? quoteData.total_amount : booking.price;
  const displayReference = quoteData ? quoteData.id : booking.id;
  const displayCompany = quoteData ? (quoteData.company_name || quoteData.customer_name) : (booking.business_name || 'Not specified');
  
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
              <strong>Quote ID:</strong> ${displayReference}
            </div>
            <div class="detail-row">
              <strong>Company:</strong> ${displayCompany}
            </div>
            <div class="detail-row">
              <strong>Contact:</strong> ${quoteData ? (quoteData.corporate_contact_name || quoteData.customer_name) : booking.corporate_contact_name}
            </div>
            <div class="detail-row">
              <strong>Total Amount:</strong> $${displayAmount.toFixed(2)}
            </div>
            <div class="detail-row">
              <strong>Event Date:</strong> ${new Date(booking.booking_time).toLocaleDateString('en-AU')}
            </div>
            ${bookingCount > 1 ? `
            <div class="detail-row">
              <strong>Bookings:</strong> ${bookingCount} therapist sessions
            </div>
            ` : ''}
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
      
      ${shouldSendAdminEmail ? `
      <!-- EmailJS Client-side Admin Notification -->
      <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
      <script type="text/javascript">
        (function(){
          emailjs.init('qfM_qA664E4JddSMN'); // Your EmailJS public key
          
          // Admin notification data
          const bookingData = ${JSON.stringify(booking)};
          const quoteData = ${JSON.stringify(quoteData)};
          const response = '${response}';
          const isAccepted = response === 'accept';
          
          // Prepare template variables based on response type
          const responseAction = isAccepted ? 'Accepted' : 'Declined';
          const responseActionLower = isAccepted ? 'accepted' : 'declined';
          const responseIcon = isAccepted ? '✅' : '❌';
          
          // Color scheme based on response
          const headerColor = isAccepted ? '#52c41a' : '#f5222d';
          const bannerColor = isAccepted ? '#389e0d' : '#cf1322';
          const nextStepsBg = isAccepted ? '#f6ffed' : '#fff2f0';
          const nextStepsBorder = isAccepted ? '#b7eb8f' : '#ffccc7';
          const nextStepsColor = isAccepted ? '#389e0d' : '#cf1322';
          const nextStepsIcon = isAccepted ? '🎉' : '💭';
          
          // Next steps content
          const urgencyText = isAccepted ? '🎉 Customer Accepted Quote' : '💭 Customer Declined Quote';
          const actionRequired = isAccepted ? 'Contact Customer to Finalize' : 'Follow Up if Appropriate';
          const nextStepsContent = isAccepted 
            ? 'Contact the customer within 24 hours to confirm details, process payment, and assign therapists.'
            : 'Consider reaching out to understand their concerns or offer alternative solutions if appropriate.';
          
          // Generate quote reference and timestamps - use actual quote ID
          const actualQuoteId = quoteData ? quoteData.id : (bookingData.parent_quote_id || bookingData.id);
          const quoteReference = actualQuoteId;
          const responseTimestamp = new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          const eventDate = new Date(bookingData.booking_time).toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          
          // Prepare EmailJS template parameters
          const templateParams = {
            to_email: '${EMAIL_CONFIG.adminNotificationEmail}',
            to_name: 'Admin Team',
            from_name: 'Rejuvenators Mobile Massage',
            reply_to: '${EMAIL_CONFIG.businessContactEmail}',
            response_action: responseAction,
            response_action_lower: responseActionLower,
            response_icon: responseIcon,
            response_timestamp: responseTimestamp,
            quote_reference: quoteReference,
            business_name: bookingData.business_name || 'Not specified',
            contact_name: bookingData.corporate_contact_name || 'Not specified',
            contact_email: bookingData.corporate_contact_email || 'Not provided',
            contact_phone: bookingData.corporate_contact_phone || 'Not provided',
            event_date: eventDate,
            quote_amount: '$' + (quoteData ? quoteData.total_amount : bookingData.price || 0).toFixed(2),
            header_color: headerColor,
            banner_color: bannerColor,
            urgency_text: urgencyText,
            action_required: actionRequired,
            next_steps_bg: nextStepsBg,
            next_steps_border: nextStepsBorder,
            next_steps_color: nextStepsColor,
            next_steps_icon: nextStepsIcon,
            next_steps_content: nextStepsContent
          };
          
          // Send admin notification email
          console.log('📧 Sending admin notification from client-side...');
          emailjs.send('service_puww2kb', 'admin_quote_notification', templateParams)
            .then(function(response) {
              console.log('✅ Admin notification sent successfully:', response);
            })
            .catch(function(error) {
              console.error('❌ Failed to send admin notification:', error);
            });
        })();
      </script>
      ` : ''}
    </body>
    </html>
  `;
}

function generateQuoteClosedPage(booking) {
  const isAccepted = booking.status === 'confirmed' || booking.status === 'accepted';
  const isDeclined = booking.notes && booking.notes.includes('Quote declined by client');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Quote Already Responded - ${EMAIL_CONFIG.businessName}</title>
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
          color: #fa8c16;
        }
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
        .notice {
          background: #fff7e6;
          border: 2px solid #ffd666;
          padding: 25px;
          border-radius: 8px;
          margin: 30px 0;
        }
        .notice h3 {
          margin-top: 0;
          color: #d48806;
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
          .details, .notice { padding: 20px; }
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
          <div class="status">
            ⚠️
          </div>
          <div class="status-text">
            Quote Already Responded
          </div>
          
          <div class="details">
            <h3>Quote Details</h3>
            <div class="detail-row">
              <strong>Quote ID:</strong> ${booking.parent_quote_id || booking.id}
            </div>
            <div class="detail-row">
              <strong>Company:</strong> ${booking.business_name || 'Not specified'}
            </div>
            <div class="detail-row">
              <strong>Current Status:</strong> ${isAccepted ? '✅ Accepted' : (isDeclined ? '❌ Declined' : '📧 Sent')}
            </div>
            <div class="detail-row">
              <strong>Amount:</strong> $${booking.price}
            </div>
          </div>
          
          <div class="notice">
            <h3>Quote is Closed</h3>
            <p><strong>This quote has already been ${isAccepted ? 'accepted' : (isDeclined ? 'declined' : 'responded to')}.</strong></p>
            ${isAccepted ? 
              '<p>Our team is processing your accepted quote and will contact you shortly with next steps.</p>' :
              (isDeclined ? 
                '<p>This quote was previously declined. If you would like to reconsider or discuss alternative options, please contact us directly.</p>' :
                '<p>This quote has already been processed. If you need assistance, please contact us directly.</p>'
              )
            }
            <p>If you need to make changes or have questions about this quote, please contact us using the information below and reference your quote ID.</p>
          </div>
        </div>
        
        <div class="contact-info">
          <p><strong>Need assistance or want to reopen this quote?</strong></p>
          <p>📧 ${EMAIL_CONFIG.businessContactEmail} | 📞 ${EMAIL_CONFIG.businessPhone}</p>
          <p>Please reference Quote ID: ${booking.parent_quote_id || booking.id}</p>
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