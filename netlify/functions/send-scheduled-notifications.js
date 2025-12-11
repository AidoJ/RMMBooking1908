// send-scheduled-notifications.js - Scheduled function to send pending review requests
// Runs every 10 minutes via Netlify scheduled functions

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_REVIEW_TEMPLATE = 'template_reviewrequest';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

exports.handler = async (event, context) => {
  console.log('🕐 Running scheduled notification check...');

  try {
    // Get all pending notifications that are due to be sent
    const now = new Date().toISOString();
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true })
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Database error' })
      };
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('✅ No pending notifications to send');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No notifications pending' })
      };
    }

    console.log(`📬 Found ${pendingNotifications.length} notifications to send`);

    let successCount = 0;
    let failCount = 0;

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`📤 Processing notification ${notification.id} (${notification.notification_type})`);

        if (notification.notification_type === 'review_request') {
          await sendReviewRequest(notification);
          successCount++;

          // Mark as sent
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          console.log(`✅ Notification ${notification.id} sent successfully`);
        }

      } catch (error) {
        console.error(`❌ Error sending notification ${notification.id}:`, error);
        failCount++;

        // Mark as failed and increment retry count
        await supabase
          .from('scheduled_notifications')
          .update({
            status: notification.retry_count >= 3 ? 'failed' : 'pending', // Give up after 3 retries
            failed_at: new Date().toISOString(),
            error_message: error.message || 'Unknown error',
            retry_count: notification.retry_count + 1
          })
          .eq('id', notification.id);
      }
    }

    console.log(`✅ Processed ${successCount + failCount} notifications (${successCount} success, ${failCount} failed)`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: successCount + failCount,
        success: successCount,
        failed: failCount
      })
    };

  } catch (error) {
    console.error('❌ Error in scheduled notification handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

// Send review request via email and SMS
async function sendReviewRequest(notification) {
  const {
    customer_email,
    customer_phone,
    customer_first_name,
    therapist_first_name,
    notification_data
  } = notification;

  const googleReviewUrl = notification_data?.google_review_url || 'https://g.page/r/CacL6QudFVwjEBM/review';

  // Send Email
  if (customer_email) {
    try {
      await sendReviewEmail(
        customer_email,
        customer_first_name,
        therapist_first_name,
        googleReviewUrl
      );
      console.log('✅ Review request email sent to:', customer_email);
    } catch (emailError) {
      console.error('❌ Error sending review email:', emailError);
      // Continue to try SMS even if email fails
    }
  }

  // Send SMS
  if (customer_phone) {
    try {
      await sendReviewSMS(
        customer_phone,
        customer_first_name,
        therapist_first_name,
        googleReviewUrl
      );
      console.log('✅ Review request SMS sent to:', customer_phone);
    } catch (smsError) {
      console.error('❌ Error sending review SMS:', smsError);
      // If both fail, throw error
      if (!customer_email) {
        throw smsError;
      }
    }
  }
}

// Send review request email using EmailJS
async function sendReviewEmail(customerEmail, customerFirstName, therapistFirstName, googleReviewUrl) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }

    const templateParams = {
      to_email: customerEmail,
      customer_name: customerFirstName,
      therapist_name: therapistFirstName,
      google_review_url: googleReviewUrl
    };

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_REVIEW_TEMPLATE,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error('EmailJS error: ' + response.status);
    }

    return { success: true };

  } catch (error) {
    console.error('❌ Error sending review email:', error);
    throw error;
  }
}

// Send review request SMS using Twilio
async function sendReviewSMS(customerPhone, customerFirstName, therapistFirstName, googleReviewUrl) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('❌ Twilio credentials not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    // SMS Message format as specified
    const smsMessage = `Thank you ${customerFirstName}, Loved your therapy session? If yes we would love a 5 star review and comment for ${therapistFirstName}. ${googleReviewUrl} If you were not happy for any reason please call us on 1300 302542.`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: customerPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: smsMessage
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { success: true, sid: result.sid };

  } catch (error) {
    console.error('❌ Error sending review SMS:', error);
    throw error;
  }
}
