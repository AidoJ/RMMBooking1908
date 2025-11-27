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
const EMAILJS_APPOINTMENT_REMINDER_TEMPLATE = 'template_remindclient';
const EMAILJS_PAYMENT_REMINDER_TEMPLATE = 'template_pay_remind';
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
    // Function runs every 10 minutes, so check bookings in the NEXT 10-minute window
    // that are reminderHours away. This ensures we sweep through all bookings sequentially.
    const now = new Date();
    const windowStart = new Date(now.getTime() + (reminderHours * 60 * 60 * 1000));
    const windowEnd = new Date(windowStart.getTime() + (10 * 60 * 1000)); // Next 10 minutes

    console.log(`🔍 Current time (UTC): ${now.toISOString()}`);
    console.log(`🔍 Current time (Brisbane): ${now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`);
    console.log(`🔍 Checking bookings ${reminderHours}hr ahead (UTC): ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
    console.log(`🔍 Window in Brisbane time: ${windowStart.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })} to ${windowEnd.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`);

    // Find confirmed bookings in the reminder window that haven't been sent a reminder
    // Note: PostgreSQL timestamptz comparisons work in UTC, so timezone-aware timestamps are automatically converted
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

    // Log found bookings with their times
    bookings.forEach(b => {
      const bookingTime = new Date(b.booking_time);
      const localTime = bookingTime.toLocaleString('en-AU', { timeZone: b.booking_timezone || 'Australia/Brisbane' });
      console.log(`  - ${b.booking_id}: ${b.booking_time} (${localTime} in ${b.booking_timezone || 'unknown TZ'})`);
    });

    let successCount = 0;
    let failCount = 0;

    // Process each booking
    for (const booking of bookings) {
      try {
        console.log(`📤 Processing reminder for booking ${booking.booking_id}`);

        let paymentAuthorized = booking.payment_status === 'authorized';
        let paymentLink = null;

        // CHECK PAYMENT AUTHORIZATION STATUS
        if (!paymentAuthorized) {
          console.log(`⚠️ Booking ${booking.booking_id} payment not authorized (status: ${booking.payment_status})`);

          // Try auto-authorization if payment method saved
          if (booking.stripe_payment_method_id && booking.stripe_customer_id) {
            try {
              console.log(`💳 Attempting auto-authorization for ${booking.booking_id}`);
              await autoAuthorizePayment(booking);
              console.log(`✅ Auto-authorized payment for ${booking.booking_id}`);
              paymentAuthorized = true; // Success!
            } catch (authError) {
              console.error(`❌ Auto-authorization failed for ${booking.booking_id}:`, authError.message);

              // Track payment failure
              const updatedBooking = await trackPaymentFailure(booking, authError.message);

              // Check if booking should be auto-cancelled due to multiple failures
              const shouldCancel = await checkAutoCancelConditions(updatedBooking);

              if (shouldCancel) {
                console.log(`🚫 Auto-cancelling ${booking.booking_id} due to multiple payment failures`);
                await autoCancelBooking(updatedBooking, 'Multiple payment authorization failures');
                // Skip sending reminders - booking is cancelled
                continue;
              }

              // Create payment link for customer
              paymentLink = await createPaymentLink(booking);
            }
          } else {
            // No saved payment method - create payment link
            console.log(`⚠️ No saved payment method for ${booking.booking_id}`);
            paymentLink = await createPaymentLink(booking);
          }
        }

        // Generate cancel link
        const cancelLink = await createCancelLink(booking);

        // SEND APPROPRIATE EMAIL BASED ON PAYMENT STATUS
        if (paymentAuthorized) {
          // Payment is authorized → Send APPOINTMENT REMINDER
          if (booking.email) {
            try {
              await sendAppointmentReminder(booking, cancelLink);
              console.log(`✅ Appointment reminder sent to client for ${booking.booking_id}`);
            } catch (emailError) {
              console.error(`❌ Error sending appointment reminder for ${booking.booking_id}:`, emailError);
            }
          }

          // Send SMS to client
          if (booking.customer_phone) {
            try {
              await sendClientReminderSMS(booking, false, null);
              console.log(`✅ Appointment SMS sent to client for ${booking.booking_id}`);
            } catch (smsError) {
              console.error(`❌ Error sending appointment SMS for ${booking.booking_id}:`, smsError);
            }
          }

          // Send reminder to therapist (payment is authorized)
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

          // Mark reminder as sent (only when appointment reminder sent)
          await supabase
            .from('bookings')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', booking.id);

          console.log(`✅ Appointment reminder processed for ${booking.booking_id}`);

        } else {
          // Payment NOT authorized → Send PAYMENT REMINDER
          if (booking.email) {
            try {
              await sendPaymentReminder(booking, paymentLink, cancelLink);
              console.log(`✅ Payment reminder sent to client for ${booking.booking_id}`);
            } catch (emailError) {
              console.error(`❌ Error sending payment reminder for ${booking.booking_id}:`, emailError);
            }
          }

          // Send SMS with payment link
          if (booking.customer_phone) {
            try {
              await sendClientReminderSMS(booking, true, paymentLink);
              console.log(`✅ Payment SMS sent to client for ${booking.booking_id}`);
            } catch (smsError) {
              console.error(`❌ Error sending payment SMS for ${booking.booking_id}:`, smsError);
            }
          }

          // DO NOT mark reminder_sent_at - let it be picked up again after payment
          // DO NOT notify therapist - payment not confirmed
          console.log(`⚠️ Payment reminder sent for ${booking.booking_id} - will retry when payment authorized`);
        }

        successCount++;

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

// Send appointment reminder email to client (payment already authorized)
async function sendAppointmentReminder(booking, cancelLink) {
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
      cancel_link: cancelLink
    };

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_APPOINTMENT_REMINDER_TEMPLATE,
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
    console.error('❌ Error sending appointment reminder email:', error);
    throw error;
  }
}

// Send payment reminder email to client (payment NOT authorized)
async function sendPaymentReminder(booking, paymentLink, cancelLink) {
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
      payment_link: paymentLink,
      amount: parseFloat(booking.price || 0).toFixed(2),
      cancel_link: cancelLink
    };

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_PAYMENT_REMINDER_TEMPLATE,
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
    console.error('❌ Error sending payment reminder email:', error);
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

// Create cancel link using short_links table
async function createCancelLink(booking) {
  try {
    const cancelUrl = `${process.env.URL}/cancel-booking.html?b=${booking.booking_id}`;
    const shortCode = `cancel-${booking.booking_id.toLowerCase()}`;

    console.log(`🔗 Creating cancel link for ${booking.booking_id}`);

    // Try to insert new short link
    const { data: shortLink, error } = await supabase
      .from('short_links')
      .insert({
        short_code: shortCode,
        original_url: cancelUrl,
        metadata: {
          booking_id: booking.booking_id,
          type: 'cancellation',
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
      console.warn(`⚠️ Could not create short cancel link, using direct URL`);
      return cancelUrl;
    }

    const link = `${process.env.URL}/s/${shortLink.short_code}`;
    console.log(`✅ Cancel link created: ${link}`);
    return link;

  } catch (error) {
    console.error('❌ Error creating cancel link:', error);
    // Fallback to direct URL
    return `${process.env.URL}/cancel-booking.html?b=${booking.booking_id}`;
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

    // Return updated booking with new failure count
    return {
      ...booking,
      payment_failure_count: failureCount,
      first_payment_failure_at: failureCount === 1 ? now : booking.first_payment_failure_at,
      last_payment_failure_at: now
    };

  } catch (error) {
    console.error('❌ Error tracking payment failure:', error);
    // Return original booking if tracking fails
    return booking;
  }
}

// Check if booking should be auto-cancelled based on payment failures
async function checkAutoCancelConditions(booking) {
  try {
    // Get auto-cancel settings from system_settings (default: 3 failures, 6 hours before)
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['auto_cancel_failure_threshold', 'auto_cancel_hours_before']);

    const failureThreshold = parseInt(settings?.find(s => s.key === 'auto_cancel_failure_threshold')?.value || '3');
    const hoursBefore = parseInt(settings?.find(s => s.key === 'auto_cancel_hours_before')?.value || '6');

    console.log(`🔍 Auto-cancel check: ${booking.payment_failure_count || 0} failures (threshold: ${failureThreshold})`);

    // Check failure count
    if ((booking.payment_failure_count || 0) < failureThreshold) {
      return false;
    }

    // Check time until appointment
    const bookingTime = new Date(booking.booking_time);
    const now = new Date();
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    console.log(`🔍 Auto-cancel check: ${hoursUntilBooking.toFixed(2)} hours until booking (threshold: ${hoursBefore})`);

    if (hoursUntilBooking > hoursBefore) {
      console.log(`⏰ Not auto-cancelling yet - still have time for customer to authorize payment`);
      return false;
    }

    // Both conditions met
    console.log(`🚫 Auto-cancel conditions met: ${booking.payment_failure_count} failures and < ${hoursBefore} hours until booking`);
    return true;

  } catch (error) {
    console.error('❌ Error checking auto-cancel conditions:', error);
    return false; // Don't auto-cancel if we can't check conditions
  }
}

// Auto-cancel booking due to payment failures
async function autoCancelBooking(booking, reason) {
  try {
    console.log(`🚫 Auto-cancelling booking ${booking.booking_id}: ${reason}`);

    const now = new Date().toISOString();
    const cancelReason = `Auto-cancelled: ${reason}. ${booking.payment_failure_count} payment authorization attempts failed.`;

    // Update booking status to cancelled
    await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: cancelReason,
        cancelled_at: now,
        cancelled_by: 'system',
        updated_at: now
      })
      .eq('id', booking.id);

    // Add to status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'cancelled',
        notes: cancelReason,
        changed_at: now
      });

    // Send cancellation notification to client
    if (booking.email) {
      await sendCancellationNotification(booking, reason);
    }

    // Send SMS notification to client
    if (booking.customer_phone) {
      await sendCancellationSMS(booking, reason);
    }

    // Notify therapist if assigned
    if (booking.therapist_profiles?.email) {
      await sendTherapistCancellationNotification(booking, reason);
    }

    console.log(`✅ Booking ${booking.booking_id} auto-cancelled successfully`);

  } catch (error) {
    console.error('❌ Error auto-cancelling booking:', error);
    throw error;
  }
}

// Send cancellation notification email to client
async function sendCancellationNotification(booking, reason) {
  try {
    const emailjs = require('@emailjs/nodejs');
    const bookingTime = new Date(booking.booking_time);

    const templateParams = {
      to_email: booking.email,
      customer_name: booking.first_name,
      booking_id: booking.booking_id,
      service_name: booking.services?.name || 'Massage Service',
      booking_date: bookingTime.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      booking_time: bookingTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      reason: reason,
      contact_phone: '1300 302542'
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      'Booking-cancel-client',
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY
      }
    );

    console.log(`✅ Cancellation email sent to ${booking.email}`);
  } catch (error) {
    console.error('❌ Error sending cancellation email:', error);
  }
}

// Send cancellation SMS to client
async function sendCancellationSMS(booking, reason) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log('⚠️ Twilio not configured - skipping cancellation SMS');
      return;
    }

    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const bookingTime = new Date(booking.booking_time);
    const dateStr = bookingTime.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    const timeStr = bookingTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

    const message = `❌ BOOKING CANCELLED

Hi ${booking.first_name}, your booking ${booking.booking_id} scheduled for ${dateStr} at ${timeStr} has been cancelled due to payment authorization issues.

If this is an error, please call us immediately at 1300 302542 to reschedule.

- Rejuvenators`;

    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: booking.customer_phone
    });

    console.log(`✅ Cancellation SMS sent to ${booking.customer_phone}`);
  } catch (error) {
    console.error('❌ Error sending cancellation SMS:', error);
  }
}

// Send therapist cancellation notification
async function sendTherapistCancellationNotification(booking, reason) {
  try {
    const emailjs = require('@emailjs/nodejs');
    const bookingTime = new Date(booking.booking_time);

    const templateParams = {
      to_email: booking.therapist_profiles.email,
      therapist_name: booking.therapist_profiles.first_name,
      client_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service_name: booking.services?.name || 'Massage Service',
      booking_date: bookingTime.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      booking_time: bookingTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      address: booking.address,
      reason: 'Payment authorization failed - auto-cancelled by system'
    };

    await emailjs.send(
      EMAILJS_SERVICE_ID,
      'Booking-cancel-therapist',
      templateParams,
      {
        publicKey: EMAILJS_PUBLIC_KEY,
        privateKey: EMAILJS_PRIVATE_KEY
      }
    );

    console.log(`✅ Therapist cancellation email sent to ${booking.therapist_profiles.email}`);
  } catch (error) {
    console.error('❌ Error sending therapist cancellation email:', error);
  }
}
