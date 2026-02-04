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
const EMAILJS_RESCHEDULE_REQUEST_TEMPLATE_ID = process.env.EMAILJS_RESCHEDULE_REQUEST_TEMPLATE_ID || 'Booking_Rescheduled';

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

// Helper: Determine if a booking time is after-hours or weekend
function isAfterHoursOrWeekend(bookingTime, businessOpeningHour = 9, businessClosingHour = 17) {
  const date = new Date(bookingTime);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = date.getHours();

  // Weekend (Saturday or Sunday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isAfterHours: true, rateType: 'weekend' };
  }

  // After hours (before opening or after closing)
  if (hour < businessOpeningHour || hour >= businessClosingHour) {
    return { isAfterHours: true, rateType: 'afterhours' };
  }

  return { isAfterHours: false, rateType: 'daytime' };
}

// Helper: Calculate therapist fee for a given booking time
async function calculateTherapistFee(therapistId, serviceId, bookingTime, durationMinutes) {
  console.log(`💰 Calculating therapist fee for therapist ${therapistId}, service ${serviceId}`);

  // Get business hours
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['business_opening_time', 'business_closing_time']);

  let businessOpeningHour = 9;
  let businessClosingHour = 17;
  if (settings) {
    for (const s of settings) {
      if (s.key === 'business_opening_time') businessOpeningHour = Number(s.value);
      if (s.key === 'business_closing_time') businessClosingHour = Number(s.value);
    }
  }

  // Determine rate type
  const { rateType } = isAfterHoursOrWeekend(bookingTime, businessOpeningHour, businessClosingHour);
  console.log(`   Rate type: ${rateType}`);

  // Try to get service-specific rate first
  const { data: serviceRate } = await supabase
    .from('therapist_service_rates')
    .select('normal_rate, afterhours_rate')
    .eq('therapist_id', therapistId)
    .eq('service_id', serviceId)
    .eq('is_active', true)
    .maybeSingle();

  let normalRate, afterHoursRate;

  if (serviceRate) {
    normalRate = serviceRate.normal_rate;
    afterHoursRate = serviceRate.afterhours_rate;
    console.log(`   Using service-specific rates: normal=$${normalRate}, afterhours=$${afterHoursRate}`);
  } else {
    // Fallback to therapist profile rates
    const { data: therapist } = await supabase
      .from('therapist_profiles')
      .select('hourly_rate, afterhours_rate')
      .eq('id', therapistId)
      .single();

    if (!therapist) {
      console.error(`   ❌ Therapist not found: ${therapistId}`);
      return null;
    }

    normalRate = therapist.hourly_rate;
    afterHoursRate = therapist.afterhours_rate;
    console.log(`   Using profile rates: normal=$${normalRate}, afterhours=$${afterHoursRate}`);
  }

  if (!normalRate || !afterHoursRate) {
    console.error(`   ❌ Missing rates for therapist ${therapistId}`);
    return null;
  }

  // Select appropriate rate
  const hourlyRate = (rateType === 'weekend' || rateType === 'afterhours') ? afterHoursRate : normalRate;
  const hoursWorked = durationMinutes / 60;
  const therapistFee = Math.round(hoursWorked * hourlyRate * 100) / 100;

  console.log(`   Hourly rate: $${hourlyRate}, Hours: ${hoursWorked}, Fee: $${therapistFee}`);

  return {
    therapistFee,
    hourlyRate,
    hoursWorked,
    rateType
  };
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

// Get time-based uplift percentage for a given booking time
async function getTimeUpliftPercentage(bookingTime) {
  const bookingDate = new Date(bookingTime);
  const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
  const timeString = bookingDate.toTimeString().substring(0, 5); // HH:MM

  console.log(`📅 Checking time uplift for day ${dayOfWeek}, time ${timeString}`);

  // Get ALL active time pricing rules for this day
  const { data: allRules, error } = await supabase
    .from('time_pricing_rules')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('❌ Error fetching time rules:', error);
    return 0;
  }

  console.log(`📋 Found ${allRules?.length || 0} active time pricing rules`);

  // Filter rules for this day of week
  const dayRules = (allRules || []).filter(rule => Number(rule.day_of_week) === dayOfWeek);
  console.log(`📋 Rules for day ${dayOfWeek}: ${dayRules.length}`);

  // Find matching rules where booking time is within the time range
  let maxUplift = 0;
  let appliedLabel = null;

  for (const rule of dayRules) {
    console.log(`🔍 Checking rule: ${rule.label}, start: ${rule.start_time}, end: ${rule.end_time}`);
    if (timeString >= rule.start_time && timeString < rule.end_time) {
      console.log(`✅ Rule matches! Uplift: ${rule.uplift_percentage}%`);
      if (rule.uplift_percentage > maxUplift) {
        maxUplift = rule.uplift_percentage;
        appliedLabel = rule.label;
      }
    }
  }

  if (maxUplift > 0) {
    console.log(`📈 Max time uplift: ${maxUplift}% (${appliedLabel})`);
  } else {
    console.log(`ℹ️ No time uplift applies`);
  }

  return maxUplift;
}

