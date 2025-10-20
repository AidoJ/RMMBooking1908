// therapist-status-update.js - Handle therapist status updates (On My Way, I've Arrived)
// Sends email and SMS notifications to customers

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const bookingId = params.get('booking');
    const status = params.get('status'); // 'on_my_way' or 'arrived'

    console.log('📱 Status update received:', { bookingId, status });

    if (!bookingId || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }

    if (status !== 'on_my_way' && status !== 'arrived') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid status' })
      };
    }

    // Get booking details with therapist and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services(name),
        therapist_profiles(first_name, last_name, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Booking not found' })
      };
    }

    const therapist = booking.therapist_profiles;
    const therapistName = `${therapist.first_name} ${therapist.last_name}`;
    const customerName = booking.booker_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Guest';
    const serviceName = booking.services?.name || 'Massage Service';

    // Send email notification to customer
    try {
      await sendCustomerStatusEmail(booking, therapistName, customerName, serviceName, status);
      console.log('✅ Customer email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending customer email:', emailError);
    }

    // Send SMS notification to customer
    if (booking.customer_phone) {
      try {
        await sendCustomerStatusSMS(booking, therapistName, status);
        console.log('✅ Customer SMS sent successfully');
      } catch (smsError) {
        console.error('❌ Error sending customer SMS:', smsError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${status === 'on_my_way' ? 'On My Way' : 'Arrived'} notification sent to customer`
      })
    };

  } catch (error) {
    console.error('❌ Error in status update handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

// Send email notification to customer
async function sendCustomerStatusEmail(booking, therapistName, customerName, serviceName, status) {
  try {
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
    const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

    const bookingTime = new Date(booking.booking_time);
    const dateFormatted = bookingTime.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = bookingTime.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let emailHtml = '';

    if (status === 'on_my_way') {
      emailHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Therapist is On The Way</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .booking-details { background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1890ff; }
        .therapist-info { background-color: #e6f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1890ff; text-align: center; }
        .alert-box { background-color: #fff7e6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #faad14; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .highlight { color: #1890ff; font-weight: bold; }
        .icon { font-size: 48px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">🚗</div>
            <h1>Your Therapist is On The Way!</h1>
            <p>${therapistName} is heading to your location now</p>
        </div>

        <div class="content">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Dear <span class="highlight">${customerName}</span>,
            </p>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Great news! Your therapist <strong>${therapistName}</strong> has just started their journey to your location
                and will arrive shortly for your scheduled massage session.
            </p>

            <div class="therapist-info">
                <div class="icon">👨‍⚕️</div>
                <h3 style="color: #1890ff; margin: 10px 0;">Your Therapist</h3>
                <p style="font-size: 20px; font-weight: bold; color: #1890ff; margin: 10px 0;">
                    ${therapistName}
                </p>
                <p style="color: #595959; margin: 5px 0;">is on the way</p>
            </div>

            <div class="booking-details">
                <h3 style="color: #1890ff; margin-top: 0;">📋 Your Booking Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0;"><strong>Booking ID:</strong></td><td style="padding: 8px 0;">${booking.booking_id}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Service:</strong></td><td style="padding: 8px 0;">${serviceName}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Scheduled Time:</strong></td><td style="padding: 8px 0;">${dateFormatted} at ${timeFormatted}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Location:</strong></td><td style="padding: 8px 0;">${booking.address}</td></tr>
                    ${booking.room_number ? `<tr><td style="padding: 8px 0;"><strong>Room:</strong></td><td style="padding: 8px 0;">${booking.room_number}</td></tr>` : ''}
                </table>
            </div>

            <div class="alert-box">
                <h3 style="color: #d48806; margin-top: 0;">⏰ Please Prepare</h3>
                <ul style="color: #8c6e00; margin: 10px 0; padding-left: 20px;">
                    <li>Please ensure someone is available to let the therapist in</li>
                    <li>Have a clean, quiet space ready for your massage</li>
                    <li>Clear any clutter from the treatment area</li>
                    <li>Your therapist will bring all necessary equipment</li>
                </ul>
            </div>

            <p style="font-size: 16px; line-height: 1.6; text-align: center; margin-top: 30px;">
                <strong>You will receive another notification when ${therapistName} arrives at your location.</strong>
            </p>
        </div>

        <div class="footer">
            <p>Thank you for choosing Rejuvenators Mobile Massage</p>
            <p>For support, call 1300 302542 or email info@rejuvenators.com</p>
        </div>
    </div>
</body>
</html>`;
    } else {
      // 'arrived' status
      emailHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Therapist Has Arrived</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .booking-details { background-color: #f6ffed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #52c41a; }
        .therapist-info { background-color: #d9f7be; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #52c41a; text-align: center; }
        .ready-box { background-color: #fffbe6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fadb14; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .highlight { color: #52c41a; font-weight: bold; }
        .icon { font-size: 48px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">🎉</div>
            <h1>Your Therapist Has Arrived!</h1>
            <p>${therapistName} is at your location</p>
        </div>

        <div class="content">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Dear <span class="highlight">${customerName}</span>,
            </p>

            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Perfect timing! Your therapist <strong>${therapistName}</strong> has arrived at your location
                and is ready to begin your relaxing massage session.
            </p>

            <div class="therapist-info">
                <div class="icon">✅</div>
                <h3 style="color: #52c41a; margin: 10px 0;">Your Therapist</h3>
                <p style="font-size: 20px; font-weight: bold; color: #52c41a; margin: 10px 0;">
                    ${therapistName}
                </p>
                <p style="color: #595959; margin: 5px 0;">has arrived and is ready</p>
            </div>

            <div class="booking-details">
                <h3 style="color: #52c41a; margin-top: 0;">📋 Your Booking Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0;"><strong>Booking ID:</strong></td><td style="padding: 8px 0;">${booking.booking_id}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Service:</strong></td><td style="padding: 8px 0;">${serviceName}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Duration:</strong></td><td style="padding: 8px 0;">${booking.duration_minutes} minutes</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>Location:</strong></td><td style="padding: 8px 0;">${booking.address}</td></tr>
                    ${booking.room_number ? `<tr><td style="padding: 8px 0;"><strong>Room:</strong></td><td style="padding: 8px 0;">${booking.room_number}</td></tr>` : ''}
                </table>
            </div>

            <div class="ready-box">
                <h3 style="color: #d4b106; margin-top: 0;">💆 Let's Begin</h3>
                <p style="color: #8c7700; margin: 10px 0;">
                    Your therapist will now set up their equipment and prepare for your session.
                    Please let them know if you have any specific areas of concern or special requests.
                </p>
                <p style="color: #8c7700; margin: 10px 0; font-weight: bold;">
                    Relax and enjoy your massage experience!
                </p>
            </div>

            <p style="font-size: 16px; line-height: 1.6; text-align: center; margin-top: 30px; color: #52c41a; font-weight: bold;">
                🌟 We hope you have a wonderful and rejuvenating experience! 🌟
            </p>
        </div>

        <div class="footer">
            <p>Thank you for choosing Rejuvenators Mobile Massage</p>
            <p>For support, call 1300 302542 or email info@rejuvenators.com</p>
        </div>
    </div>
</body>
</html>`;
    }

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: 'template_generic', // Generic HTML template
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: booking.customer_email,
        to_name: customerName,
        subject: status === 'on_my_way' ?
          `🚗 ${therapistName} is On The Way - Booking ${booking.booking_id}` :
          `✅ ${therapistName} Has Arrived - Booking ${booking.booking_id}`,
        html_content: emailHtml
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error('EmailJS error: ' + response.status);
    }

    console.log('✅ Status email sent to customer:', booking.customer_email);
    return { success: true };

  } catch (error) {
    console.error('❌ Error sending status email:', error);
    throw error;
  }
}

// Send SMS notification to customer
async function sendCustomerStatusSMS(booking, therapistName, status) {
  try {
    const bookingTime = new Date(booking.booking_time);
    const timeFormatted = bookingTime.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let smsMessage = '';

    if (status === 'on_my_way') {
      smsMessage = `🚗 ON MY WAY!

${therapistName} is heading to your location now for your massage booking (${booking.booking_id}).

Scheduled time: ${timeFormatted}
Location: ${booking.address}

Please have the space ready. You'll receive another notification when they arrive.

- Rejuvenators`;
    } else {
      smsMessage = `✅ THERAPIST ARRIVED!

${therapistName} has arrived at your location for booking ${booking.booking_id}.

They're ready to begin your massage session. Enjoy your treatment!

- Rejuvenators`;
    }

    const response = await fetch('https://rmmbookingplatform.netlify.app/.netlify/functions/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: booking.customer_phone,
        message: smsMessage
      })
    });

    const result = await response.json();
    console.log('✅ Status SMS sent to customer:', booking.customer_phone);
    return result;

  } catch (error) {
    console.error('❌ Error sending status SMS:', error);
    throw error;
  }
}
