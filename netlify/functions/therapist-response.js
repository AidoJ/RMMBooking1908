const { createClient } = require('@supabase/supabase-js');
const { getLocalDate, getLocalTime, getShortDate } = require('./utils/timezoneHelpers');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Valid actions including reschedule actions
const VALID_ACTIONS = ['accept', 'decline', 'accept_reschedule', 'unavailable_reschedule'];

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

    if (!VALID_ACTIONS.includes(action)) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Invalid action.')
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
    const isRescheduleAction = action === 'accept_reschedule' || action === 'unavailable_reschedule';

    if (isRescheduleAction) {
      // For reschedule actions, booking should be in 'pending' status
      if (booking.status !== 'pending') {
        return {
          statusCode: 200,
          headers,
          body: generateAlreadyRespondedPage(booking, action)
        };
      }
    } else {
      // For regular accept/decline, check if already responded
      if (booking.status === 'confirmed' || booking.status === 'declined') {
        return {
          statusCode: 200,
          headers,
          body: generateAlreadyRespondedPage(booking, action)
        };
      }
    }

    // Process the response based on action type
    if (action === 'accept') {
      await handleAccept(booking, therapist);
    } else if (action === 'decline') {
      await handleDecline(booking, therapist);
    } else if (action === 'accept_reschedule') {
      await handleAcceptReschedule(booking, therapist);
    } else if (action === 'unavailable_reschedule') {
      await handleUnavailableReschedule(booking, therapist);
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

// Handle therapist accepting a reschedule request
async function handleAcceptReschedule(booking, therapist) {
  console.log('✅ Processing reschedule acceptance for booking:', booking.booking_id);

  // Check if this is a valid pending reschedule
  if (booking.status !== 'pending') {
    console.log('⚠️ Booking not in pending status:', booking.status);
    throw new Error('This reschedule request is no longer pending');
  }

  // Capture additional payment if there's a pending payment intent
  if (booking.pending_payment_intent_id) {
    try {
      console.log('💳 Capturing reschedule payment:', booking.pending_payment_intent_id);
      const paymentIntent = await stripe.paymentIntents.capture(booking.pending_payment_intent_id);
      console.log('✅ Payment captured:', paymentIntent.id, paymentIntent.status);
    } catch (captureError) {
      console.error('❌ Failed to capture payment:', captureError);
      // Log but continue - booking update is more important
      await addStatusHistory(booking.id, 'payment_capture_failed', therapist.id,
        `Failed to capture reschedule payment: ${captureError.message}`);
    }
  }

  // Update booking status to confirmed and clear original fields
  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      // Clear original fields since reschedule is now confirmed
      original_booking_time: null,
      original_therapist_id: null,
      original_client_fee: null,
      pending_payment_intent_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.booking_id);

  if (updateError) {
    console.error('❌ Update error:', updateError);
    throw new Error('Failed to confirm reschedule');
  }

  // Add status history
  await addStatusHistory(booking.id, 'reschedule_confirmed', therapist.id,
    'Reschedule accepted by therapist');

  // Notify old therapist if therapist changed
  if (booking.original_therapist_id && booking.original_therapist_id !== therapist.id) {
    try {
      const { data: oldTherapist } = await supabase
        .from('therapist_profiles')
        .select('phone, first_name')
        .eq('id', booking.original_therapist_id)
        .single();

      if (oldTherapist?.phone) {
        await sendSMS(oldTherapist.phone,
          `📅 BOOKING REASSIGNED\n\nBooking ${booking.booking_id} has been rescheduled to a different therapist.\n\n- Rejuvenators`);
      }
    } catch (e) {
      console.error('⚠️ Failed to notify old therapist:', e);
    }
  }

  // Send confirmation notifications
  const timezone = booking.booking_timezone || 'Australia/Brisbane';

  // Therapist SMS
  await sendSMS(therapist.phone,
    `✅ RESCHEDULE CONFIRMED!\n\nYou've accepted the rescheduled booking ${booking.booking_id}\nClient: ${booking.first_name} ${booking.last_name}\nDate: ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}\nFee: $${booking.therapist_fee || 'TBD'}\n\n- Rejuvenators`);

  // Customer SMS
  if (booking.customer_phone) {
    await sendSMS(booking.customer_phone,
      `✅ RESCHEDULE CONFIRMED!\n\nYour booking ${booking.booking_id} has been rescheduled and confirmed!\nNew Date: ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}\nTherapist: ${therapist.first_name} ${therapist.last_name}\n\nCheck your email for full details!\n- Rejuvenators`);
  }

  console.log('✅ Reschedule confirmed successfully');
}