// Calculate price difference for reschedule
// Uses original client_fee as base and only applies time-based uplift difference
async function calculateReschedulePriceDifference(originalPrice, originalBookingTime, newBookingTime) {
  console.log(`💰 Calculating reschedule price difference...`);
  console.log(`   Original price: $${originalPrice}`);
  console.log(`   Original time: ${originalBookingTime}`);
  console.log(`   New time: ${newBookingTime}`);

  // Get time uplift for original booking time
  const originalUplift = await getTimeUpliftPercentage(originalBookingTime);
  console.log(`   Original time uplift: ${originalUplift}%`);

  // Get time uplift for new booking time
  const newUplift = await getTimeUpliftPercentage(newBookingTime);
  console.log(`   New time uplift: ${newUplift}%`);

  // If new time has higher uplift, calculate the additional charge
  if (newUplift > originalUplift) {
    // Calculate the base price (original price without its time uplift)
    const basePrice = originalPrice / (1 + originalUplift / 100);
    console.log(`   Base price (without uplift): $${basePrice.toFixed(2)}`);

    // Calculate new price with new uplift
    const newPrice = basePrice * (1 + newUplift / 100);
    console.log(`   New price (with ${newUplift}% uplift): $${newPrice.toFixed(2)}`);

    const priceDifference = newPrice - originalPrice;
    console.log(`   Price difference to charge: $${priceDifference.toFixed(2)}`);

    return {
      newPrice: Math.round(newPrice * 100) / 100,
      priceDifference: Math.round(priceDifference * 100) / 100,
      originalUplift,
      newUplift
    };
  }

  // No additional charge needed (same or lower uplift - no refund for cheaper time)
  console.log(`   No additional charge (new uplift ${newUplift}% <= original uplift ${originalUplift}%)`);
  return {
    newPrice: originalPrice,
    priceDifference: 0,
    originalUplift,
    newUplift
  };
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
            client_fee: booking.client_fee,
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
        new_therapist_id,
        payment_intent_id
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

      // Calculate price difference using original client_fee as base
      // Only charge for time-based uplift differences (duration doesn't change)
      const originalPrice = booking.client_fee || booking.price || 0;

      const priceResult = await calculateReschedulePriceDifference(
        originalPrice,
        booking.booking_time,
        new_booking_time
      );

      const { newPrice, priceDifference } = priceResult;

      console.log(`💰 Reschedule price: Original $${originalPrice} → New $${newPrice} = Difference $${priceDifference}`);

      // Note: If price increased, payment was already authorized via Stripe Elements on the frontend
      // The payment_intent_client_secret is passed from the frontend after successful authorization

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
      const originalTherapistFee = booking.therapist_fee;

      // Recalculate therapist fee for the new time/therapist
      const finalTherapistId = new_therapist_id || booking.therapist_id;
      const feeResult = await calculateTherapistFee(
        finalTherapistId,
        booking.service_id,
        new_booking_time,
        booking.duration_minutes
      );

      let newTherapistFee = originalTherapistFee;
      if (feeResult) {
        newTherapistFee = feeResult.therapistFee;
        console.log(`💰 Therapist fee: Original $${originalTherapistFee} → New $${newTherapistFee} (${feeResult.rateType})`);
      } else {
        console.warn('⚠️ Could not calculate new therapist fee, keeping original');
      }

      // Update booking - store original details for potential revert, set status to pending
      const updateData = {
        // Store original booking details for revert if all therapists unavailable
        original_booking_time: booking.booking_time,
        original_therapist_id: booking.therapist_id,
        original_client_fee: booking.client_fee || booking.price,
        // Update to new requested details
        booking_time: new_booking_time,
        therapist_id: finalTherapistId,
        price: newPrice,
        client_fee: newPrice,
        therapist_fee: newTherapistFee,
        // Set status to pending - requires therapist confirmation
        status: 'pending',
        reschedule_count: (booking.reschedule_count || 0) + 1,
        updated_at: new Date().toISOString()
      };

      // Store payment intent ID for capture when therapist accepts (if there's additional payment)
      if (priceDifference > 0 && payment_intent_id) {
        updateData.pending_payment_intent_id = payment_intent_id;
        updateData.payment_notes = `${booking.payment_notes || ''}\nReschedule additional payment pending: $${priceDifference.toFixed(2)} (PI: ${payment_intent_id})`.trim();
      }

      // Note if therapist fee changed
      if (newTherapistFee !== originalTherapistFee) {
        const feeNote = `\nTherapist fee updated: $${originalTherapistFee} → $${newTherapistFee}`;
        updateData.payment_notes = `${updateData.payment_notes || ''}${feeNote}`.trim();
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (updateError) {
        console.error('❌ Update error:', updateError);
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
          status: 'reschedule_requested',
          notes: `Client requested reschedule from ${formatShortDate(originalBookingTime)} to ${formatShortDate(new_booking_time)}${therapistChanged ? `. New therapist: ${newTherapist.first_name} ${newTherapist.last_name}` : ''}${priceDifference > 0 ? `. Additional payment authorized: $${priceDifference.toFixed(2)}` : ''}. Awaiting therapist confirmation.`,
          changed_at: new Date().toISOString()
        });

      const timezone = booking.booking_timezone || 'Australia/Brisbane';
      const newTherapistName = newTherapist
        ? `${newTherapist.first_name} ${newTherapist.last_name}`
        : 'Your therapist';

      // Generate response URLs for therapist (using booking_id, action, therapist_id format)
      const baseUrl = process.env.URL || 'https://booking.rejuvenators.com';
      const acceptUrl = `${baseUrl}/.netlify/functions/therapist-response?booking_id=${booking.booking_id}&action=accept_reschedule&therapist_id=${finalTherapistId}`;
      const unavailableUrl = `${baseUrl}/.netlify/functions/therapist-response?booking_id=${booking.booking_id}&action=unavailable_reschedule&therapist_id=${finalTherapistId}`;

      // Send notifications - RESCHEDULE REQUEST (not confirmation)
      console.log('📧 Sending reschedule REQUEST notifications...');

      // Therapist email - RESCHEDULE REQUEST with Accept/Unavailable buttons
      if (newTherapist?.email) {
        try {
          await sendEmail(EMAILJS_RESCHEDULE_REQUEST_TEMPLATE_ID, {
            to_email: newTherapist.email,
            therapist_name: newTherapist.first_name,
            booking_id: booking.booking_id,
            client_name: `${booking.first_name || ''} ${booking.last_name || ''}`.trim(),
            client_phone: booking.customer_phone || 'N/A',
            service_name: booking.services?.name || 'Massage',
            // Original booking details
            original_date: formatDate(originalBookingTime, timezone),
            original_time: formatTime(originalBookingTime, timezone),
            // New requested details
            new_date: formatDate(new_booking_time, timezone),
            new_time: formatTime(new_booking_time, timezone),
            address: booking.address,
            duration: booking.duration_minutes,
            therapist_fee: newTherapistFee ? `$${newTherapistFee.toFixed(2)}` : 'TBD',
            // Response URLs
            accept_url: acceptUrl,
            unavailable_url: unavailableUrl,
            subject_line: `Reschedule Request - ${booking.booking_id}`
          });
          console.log('✅ Therapist reschedule request email sent');
        } catch (e) {
          console.error('❌ Therapist email error:', e);
        }
      }

      // Therapist SMS - Reschedule request notification
      if (newTherapist?.phone) {
        const therapistSMS = `📅 RESCHEDULE REQUEST

Booking ${booking.booking_id} - Client requests reschedule.
Client: ${booking.first_name || ''} ${booking.last_name || ''}
New Date: ${formatShortDate(new_booking_time, timezone)} at ${formatTime(new_booking_time, timezone)}
Fee: $${newTherapistFee ? newTherapistFee.toFixed(2) : 'TBD'}

Please check your email to Accept or mark Unavailable.
- Rejuvenators`;

        try {
          await sendSMSNotification(newTherapist.phone, therapistSMS);
          console.log('✅ Therapist SMS sent');
        } catch (e) {
          console.error('❌ Therapist SMS error:', e);
        }
      }

      // Customer SMS - Pending confirmation (not confirmed yet)
      if (booking.customer_phone) {
        const customerSMS = `📅 RESCHEDULE REQUEST SUBMITTED

Your reschedule request for booking ${booking.booking_id} has been submitted.
Requested: ${formatShortDate(new_booking_time, timezone)} at ${formatTime(new_booking_time, timezone)}

We'll notify you once the therapist confirms.
- Rejuvenators`;

        try {
          await sendSMSNotification(booking.customer_phone, customerSMS);
          console.log('✅ Customer SMS sent');
        } catch (e) {
          console.error('❌ Customer SMS error:', e);
        }
      }

      // Note: Don't notify old therapist yet - only when reschedule is confirmed

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          pending_confirmation: true,
          message: 'Reschedule request submitted. Awaiting therapist confirmation.',
          booking: {
            booking_id: booking.booking_id,
            new_booking_time: new_booking_time,
            new_therapist: newTherapistName,
            new_price: newPrice,
            price_difference: priceDifference > 0 ? priceDifference : 0,
            status: 'pending'
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
