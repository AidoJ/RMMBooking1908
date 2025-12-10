const { createClient } = require('@supabase/supabase-js');
const { getLocalDate, getLocalTime, getShortDate } = require('./utils/timezoneHelpers');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Parse URL parameters
    const params = event.queryStringParameters || {};
    const bookingId = params.booking_id;
    const action = params.action; // 'accept' or 'decline'
    const therapistId = params.therapist_id;

    console.log('📱 Therapist response received:', { bookingId, action, therapistId });

    if (!bookingId || !action || !therapistId) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Missing required parameters')
      };
    }

    if (!['accept', 'decline'].includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Invalid action. Must be accept or decline.')
      };
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, services(*), therapist_profiles(*)')
      .eq('booking_id', bookingId)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Booking not found')
      };
    }

    // Get therapist details
    const { data: therapist, error: therapistError } = await supabase
      .from('therapist_profiles')
      .select('*')
      .eq('id', therapistId)
      .single();

    if (therapistError || !therapist) {
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Therapist not found')
      };
    }

    // Check if booking has already been responded to
    if (booking.status === 'confirmed' || booking.status === 'declined') {
      return {
        statusCode: 200,
        headers,
        body: generateAlreadyRespondedPage(booking, action)
      };
    }

    // Process the response
    if (action === 'accept') {
      await handleAccept(booking, therapist);
    } else {
      await handleDecline(booking, therapist);
    }

    // Return success page
    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(booking, therapist, action)
    };

  } catch (error) {
    console.error('❌ Error processing therapist response:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return {
      statusCode: 500,
      headers,
      body: generateErrorPage(`An error occurred: ${error.message}`)
    };
  }
};

async function handleAccept(booking, therapist) {
  console.log('✅ [START] Processing acceptance for booking:', booking.booking_id);
  console.log('📊 Booking status:', booking.status);
  console.log('👤 Therapist:', therapist.first_name, therapist.last_name, therapist.id);
  
  // CRITICAL: Double-check booking status before updating to prevent race conditions
  console.log('🔍 [STEP 1] Checking current booking status...');
  const { data: currentBooking, error: checkError } = await supabase
    .from('bookings')
    .select('status, therapist_response_time')
    .eq('booking_id', booking.booking_id)
    .single();

  if (checkError) {
    console.error('❌ Error checking current booking status:', checkError);
    throw new Error('Failed to verify booking status: ' + checkError.message);
  }

  console.log('📊 Current booking status:', currentBooking.status);
  console.log('⏰ Current response time:', currentBooking.therapist_response_time);

  if (currentBooking.status === 'confirmed') {
    console.log('⚠️ Booking already confirmed, skipping update');
    return;
  }

  if (currentBooking.status !== 'requested' && currentBooking.status !== 'timeout_reassigned' && currentBooking.status !== 'seeking_alternate') {
    console.error('❌ Invalid booking status for acceptance:', currentBooking.status);
    throw new Error('Booking cannot be accepted in current status: ' + currentBooking.status);
  }

  // Update booking status
  console.log('🔄 [STEP 2] Updating booking status to confirmed...');
  const updateData = {
    status: 'confirmed',
    therapist_id: therapist.id,
    therapist_response_time: new Date().toISOString(),
    responding_therapist_id: therapist.id,
    updated_at: new Date().toISOString()
  };
  console.log('📝 Update data:', JSON.stringify(updateData, null, 2));

  const { data: updateResult, error: updateError } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('booking_id', booking.booking_id)
    .eq('status', currentBooking.status) // Additional safety check
    .select();

  if (updateError) {
    console.error('❌ Database update failed:', updateError);
    console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
    throw new Error('Failed to update booking status: ' + updateError.message);
  }

  console.log('✅ [STEP 2 COMPLETE] Booking status updated successfully');
  console.log('📊 Update result:', JSON.stringify(updateResult, null, 2));

  // Add status history
  console.log('📝 [STEP 3] Adding status history...');
  try {
    await addStatusHistory(booking.id, 'confirmed', therapist.id, 'Accepted via SMS link');
    console.log('✅ [STEP 3 COMPLETE] Status history added');
  } catch (historyError) {
    console.error('⚠️ Failed to add status history (non-critical):', historyError);
  }

  // Send confirmation SMS to therapist (non-blocking)
  console.log('📱 [STEP 4] Sending SMS notifications...');
  try {
    await sendConfirmationSMS(therapist.phone, booking, therapist, 'accept');
    console.log('✅ Therapist SMS sent');
  } catch (smsError) {
    console.error('⚠️ Failed to send therapist SMS (non-critical):', smsError);
  }

  // Send SMS to customer (non-blocking)
  if (booking.customer_phone) {
    try {
      await sendCustomerNotification(booking.customer_phone, booking, therapist, 'accept');
      console.log('✅ Customer SMS sent');
    } catch (smsError) {
      console.error('⚠️ Failed to send customer SMS (non-critical):', smsError);
    }
  }

  console.log('✅ [COMPLETE] Booking accepted successfully');
}