// Handle therapist marking unavailable for reschedule
async function handleUnavailableReschedule(booking, therapist) {
  console.log('⚠️ Processing reschedule unavailable for booking:', booking.booking_id);

  // Check if this is a valid pending reschedule
  if (booking.status !== 'pending') {
    console.log('⚠️ Booking not in pending status:', booking.status);
    throw new Error('This reschedule request is no longer pending');
  }

  // Check if fallback_option is enabled for cascading
  if (booking.fallback_option === true || booking.fallback_option === 'Yes') {
    console.log('🔄 Fallback enabled, looking for alternate therapist...');

    // Find next available therapist for this slot
    const alternateTherapist = await findAlternateTherapist(booking, therapist.id);

    if (alternateTherapist) {
      console.log('👤 Found alternate therapist:', alternateTherapist.first_name, alternateTherapist.last_name);

      // Update booking with new therapist
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          therapist_id: alternateTherapist.id,
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', booking.booking_id);

      if (updateError) {
        console.error('❌ Failed to assign alternate therapist:', updateError);
        throw new Error('Failed to assign alternate therapist');
      }

      // Add status history
      await addStatusHistory(booking.id, 'reschedule_cascaded', therapist.id,
        `${therapist.first_name} unavailable. Cascading to ${alternateTherapist.first_name} ${alternateTherapist.last_name}`);

      // Recalculate therapist fee for the new therapist
      const newFee = await calculateTherapistFeeForReschedule(
        alternateTherapist.id,
        booking.service_id,
        booking.booking_time,
        booking.duration_minutes
      );

      if (newFee) {
        await supabase
          .from('bookings')
          .update({ therapist_fee: newFee.therapistFee })
          .eq('booking_id', booking.booking_id);
      }

      // Send reschedule request to new therapist
      await sendRescheduleRequestToTherapist(booking, alternateTherapist);

      // Notify original therapist
      await sendSMS(therapist.phone,
        `📝 NOTED\n\nYou've marked yourself unavailable for the rescheduled booking ${booking.booking_id}. We're contacting another therapist.\n\n- Rejuvenators`);

      console.log('🔄 Reschedule cascaded to alternate therapist');
      return;
    }
  }

  // No cascade or no alternate found - revert to original booking
  console.log('↩️ Reverting to original booking...');

  // Cancel the pending payment if any
  if (booking.pending_payment_intent_id) {
    try {
      await stripe.paymentIntents.cancel(booking.pending_payment_intent_id);
      console.log('💳 Pending payment cancelled');
    } catch (e) {
      console.error('⚠️ Failed to cancel payment:', e);
    }
  }

  // Revert booking to original details
  const { error: revertError } = await supabase
    .from('bookings')
    .update({
      booking_time: booking.original_booking_time,
      therapist_id: booking.original_therapist_id,
      client_fee: booking.original_client_fee,
      price: booking.original_client_fee,
      status: 'confirmed', // Revert to confirmed with original details
      original_booking_time: null,
      original_therapist_id: null,
      original_client_fee: null,
      pending_payment_intent_id: null,
      reschedule_count: Math.max(0, (booking.reschedule_count || 1) - 1), // Don't count failed reschedule
      updated_at: new Date().toISOString()
    })
    .eq('booking_id', booking.booking_id);

  if (revertError) {
    console.error('❌ Failed to revert booking:', revertError);
    throw new Error('Failed to revert booking');
  }

  // Add status history
  await addStatusHistory(booking.id, 'reschedule_failed', therapist.id,
    'No therapists available for requested time. Reverted to original booking.');

  // Notify HQ
  await notifyHQRescheduleFailed(booking, therapist);

  // Notify therapist
  await sendSMS(therapist.phone,
    `📝 NOTED\n\nYou've marked yourself unavailable for booking ${booking.booking_id}. The original booking has been restored.\n\n- Rejuvenators`);

  // Notify customer
  if (booking.customer_phone) {
    const timezone = booking.booking_timezone || 'Australia/Brisbane';
    await sendSMS(booking.customer_phone,
      `❌ RESCHEDULE UNAVAILABLE\n\nSorry, no therapists are available for your requested time.\n\nYour original booking remains:\n${getShortDate(booking.original_booking_time, timezone)} at ${getLocalTime(booking.original_booking_time, timezone)}\n\nPlease try a different time or call us at 1300 302 542.\n- Rejuvenators`);
  }

  console.log('↩️ Booking reverted to original');
}

