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
        console.log(`📤 Processing reminder for booking ${booking.booking_id}`);

        let paymentRequired = false;
        let paymentLink = null;

        // CHECK PAYMENT AUTHORIZATION STATUS
        if (booking.payment_status === 'pending' || booking.payment_status === 'authorization_failed') {
          console.log(`⚠️ Booking ${booking.booking_id} needs payment authorization (status: ${booking.payment_status})`);

          // Try auto-authorization if payment method saved
          if (booking.stripe_payment_method_id && booking.stripe_customer_id) {
            try {
              console.log(`💳 Attempting auto-authorization for ${booking.booking_id}`);
              await autoAuthorizePayment(booking);
              console.log(`✅ Auto-authorized payment for ${booking.booking_id}`);
              // Payment now authorized - send normal reminder (paymentRequired stays false)
            } catch (authError) {
              console.error(`❌ Auto-authorization failed for ${booking.booking_id}:`, authError.message);
              // Set flag to include payment link in reminder
              paymentRequired = true;
              paymentLink = await createPaymentLink(booking);

              // Track payment failure
              await trackPaymentFailure(booking, authError.message);
            }
          } else {
            // No saved payment method - include payment link in reminder
            console.log(`⚠️ No saved payment method for ${booking.booking_id}`);
            paymentRequired = true;
            paymentLink = await createPaymentLink(booking);
          }
        }

        // Send reminder to client (always send, with payment section if needed)
        if (booking.email) {
          try {
            await sendClientReminder(booking, paymentRequired, paymentLink);
            console.log(`✅ Client reminder sent for ${booking.booking_id}${paymentRequired ? ' (with payment link)' : ''}`);
          } catch (emailError) {
            console.error(`❌ Error sending client reminder for ${booking.booking_id}:`, emailError);
          }
        }

        // Send SMS to client (with payment link if needed)
        if (booking.customer_phone) {
          try {
            await sendClientReminderSMS(booking, paymentRequired, paymentLink);
            console.log(`✅ Client SMS reminder sent for ${booking.booking_id}${paymentRequired ? ' (with payment link)' : ''}`);
          } catch (smsError) {
            console.error(`❌ Error sending client SMS for ${booking.booking_id}:`, smsError);
          }
        }

        // Send reminder to therapist ONLY if payment is authorized
        if (!paymentRequired) {
          if (booking.therapist_profiles?.email) {
            try {
              await sendTherapistReminder(booking);
              console.log(`✅ Therapist reminder sent for ${booking.booking_id}`);
            } catch (emailError) {
              console.error(`❌ Error sending therapist reminder for ${booking.booking_id}:`, emailError);
            }
          }

          if (booking.therapist_profiles?.phone) {
            try {
              await sendTherapistReminderSMS(booking);
              console.log(`✅ Therapist SMS reminder sent for ${booking.booking_id}`);
            } catch (smsError) {
              console.error(`❌ Error sending therapist SMS for ${booking.booking_id}:`, smsError);
            }
          }
        } else {
          console.log(`⚠️ Therapist NOT notified for ${booking.booking_id} - payment not authorized`);
        }

        // Mark reminder as sent
        await supabase
          .from('bookings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        successCount++;
        console.log(`✅ Reminder processed for booking ${booking.booking_id}`);

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
async function sendClientReminder(booking, paymentRequired = false, paymentLink = null) {
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
      therapist_name: booking.therapist_profiles?.first_name || 'Your therapist',
      payment_required: paymentRequired,
      payment_link: paymentLink || '',
      amount: '$' + parseFloat(booking.price || 0).toFixed(2)
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
async function sendClientReminderSMS(booking, paymentRequired = false, paymentLink = null) {
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

    let smsMessage;

    if (paymentRequired) {
      // PAYMENT REQUIRED VERSION
      smsMessage = `⚠️ BOOKING REMINDER + PAYMENT REQUIRED

Hi ${booking.first_name}, your ${serviceName} with ${therapistName} is scheduled for:

📅 ${dateStr} at ${timeStr}
📍 ${booking.address}

⚠️ Please authorize payment to confirm:
${paymentLink}
Amount: $${parseFloat(booking.price || 0).toFixed(2)}

- Rejuvenators`;
    } else {
      // NORMAL REMINDER VERSION
      smsMessage = `📅 BOOKING REMINDER

Hi ${booking.first_name}, this is a reminder about your ${serviceName} with ${therapistName}.

Date: ${dateStr}
Time: ${timeStr}
Location: ${booking.address}

Looking forward to seeing you!
- Rejuvenators`;
    }

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

// Auto-authorize payment using saved payment method
async function autoAuthorizePayment(booking) {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  console.log(`💳 Auto-authorizing payment for ${booking.booking_id} using saved payment method`);

  try {
    // Create payment intent with saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(booking.price || 0) * 100),
      currency: 'aud',
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      confirm: true,
      capture_method: 'manual',
      off_session: true,
      metadata: {
        booking_id: booking.booking_id,
        request_id: booking.request_id || '',
        occurrence_number: booking.occurrence_number?.toString() || '',
        customer_email: booking.email || '',
        service_name: booking.services?.name || '',
        booking_time: booking.booking_time
      },
      description: `Booking ${booking.booking_id} - ${booking.services?.name || 'Massage'}`
    });

    // Check if authorization succeeded
    if (paymentIntent.status !== 'requires_capture') {
      throw new Error(`Payment status is ${paymentIntent.status}, expected requires_capture`);
    }

    console.log(`✅ Stripe authorization successful: ${paymentIntent.id}`);

    // Update booking with payment intent ID and authorized status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_intent_id: paymentIntent.id,
        payment_status: 'authorized',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    // Add to status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'payment_authorized',
        notes: `Payment automatically authorized via saved payment method (off-session)`,
        changed_at: new Date().toISOString()
      });

    console.log(`✅ Booking ${booking.booking_id} updated with payment_intent_id: ${paymentIntent.id}`);
    return paymentIntent;

  } catch (error) {
    console.error(`❌ Auto-authorization failed for ${booking.booking_id}:`, error);
    throw error;
  }
}