async function handleDecline(booking, therapist) {
  console.log('❌ Processing decline for booking:', booking.booking_id);
  
  // Update booking status
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'declined',
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.booking_id);

  if (updateError) {
    throw new Error('Failed to update booking status');
  }

  // Add status history
  await addStatusHistory(booking.id, 'declined', therapist.id, 'Declined via SMS link');

  // Send confirmation SMS to therapist
  await sendConfirmationSMS(therapist.phone, booking, therapist, 'decline');

  // Send SMS to customer
  if (booking.customer_phone) {
    await sendCustomerNotification(booking.customer_phone, booking, therapist, 'decline');
  }

  console.log('❌ Booking declined successfully');
}

async function sendConfirmationSMS(therapistPhone, booking, therapist, action) {
  const isAccept = action === 'accept';

  // Convert UTC time to local timezone for display
  const timezone = booking.booking_timezone || 'Australia/Brisbane';

  const message = isAccept ?
    `✅ BOOKING CONFIRMED!

You've accepted booking ${booking.booking_id}
Client: ${booking.first_name} ${booking.last_name}
Date: ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}
Fee: $${booking.therapist_fee || 'TBD'}

Client will be notified. Check email for full details.
- Rejuvenators` :
    `📝 BOOKING DECLINED

You've declined booking ${booking.booking_id}. The client has been notified.
- Rejuvenators`;

  await sendSMS(therapistPhone, message);
}

async function sendCustomerNotification(customerPhone, booking, therapist, action) {
  const isAccept = action === 'accept';

  // Convert UTC time to local timezone for display
  const timezone = booking.booking_timezone || 'Australia/Brisbane';

  const message = isAccept ?
    `🎉 BOOKING CONFIRMED!

${therapist.first_name} ${therapist.last_name} has accepted your massage booking for ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}.

Check your email for full details!
- Rejuvenators` :
    `❌ BOOKING UPDATE

Unfortunately, your therapist declined booking ${booking.booking_id}. We're looking for alternatives and will update you soon.
- Rejuvenators`;

  await sendSMS(customerPhone, message);
}

async function sendSMS(phoneNumber, message) {
  try {
    const response = await fetch('https://booking.rejuvenators.com/.netlify/functions/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber, message: message })
    });
    
    const result = await response.json();
    console.log('📱 SMS sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return { success: false, error: error.message };
  }
}

async function addStatusHistory(bookingId, status, userId, notes) {
  try {
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        notes: notes || null
      });
    console.log('✅ Status history added');
  } catch (error) {
    console.error('❌ Error adding status history:', error);
  }
}

