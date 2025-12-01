const { createClient } = require('@supabase/supabase-js');
const { getLocalDate, getLocalTime, getShortDate, getLocalDateTime } = require('./utils/timezoneHelpers');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { booking_id, cancel_option, reason, cancelled_by } = JSON.parse(event.body);

    if (!booking_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing booking_id' })
      };
    }

    console.log(`📋 Processing cancellation for booking ${booking_id}, option: ${cancel_option}`);

    // Get the booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services(name),
        therapist_profiles!therapist_id(first_name, last_name, email, phone)
      `)
      .eq('booking_id', booking_id)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Booking is already cancelled' })
      };
    }

    // Get cancellation policy from system settings
    const { data: cancellationSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'booking_cancellation_hours')
      .single();

    const cancellationHours = cancellationSetting && cancellationSetting.value
      ? parseInt(cancellationSetting.value)
      : 24; // Default to 24 hours if not set

    console.log(`📋 Cancellation policy: ${cancellationHours} hours before booking`);

    // Check if cancellation is within restricted window
    const now = new Date();
    const bookingTime = new Date(booking.booking_time);
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    console.log(`⏰ Hours until booking: ${hoursUntilBooking.toFixed(2)}`);

    // Only enforce policy if cancelled_by is 'customer' (not admin/system)
    if (cancelled_by === 'customer' && hoursUntilBooking < cancellationHours) {
      const timezone = booking.booking_timezone || 'Australia/Brisbane';
      const localBookingTime = getLocalDateTime(booking.booking_time, timezone);

      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'Cancellation window closed',
          message: `Cancellations must be made at least ${cancellationHours} hours before your appointment. Your booking is scheduled for ${localBookingTime}. Please contact us at 1300 302542 to discuss cancellation options.`,
          cancellation_hours: cancellationHours,
          hours_remaining: hoursUntilBooking.toFixed(2)
        })
      };
    }

    // Determine refund eligibility
    const isFullRefundEligible = hoursUntilBooking >= cancellationHours;
    const refundMessage = isFullRefundEligible
      ? 'Your cancellation qualifies for a full refund according to our cancellation policy.'
      : 'As this cancellation is within our cancellation window, refund terms will be reviewed. Our team will contact you regarding refund options.';

    console.log(`💰 Refund eligible: ${isFullRefundEligible}`);

    const cancelReason = reason || 'Customer requested cancellation';
    let bookingsToCancel = [booking];
    let cancelledCount = 0;

    // Determine which bookings to cancel based on option
    if (cancel_option === 'remaining' || cancel_option === 'all') {
      // This is a series booking - get related bookings
      if (!booking.request_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'This booking is not part of a series' })
        };
      }

      let query = supabase
        .from('bookings')
        .select(`
          *,
          services(name),
          therapist_profiles!therapist_id(first_name, last_name, email, phone)
        `)
        .eq('request_id', booking.request_id)
        .neq('status', 'cancelled'); // Don't re-cancel already cancelled bookings

      if (cancel_option === 'remaining') {
        // Cancel this and future bookings only
        query = query.gte('occurrence_number', booking.occurrence_number);
      }
      // For 'all', we get all bookings in the series (no additional filter)

      const { data: seriesBookings, error: seriesError } = await query;

      if (seriesError) {
        console.error('❌ Error fetching series bookings:', seriesError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to fetch series bookings' })
        };
      }

      bookingsToCancel = seriesBookings;
    }

    console.log(`🚫 Cancelling ${bookingsToCancel.length} booking(s)`);

    // Cancel each booking
    for (const bookingToCancel of bookingsToCancel) {
      try {
        // Update booking status
        const nowISO = new Date().toISOString();
        await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancellation_reason: cancelReason,
            cancelled_at: nowISO,
            cancelled_by: cancelled_by || 'customer',
            updated_at: nowISO
          })
          .eq('id', bookingToCancel.id);

        // Add to status history
        await supabase
          .from('booking_status_history')
          .insert({
            booking_id: bookingToCancel.id,
            status: 'cancelled',
            notes: `Cancelled by ${cancelled_by || 'customer'}: ${cancelReason}`,
            changed_at: nowISO
          });

        // Send notifications for each cancelled booking
        if (bookingToCancel.email) {
          await sendCancellationEmail(bookingToCancel, cancelReason);
        }

        if (bookingToCancel.customer_phone) {
          await sendCancellationSMS(bookingToCancel);
        }

        // Notify therapist if assigned
        if (bookingToCancel.therapist_profiles?.email) {
          await sendTherapistCancellationEmail(bookingToCancel, cancelReason);
        }

        cancelledCount++;
        console.log(`✅ Cancelled booking ${bookingToCancel.booking_id}`);

      } catch (error) {
        console.error(`❌ Error cancelling booking ${bookingToCancel.booking_id}:`, error);
      }
    }

    console.log(`✅ Successfully cancelled ${cancelledCount} booking(s)`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        cancelled_count: cancelledCount,
        message: `Successfully cancelled ${cancelledCount} booking(s)`,
        refund_message: refundMessage,
        full_refund_eligible: isFullRefundEligible
      })
    };

  } catch (error) {
    console.error('❌ Cancellation error:', error);
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

// Send cancellation email to customer
async function sendCancellationEmail(booking, reason) {
  try {
    const emailjs = require('@emailjs/nodejs');

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    const templateParams = {
      to_email: booking.email,
      customer_name: booking.first_name,
      booking_id: booking.booking_id,
      service_name: booking.services?.name || 'Massage Service',
      booking_date: getLocalDate(booking.booking_time, timezone),
      booking_time: getLocalTime(booking.booking_time, timezone),
      address: booking.address || 'N/A',
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

// Send cancellation SMS to customer
async function sendCancellationSMS(booking) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log('⚠️ Twilio not configured - skipping SMS');
      return;
    }

    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';
    const dateStr = getShortDate(booking.booking_time, timezone);
    const timeStr = getLocalTime(booking.booking_time, timezone);

    const message = `BOOKING CANCELLED

Hi ${booking.first_name}, your booking ${booking.booking_id} scheduled for ${dateStr} at ${timeStr} has been cancelled.

If you'd like to rebook, please call 1300 302542.

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
async function sendTherapistCancellationEmail(booking, reason) {
  try {
    const emailjs = require('@emailjs/nodejs');

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    const templateParams = {
      to_email: booking.therapist_profiles.email,
      therapist_name: booking.therapist_profiles.first_name,
      client_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service_name: booking.services?.name || 'Massage Service',
      booking_date: getLocalDate(booking.booking_time, timezone),
      booking_time: getLocalTime(booking.booking_time, timezone),
      address: booking.address || 'N/A',
      reason: reason
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
