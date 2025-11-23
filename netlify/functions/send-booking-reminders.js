// send-booking-reminders.js - Scheduled function to send booking reminders
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
const EMAILJS_CLIENT_REMINDER_TEMPLATE = 'template_remindclient';
const EMAILJS_THERAPIST_REMINDER_TEMPLATE = 'template_remindtherapist';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

exports.handler = async (event, context) => {
  console.log('⏰ Running booking reminder check...');

  try {
    // Get reminder hours from system_settings
    const { data: reminderSetting, error: settingError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'booking_reminder_hours')
      .single();

    if (settingError || !reminderSetting) {
      console.error('❌ Error fetching booking_reminder_hours setting:', settingError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Missing booking_reminder_hours setting' })
      };
    }

    const reminderHours = parseInt(reminderSetting.value) || 24;
    console.log(`📋 Reminder hours setting: ${reminderHours}`);

    // Calculate the time window for reminders
    // We want bookings that are approximately reminderHours away
    // Use a 10-minute window since this function runs every 10 minutes
    const now = new Date();
    const targetTime = new Date(now.getTime() + (reminderHours * 60 * 60 * 1000));
    const windowStart = new Date(targetTime.getTime() - (5 * 60 * 1000)); // 5 min before
    const windowEnd = new Date(targetTime.getTime() + (5 * 60 * 1000)); // 5 min after

    console.log(`🔍 Looking for bookings between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

    // Find confirmed bookings in the reminder window that haven't been sent a reminder
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        services(name),
        therapist_profiles!therapist_id(first_name, last_name, email, phone)
      `)
      .eq('status', 'confirmed')
      .gte('booking_time', windowStart.toISOString())
      .lte('booking_time', windowEnd.toISOString())
      .or('reminder_sent_at.is.null,reminder_sent_at.lt.' + windowStart.toISOString());

    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Database error' })
      };
    }

    if (!bookings || bookings.length === 0) {
      console.log('✅ No bookings need reminders at this time');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No reminders needed' })
      };
    }

    console.log(`📬 Found ${bookings.length} bookings that need reminders`);

    let successCount = 0;
    let failCount = 0;

    // Process each booking
    for (const booking of bookings) {
      try {
        console.log(`📤 Sending reminders for booking ${booking.booking_id}`);

        // Send reminder to client
        if (booking.email) {
          try {
            await sendClientReminder(booking);
            console.log(`✅ Client reminder sent for ${booking.booking_id}`);
          } catch (emailError) {
            console.error(`❌ Error sending client reminder for ${booking.booking_id}:`, emailError);
          }
        }

        // Send SMS to client
        if (booking.customer_phone) {
          try {
            await sendClientReminderSMS(booking);
            console.log(`✅ Client SMS reminder sent for ${booking.booking_id}`);
          } catch (smsError) {
            console.error(`❌ Error sending client SMS for ${booking.booking_id}:`, smsError);
          }
        }

        // Send reminder to therapist
        if (booking.therapist_profiles?.email) {
          try {
            await sendTherapistReminder(booking);
            console.log(`✅ Therapist reminder sent for ${booking.booking_id}`);
          } catch (emailError) {
            console.error(`❌ Error sending therapist reminder for ${booking.booking_id}:`, emailError);
          }
        }

        // Send SMS to therapist
        if (booking.therapist_profiles?.phone) {
          try {
            await sendTherapistReminderSMS(booking);
            console.log(`✅ Therapist SMS reminder sent for ${booking.booking_id}`);
          } catch (smsError) {
            console.error(`❌ Error sending therapist SMS for ${booking.booking_id}:`, smsError);
          }
        }

        // Mark reminder as sent
        await supabase
          .from('bookings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        successCount++;
        console.log(`✅ Reminders sent for booking ${booking.booking_id}`);

      } catch (error) {
        console.error(`❌ Error processing booking ${booking.booking_id}:`, error);
        failCount++;
      }
    }

    console.log(`✅ Processed ${successCount + failCount} bookings (${successCount} success, ${failCount} failed)`);

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
    console.error('❌ Error in booking reminder handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

// Send reminder email to client
async function sendClientReminder(booking) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }

    const bookingDate = new Date(booking.booking_time);
    const serviceName = booking.services?.name || 'Massage';
    const duration = booking.duration_minutes;

    const templateParams = {
      to_email: booking.email,
      customer_name: booking.first_name,
      booking_id: booking.booking_id,
      service_name: serviceName,
      booking_date: bookingDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      booking_time: bookingDate.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      duration: duration + ' minutes',
      address: booking.address,
      therapist_name: booking.therapist_profiles?.first_name || 'Your therapist'
    };

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_CLIENT_REMINDER_TEMPLATE,
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
    console.error('❌ Error sending client reminder email:', error);
    throw error;
  }
}

// Send reminder email to therapist
async function sendTherapistReminder(booking) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }

    const bookingDate = new Date(booking.booking_time);
    const serviceName = booking.services?.name || 'Massage';
    const duration = booking.duration_minutes;
    const clientName = `${booking.first_name} ${booking.last_name}`;

    const templateParams = {
      to_email: booking.therapist_profiles.email,
      therapist_name: booking.therapist_profiles.first_name,
      booking_id: booking.booking_id,
      client_name: clientName,
      service_name: serviceName,
      booking_date: bookingDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      booking_time: bookingDate.toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      duration: duration + ' minutes',
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist_fee: '$' + (parseFloat(booking.therapist_fee || 0).toFixed(2))
    };

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_THERAPIST_REMINDER_TEMPLATE,
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
    console.error('❌ Error sending therapist reminder email:', error);
    throw error;
  }
}

// Send reminder SMS to client
async function sendClientReminderSMS(booking) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('❌ Twilio credentials not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    const bookingDate = new Date(booking.booking_time);
    const serviceName = booking.services?.name || 'massage';
    const therapistName = booking.therapist_profiles?.first_name || 'your therapist';

    const dateStr = bookingDate.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric'
    });
    const timeStr = bookingDate.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const smsMessage = `📅 BOOKING REMINDER

Hi ${booking.first_name}, this is a reminder about your ${serviceName} with ${therapistName}.

Date: ${dateStr}
Time: ${timeStr}
Location: ${booking.address}

Looking forward to seeing you!
- Rejuvenators`;

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
        To: booking.customer_phone,
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
    console.error('❌ Error sending client SMS reminder:', error);
    throw error;
  }
}

// Send reminder SMS to therapist
async function sendTherapistReminderSMS(booking) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('❌ Twilio credentials not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    const bookingDate = new Date(booking.booking_time);
    const serviceName = booking.services?.name || 'massage';
    const clientName = `${booking.first_name} ${booking.last_name}`;

    const dateStr = bookingDate.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric'
    });
    const timeStr = bookingDate.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const smsMessage = `📅 BOOKING REMINDER

Hi ${booking.therapist_profiles.first_name}, reminder about your upcoming booking:

Client: ${clientName}
Service: ${serviceName}
Date: ${dateStr}
Time: ${timeStr}
Location: ${booking.address}
Fee: $${parseFloat(booking.therapist_fee || 0).toFixed(2)}

- Rejuvenators`;

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
        To: booking.therapist_profiles.phone,
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
    console.error('❌ Error sending therapist SMS reminder:', error);
    throw error;
  }
}