// Helper: Find alternate therapist for reschedule
async function findAlternateTherapist(booking, excludeTherapistId) {
  try {
    // Get therapists who provide this service and cover the location
    const { data: therapistLinks } = await supabase
      .from('therapist_services')
      .select('therapist_id')
      .eq('service_id', booking.service_id);

    if (!therapistLinks || therapistLinks.length === 0) return null;

    const therapistIds = therapistLinks.map(l => l.therapist_id).filter(id => id !== excludeTherapistId);

    // Get active therapists
    const { data: therapists } = await supabase
      .from('therapist_profiles')
      .select('*')
      .in('id', therapistIds)
      .eq('is_active', true);

    if (!therapists || therapists.length === 0) return null;

    // Filter by gender preference if specified
    let filtered = therapists;
    if (booking.gender_preference && booking.gender_preference !== 'any') {
      filtered = therapists.filter(t => t.gender === booking.gender_preference);
    }

    // Filter by location coverage
    if (booking.latitude && booking.longitude) {
      filtered = filtered.filter(t => {
        if (!t.latitude || !t.longitude) return false;
        if (t.service_radius_km) {
          const dist = getDistanceKm(booking.latitude, booking.longitude, t.latitude, t.longitude);
          return dist <= t.service_radius_km;
        }
        return false;
      });
    }

    // Check availability for the booking time
    const bookingDate = new Date(booking.booking_time);
    const dayOfWeek = bookingDate.getDay();

    for (const therapist of filtered) {
      const { data: availability } = await supabase
        .from('therapist_availability')
        .select('start_time, end_time')
        .eq('therapist_id', therapist.id)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (availability) {
        const bookingTime = bookingDate.toTimeString().substring(0, 5);
        if (bookingTime >= availability.start_time && bookingTime < availability.end_time) {
          // Check for conflicts
          const { data: conflicts } = await supabase
            .from('bookings')
            .select('id')
            .eq('therapist_id', therapist.id)
            .eq('booking_time', booking.booking_time)
            .in('status', ['requested', 'confirmed', 'timeout_reassigned', 'seeking_alternate', 'reschedule_requested'])
            .neq('id', booking.id);

          if (!conflicts || conflicts.length === 0) {
            return therapist;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error finding alternate therapist:', error);
    return null;
  }
}

// Helper: Calculate distance between two coordinates
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Calculate therapist fee for reschedule
async function calculateTherapistFeeForReschedule(therapistId, serviceId, bookingTime, durationMinutes) {
  try {
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

    const bookingDate = new Date(bookingTime);
    const dayOfWeek = bookingDate.getDay();
    const hour = bookingDate.getHours();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isAfterHours = hour < businessOpeningHour || hour >= businessClosingHour;

    // Get therapist rates
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
    } else {
      const { data: therapist } = await supabase
        .from('therapist_profiles')
        .select('hourly_rate, afterhours_rate')
        .eq('id', therapistId)
        .single();

      if (!therapist) return null;
      normalRate = therapist.hourly_rate;
      afterHoursRate = therapist.afterhours_rate;
    }

    const hourlyRate = (isWeekend || isAfterHours) ? afterHoursRate : normalRate;
    const hoursWorked = durationMinutes / 60;
    const therapistFee = Math.round(hoursWorked * hourlyRate * 100) / 100;

    return { therapistFee, hourlyRate, hoursWorked };
  } catch (error) {
    console.error('❌ Error calculating therapist fee:', error);
    return null;
  }
}

// Helper: Send reschedule request to new therapist
async function sendRescheduleRequestToTherapist(booking, therapist) {
  const timezone = booking.booking_timezone || 'Australia/Brisbane';
  const baseUrl = process.env.URL || 'https://booking.rejuvenators.com';

  const acceptUrl = `${baseUrl}/.netlify/functions/therapist-response?booking_id=${booking.booking_id}&action=accept_reschedule&therapist_id=${therapist.id}`;
  const unavailableUrl = `${baseUrl}/.netlify/functions/therapist-response?booking_id=${booking.booking_id}&action=unavailable_reschedule&therapist_id=${therapist.id}`;

  // Send SMS
  await sendSMS(therapist.phone,
    `📅 RESCHEDULE REQUEST\n\nBooking ${booking.booking_id} - Client requests reschedule.\nClient: ${booking.first_name} ${booking.last_name}\nDate: ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}\n\nCheck your email to Accept or mark Unavailable.\n- Rejuvenators`);

  // TODO: Also send email via EmailJS with the template
}

// Helper: Notify HQ about failed reschedule
async function notifyHQRescheduleFailed(booking, therapist) {
  try {
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    // Send SMS to HQ number (you may want to configure this)
    const hqPhone = process.env.HQ_PHONE || '+61731880899';

    await sendSMS(hqPhone,
      `⚠️ RESCHEDULE FAILED\n\nBooking ${booking.booking_id}\nClient: ${booking.first_name} ${booking.last_name}\nRequested: ${getShortDate(booking.booking_time, timezone)}\n\nNo therapists available. Original booking restored.\n\nClient may need follow-up.`);

    console.log('📞 HQ notified about failed reschedule');
  } catch (error) {
    console.error('❌ Failed to notify HQ:', error);
  }
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

${therapist.first_name} ${therapist.last_name} has accepted your booking for ${getShortDate(booking.booking_time, timezone)} at ${getLocalTime(booking.booking_time, timezone)}.

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
  let actionText, actionIcon, actionColor, additionalMessage = '';

  switch (action) {
    case 'accept':
      actionText = 'Accepted';
      actionIcon = '✅';
      actionColor = '#52c41a';
      break;
    case 'decline':
      actionText = 'Declined';
      actionIcon = '❌';
      actionColor = '#f5222d';
      break;
    case 'accept_reschedule':
      actionText = 'Reschedule Confirmed';
      actionIcon = '✅';
      actionColor = '#52c41a';
      additionalMessage = 'The client has been notified of the confirmed reschedule.';
      break;
    case 'unavailable_reschedule':
      actionText = 'Marked Unavailable';
      actionIcon = '📝';
      actionColor = '#faad14';
      additionalMessage = 'We are checking for alternate therapists or reverting to the original booking.';
      break;
    default:
      actionText = 'Processed';
      actionIcon = '✓';
      actionColor = '#1890ff';
  }
  
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