function generateSuccessPage(booking, therapist, action) {
  const isAccept = action === 'accept';
  const actionText = isAccept ? 'Accepted' : 'Declined';
  const actionIcon = isAccept ? '✅' : '❌';
  const actionColor = isAccept ? '#52c41a' : '#f5222d';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Booking ${actionText} - Rejuvenators</title>
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
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .status {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .status-text {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
          color: ${actionColor};
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
        .next-steps {
          background: ${isAccept ? '#f6ffed' : '#fff2f0'};
          border: 2px solid ${isAccept ? '#b7eb8f' : '#ffccc7'};
          padding: 25px;
          border-radius: 8px;
          margin: 30px 0;
        }
        .next-steps h3 {
          margin-top: 0;
          color: ${isAccept ? '#389e0d' : '#cf1322'};
        }
        .contact-info {
          background: #007e8c;
          color: white;
          padding: 25px;
          text-align: center;
          margin-top: 30px;
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
          <h1>REJUVENATORS</h1>
          <p>Mobile Massage</p>
        </div>
        
        <div class="content">
          <div class="status">${actionIcon}</div>
          <div class="status-text">Booking ${actionText}!</div>
          
          <div class="details">
            <h3>Booking Details</h3>
            <div class="detail-row">
              <strong>Booking ID:</strong> ${booking.booking_id}
            </div>
            <div class="detail-row">
              <strong>Client:</strong> ${booking.first_name} ${booking.last_name}
            </div>
            <div class="detail-row">
              <strong>Date:</strong> ${getLocalDate(booking.booking_time, booking.booking_timezone || 'Australia/Brisbane')}
            </div>
            <div class="detail-row">
              <strong>Time:</strong> ${getLocalTime(booking.booking_time, booking.booking_timezone || 'Australia/Brisbane')}
            </div>
            <div class="detail-row">
              <strong>Duration:</strong> ${booking.duration_minutes} minutes
            </div>
            <div class="detail-row">
              <strong>Fee:</strong> $${booking.therapist_fee || 'TBD'}
            </div>
          </div>
          
          <div class="next-steps">
            <h3>What happens next?</h3>
            ${isAccept ? `
              <p>🎉 <strong>Thank you for accepting this booking!</strong></p>
              <p>The client has been notified and will receive confirmation details.</p>
              <p>Check your email for full booking information and client details.</p>
            ` : `
              <p><strong>Booking declined successfully.</strong></p>
              <p>The client has been notified and we'll look for alternative therapists.</p>
              <p>Thank you for your quick response.</p>
            `}
          </div>
        </div>
        
        <div class="contact-info">
          <p><strong>Questions or need assistance?</strong></p>
          <p>📧 info@rejuvenators.com | 📞 1300 302 542</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateAlreadyRespondedPage(booking, action) {
  const isAccepted = booking.status === 'confirmed';
  const actionText = isAccepted ? 'accepted' : 'declined';
  const actionIcon = isAccepted ? '✅' : '❌';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Booking Already Responded - Rejuvenators</title>
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
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .status {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .status-text {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
          color: #fa8c16;
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>REJUVENATORS</h1>
          <p>Mobile Massage</p>
        </div>
        
        <div class="content">
          <div class="status">⚠️</div>
          <div class="status-text">Booking Already Responded</div>
          
          <div class="notice">
            <h3>Booking Status</h3>
            <p><strong>This booking has already been ${actionText}.</strong></p>
            <p>Booking ID: ${booking.booking_id}</p>
            <p>Current Status: ${actionIcon} ${actionText.toUpperCase()}</p>
            <p>If you need to make changes or have questions, please contact us directly.</p>
          </div>
        </div>
        
        <div class="contact-info">
          <p><strong>Need assistance?</strong></p>
          <p>📧 info@rejuvenators.com | 📞 1300 302 542</p>
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
      <title>Error - Rejuvenators</title>
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
        <h1>Rejuvenators</h1>
        <div class="error">
          <h2>⚠️ Something went wrong</h2>
          <p>${errorMessage}</p>
          <p>Please contact us at info@rejuvenators.com or 1300 302 542 if you continue to experience issues.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}






