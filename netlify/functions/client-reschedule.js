/**
 * Client Self-Service Reschedule Function
 *
 * Allows clients to reschedule their bookings via token-based access.
 * - Validates reschedule token and 3-hour window
 * - Checks reschedule_count < 2
 * - Calculates price difference for after-hours/weekend
 * - Charges additional payment if price increases (using saved card)
 * - Updates booking and sends notifications
 */

const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID || 'template_confirmed';
const EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID || 'therapist-confirmation';

// Helper: Format date for display
function formatDate(dateString, timezone = 'Australia/Brisbane') {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone
  });
}

function formatTime(dateString, timezone = 'Australia/Brisbane') {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone
  });
}

function formatShortDate(dateString, timezone = 'Australia/Brisbane') {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone
  });
}

// Helper: Normalize Australian phone numbers
function normalizeAustralianPhone(phoneNumber) {
  if (!phoneNumber) return null;

  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+61')) {
    return cleaned;
  }

  if (cleaned.startsWith('61') && cleaned.length >= 11) {
    return '+' + cleaned;
  }

  if (cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1);
  }

  return '+61' + cleaned;
}

// Helper: Send email via EmailJS
async function sendEmail(templateId, templateParams) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }

    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    const responseText = await response.text();

    if (response.ok || responseText === 'OK') {
      console.log('✅ Email sent successfully');
      return { success: true, response: responseText };
    } else {
      console.error('❌ Email send failed:', responseText);
      return { success: false, error: responseText };
    }

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Helper: Send SMS via internal function
async function sendSMSNotification(phoneNumber, message) {
  try {
    const normalizedPhone = normalizeAustralianPhone(phoneNumber);

    if (!normalizedPhone) {
      console.error('❌ Invalid phone number provided');
      return { success: false, error: 'Invalid phone number' };
    }

    console.log(`📱 Sending SMS notification to ${normalizedPhone}`);

    const smsUrl = process.env.URL
      ? `${process.env.URL}/.netlify/functions/send-sms`
      : 'https://booking.rejuvenators.com/.netlify/functions/send-sms';

    const response = await fetch(smsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, message: message })
    });

    const contentType = response.headers.get('content-type');
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = { success: response.ok, message: text };
    }

    console.log('📱 SMS API response:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending SMS notification:', error);
    return { success: false, error: error.message };
  }
}

// Calculate price with time-based uplifts
async function calculatePrice(serviceId, durationMinutes, bookingTime) {
  // Get service base price
  const { data: service } = await supabase
    .from('services')
    .select('service_base_price')
    .eq('id', serviceId)
    .single();

  if (!service) {
    throw new Error('Service not found');
  }

  let price = service.service_base_price;

  // Apply duration uplift
  const { data: durationPricing } = await supabase
    .from('duration_pricing')
    .select('uplift_percentage')
    .eq('duration_minutes', durationMinutes)
    .eq('is_active', true)
    .single();

  if (durationPricing && durationPricing.uplift_percentage > 0) {
    price = price * (1 + durationPricing.uplift_percentage / 100);
  }

  // Calculate duration multiplier (base price is per hour)
  price = price * (durationMinutes / 60);

  // Apply time-based uplift (after-hours, weekends)
  const bookingDate = new Date(bookingTime);
  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
  const timeString = bookingDate.toTimeString().substring(0, 5); // HH:MM

  const { data: timeRules } = await supabase
    .from('time_pricing_rules')
    .select('uplift_percentage, label')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .lte('start_time', timeString)
    .gte('end_time', timeString);

  if (timeRules && timeRules.length > 0) {
    // Apply the highest uplift if multiple rules match
    const maxUplift = Math.max(...timeRules.map(r => r.uplift_percentage));
    if (maxUplift > 0) {
      price = price * (1 + maxUplift / 100);
      console.log(`📈 Applied ${maxUplift}% time uplift`);
    }
  }

  return Math.round(price * 100) / 100; // Round to 2 decimal places
}