// Create payment link using short_links table
async function createPaymentLink(booking) {
  try {
    const paymentUrl = `${process.env.URL}/pay.html?b=${booking.booking_id}`;
    const shortCode = `pay-${booking.booking_id.toLowerCase()}`;

    console.log(`🔗 Creating payment link for ${booking.booking_id}`);

    // Try to insert new short link
    const { data: shortLink, error } = await supabase
      .from('short_links')
      .insert({
        short_code: shortCode,
        original_url: paymentUrl,
        metadata: {
          booking_id: booking.booking_id,
          type: 'payment',
          created_for: 'reminder'
        }
      })
      .select()
      .single();

    if (error) {
      // Short code might already exist - fetch it
      const { data: existing } = await supabase
        .from('short_links')
        .select('short_code')
        .eq('short_code', shortCode)
        .single();

      if (existing) {
        return `${process.env.URL}/s/${existing.short_code}`;
      }

      // Fallback to direct URL
      console.warn(`⚠️ Could not create short link, using direct URL`);
      return paymentUrl;
    }

    const link = `${process.env.URL}/s/${shortLink.short_code}`;
    console.log(`✅ Payment link created: ${link}`);
    return link;

  } catch (error) {
    console.error('❌ Error creating payment link:', error);
    // Fallback to direct URL
    return `${process.env.URL}/pay.html?b=${booking.booking_id}`;
  }
}

// Track payment authorization failure
async function trackPaymentFailure(booking, errorMessage) {
  try {
    console.log(`📊 Tracking payment failure for ${booking.booking_id}`);

    const failureCount = (booking.payment_failure_count || 0) + 1;
    const now = new Date().toISOString();

    const updateData = {
      payment_status: 'authorization_failed',
      payment_failure_count: failureCount,
      last_payment_failure_at: now,
      updated_at: now
    };

    // Set first failure time if this is the first failure
    if (failureCount === 1) {
      updateData.first_payment_failure_at = now;
    }

    await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking.id);

    // Add to status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'payment_authorization_failed',
        notes: `Payment authorization failed (attempt ${failureCount}): ${errorMessage}`,
        changed_at: now
      });

    console.log(`📊 Payment failure tracked: ${failureCount} attempt(s)`);

  } catch (error) {
    console.error('❌ Error tracking payment failure:', error);
    // Don't throw - this is logging only
  }
}