// Main handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET: Fetch booking details for the reschedule page
    if (event.httpMethod === 'GET') {
      const token = event.queryStringParameters?.token;

      if (!token) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Reschedule token required' })
        };
      }

      // Fetch booking with related data
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          services (id, name, service_base_price, minimum_duration),
          therapist_profiles!bookings_therapist_id_fkey (id, first_name, last_name, email, phone)
        `)
        .eq('reschedule_token', token)
        .single();

      if (bookingError || !booking) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Booking not found or invalid token' })
        };
      }

      // Check status
      if (['cancelled', 'client_cancelled', 'completed'].includes(booking.status)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Cannot reschedule',
            reason: `Booking is ${booking.status}`
          })
        };
      }

      // Check 3-hour window
      const now = new Date();
      const bookingTime = new Date(booking.booking_time);
      const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < 3) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Cannot reschedule',
            reason: 'Booking is within 3 hours. Please contact us directly.'
          })
        };
      }

      // Check reschedule limit
      if ((booking.reschedule_count || 0) >= 2) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Reschedule limit reached',
            reason: 'Maximum 2 reschedules allowed. Please contact us for assistance.'
          })
        };
      }

      // Fetch available therapists for the service
      const { data: therapistLinks } = await supabase
        .from('therapist_services')
        .select('therapist_id')
        .eq('service_id', booking.service_id);

      const therapistIds = (therapistLinks || []).map(link => link.therapist_id);

      const { data: availableTherapists } = await supabase
        .from('therapist_profiles')
        .select('id, first_name, last_name, gender, profile_pic')
        .in('id', therapistIds)
        .eq('is_active', true);

      // Fetch pricing data
      const { data: durationPricing } = await supabase
        .from('duration_pricing')
        .select('duration_minutes, uplift_percentage')
        .eq('is_active', true)
        .order('sort_order');

      const { data: timePricingRules } = await supabase
        .from('time_pricing_rules')
        .select('day_of_week, start_time, end_time, uplift_percentage, label')
        .eq('is_active', true);

      // Fetch business settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value');

      const businessSettings = {};
      if (settings) {
        for (const s of settings) {
          if (s.key === 'business_opening_time') businessSettings.businessOpeningHour = Number(s.value);
          if (s.key === 'business_closing_time') businessSettings.businessClosingHour = Number(s.value);
          if (s.key === 'min_booking_advance_hours') businessSettings.minBookingAdvanceHours = Number(s.value);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          booking: {
            id: booking.id,
            booking_id: booking.booking_id,
            booking_time: booking.booking_time,
            booking_timezone: booking.booking_timezone || 'Australia/Brisbane',
            duration_minutes: booking.duration_minutes,
            service_id: booking.service_id,
            service_name: booking.services?.name,
            therapist_id: booking.therapist_id,
            therapist_name: booking.therapist_profiles
              ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
              : null,
            address: booking.address,
            price: booking.price,
            gender_preference: booking.gender_preference,
            reschedule_count: booking.reschedule_count || 0,
            customer_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim(),
            customer_email: booking.customer_email,
            customer_phone: booking.customer_phone
          },
          availableTherapists: availableTherapists || [],
          durationPricing: durationPricing || [],
          timePricingRules: timePricingRules || [],
          businessSettings
        })
      };
    }

    // POST: Process the reschedule
    if (event.httpMethod === 'POST') {
      const {
        token,
        new_booking_time,
        new_therapist_id
      } = JSON.parse(event.body);

      if (!token || !new_booking_time) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Token and new booking time are required' })
        };
      }

      // Fetch current booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          services (id, name, service_base_price),
          therapist_profiles!bookings_therapist_id_fkey (id, first_name, last_name, email, phone)
        `)
        .eq('reschedule_token', token)
        .single();

      if (bookingError || !booking) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Booking not found' })
        };
      }

      // Validate status
      if (['cancelled', 'client_cancelled', 'completed'].includes(booking.status)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Cannot reschedule ${booking.status} booking` })
        };
      }

      // Check 3-hour window
      const now = new Date();
      const currentBookingTime = new Date(booking.booking_time);
      const hoursUntil = (currentBookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < 3) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Cannot reschedule within 3 hours of appointment' })
        };
      }

      // Check reschedule limit
      if ((booking.reschedule_count || 0) >= 2) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Maximum reschedules reached (2)' })
        };
      }

      // Calculate new price
      const newPrice = await calculatePrice(
        booking.service_id,
        booking.duration_minutes,
        new_booking_time
      );

      const originalPrice = booking.price || 0;
      const priceDifference = newPrice - originalPrice;

      console.log(`💰 Price calculation: Original $${originalPrice} → New $${newPrice} = Difference $${priceDifference}`);

      // If price increased, charge the difference
      let additionalPaymentIntent = null;
      if (priceDifference > 0) {
        if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Payment required but no saved payment method',
              price_difference: priceDifference,
              message: 'Please contact us to complete the reschedule'
            })
          };
        }

        // Create payment intent for the difference
        try {
          // Attach payment method if needed
          try {
            await stripe.paymentMethods.attach(booking.stripe_payment_method_id, {
              customer: booking.stripe_customer_id,
            });
          } catch (attachError) {
            // May already be attached
            console.log('Payment method attach:', attachError.message);
          }

          additionalPaymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(priceDifference * 100),
            currency: 'aud',
            customer: booking.stripe_customer_id,
            payment_method: booking.stripe_payment_method_id,
            confirm: true,
            capture_method: 'manual', // Authorize only
            off_session: true,
            metadata: {
              booking_id: booking.booking_id,
              type: 'reschedule_additional_payment',
              original_price: originalPrice.toString(),
              new_price: newPrice.toString()
            },
            description: `Reschedule Additional Payment - ${booking.booking_id}`
          });

          if (additionalPaymentIntent.status !== 'requires_capture') {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                error: 'Payment authorization failed',
                message: additionalPaymentIntent.last_payment_error?.message || 'Card declined'
              })
            };
          }

          console.log(`✅ Additional payment authorized: ${additionalPaymentIntent.id}`);
        } catch (stripeError) {
          console.error('❌ Stripe error:', stripeError);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Payment failed',
              message: stripeError.message
            })
          };
        }
      }

      // Get new therapist details if changed
      let newTherapist = booking.therapist_profiles;
      const therapistChanged = new_therapist_id && new_therapist_id !== booking.therapist_id;

      if (therapistChanged) {
        const { data: therapist } = await supabase
          .from('therapist_profiles')
          .select('id, first_name, last_name, email, phone')
          .eq('id', new_therapist_id)
          .single();

        if (therapist) {
          newTherapist = therapist;
        }
      }

      // Store original values for notification
      const originalBookingTime = booking.booking_time;
      const originalTherapistName = booking.therapist_profiles
        ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
        : 'Previous therapist';

      // Update booking
      const updateData = {
        booking_time: new_booking_time,
        therapist_id: new_therapist_id || booking.therapist_id,
        price: newPrice,
        reschedule_count: (booking.reschedule_count || 0) + 1,
        updated_at: new Date().toISOString()
      };

      // If there was additional payment, update payment info
      if (additionalPaymentIntent) {
        updateData.payment_notes = `${booking.payment_notes || ''}\nReschedule additional payment: $${priceDifference} (${additionalPaymentIntent.id})`.trim();
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        // Cancel the payment if booking update failed
        if (additionalPaymentIntent) {
          try {
            await stripe.paymentIntents.cancel(additionalPaymentIntent.id);
          } catch (e) {
            console.error('Failed to cancel payment intent:', e);
          }
        }
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update booking' })
        };
      }

      // Add to status history
      await supabase
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: 'rescheduled',
          notes: `Client rescheduled from ${formatShortDate(originalBookingTime)} to ${formatShortDate(new_booking_time)}${therapistChanged ? `. Therapist changed to ${newTherapist.first_name} ${newTherapist.last_name}` : ''}${priceDifference > 0 ? `. Additional payment: $${priceDifference}` : ''}`,
          changed_at: new Date().toISOString()
        });

      const timezone = booking.booking_timezone || 'Australia/Brisbane';
      const newTherapistName = newTherapist
        ? `${newTherapist.first_name} ${newTherapist.last_name}`
        : 'Your therapist';

      // Send notifications
      console.log('📧 Sending reschedule notifications...');

      // Customer email
      try {
        await sendEmail(EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID, {
          to_email: booking.customer_email,
          to_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim(),
          booking_id: booking.booking_id,
          service_name: booking.services?.name || 'Massage',
          booking_date: formatDate(new_booking_time, timezone),
          booking_time: formatTime(new_booking_time, timezone),
          therapist_name: newTherapistName,
          address: booking.address,
          duration: booking.duration_minutes,
          price: newPrice.toFixed(2),
          subject_line: `Booking Rescheduled - ${booking.booking_id}`
        });
        console.log('✅ Customer email sent');
      } catch (e) {
        console.error('❌ Customer email error:', e);
      }

      // Therapist email (to new therapist)
      if (newTherapist?.email) {
        try {
          await sendEmail(EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, {
            to_email: newTherapist.email,
            therapist_name: newTherapist.first_name,
            booking_id: booking.booking_id,
            client_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim(),
            client_phone: booking.customer_phone || 'N/A',
            service_name: booking.services?.name || 'Massage',
            booking_date: formatDate(new_booking_time, timezone),
            booking_time: formatTime(new_booking_time, timezone),
            address: booking.address,
            duration: booking.duration_minutes,
            therapist_fee: booking.therapist_fee || 'TBD',
            subject_line: `Booking Rescheduled - ${booking.booking_id}`
          });
          console.log('✅ Therapist email sent');
        } catch (e) {
          console.error('❌ Therapist email error:', e);
        }
      }

      // Customer SMS
      if (booking.customer_phone) {
        const customerSMS = `📅 BOOKING RESCHEDULED

Your booking ${booking.booking_id} has been rescheduled.
New Date: ${formatShortDate(new_booking_time, timezone)} at ${formatTime(new_booking_time, timezone)}
Therapist: ${newTherapistName}
${priceDifference > 0 ? `Additional charge: $${priceDifference.toFixed(2)}` : ''}
Check your email for full details!
- Rejuvenators`;

        try {
          await sendSMSNotification(booking.customer_phone, customerSMS);
          console.log('✅ Customer SMS sent');
        } catch (e) {
          console.error('❌ Customer SMS error:', e);
        }
      }

      // Therapist SMS
      if (newTherapist?.phone) {
        const therapistSMS = `📅 BOOKING RESCHEDULED

Booking ${booking.booking_id} has been rescheduled.
Client: ${booking.first_name || ''} ${booking.last_name || ''}
New Date: ${formatShortDate(new_booking_time, timezone)} at ${formatTime(new_booking_time, timezone)}
Fee: $${booking.therapist_fee || 'TBD'}

Check your email for full details!
- Rejuvenators`;

        try {
          await sendSMSNotification(newTherapist.phone, therapistSMS);
          console.log('✅ Therapist SMS sent');
        } catch (e) {
          console.error('❌ Therapist SMS error:', e);
        }
      }

      // If therapist changed, notify old therapist about cancellation
      if (therapistChanged && booking.therapist_profiles?.phone) {
        const oldTherapistSMS = `📅 BOOKING CHANGE

Booking ${booking.booking_id} has been reassigned.
The client rescheduled and selected a different therapist.

- Rejuvenators`;

        try {
          await sendSMSNotification(booking.therapist_profiles.phone, oldTherapistSMS);
          console.log('✅ Old therapist SMS sent');
        } catch (e) {
          console.error('❌ Old therapist SMS error:', e);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Booking rescheduled successfully',
          booking: {
            booking_id: booking.booking_id,
            new_booking_time: new_booking_time,
            new_therapist: newTherapistName,
            new_price: newPrice,
            price_difference: priceDifference,
            additional_payment: additionalPaymentIntent ? {
              id: additionalPaymentIntent.id,
              amount: priceDifference
            } : null
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('❌ Client reschedule error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
