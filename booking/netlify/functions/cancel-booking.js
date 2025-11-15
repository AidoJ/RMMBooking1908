const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html'
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get booking_id from query parameters
    const params = event.queryStringParameters || {};
    const bookingId = params.booking_id || params.booking;

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Missing booking ID')
      };
    }

    console.log('🚫 Processing cancellation request for booking:', bookingId);

    // Fetch booking with related data
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name),
        customers (first_name, last_name, email, phone),
        therapist_profiles!bookings_therapist_id_fkey (first_name, last_name, email, phone)
      `)
      .eq('booking_id', bookingId)
      .single();

    if (fetchError || !booking) {
      console.error('❌ Error fetching booking:', fetchError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Booking not found')
      };
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      return {
        statusCode: 200,
        headers,
        body: generateAlreadyCancelledPage(booking)
      };
    }

    // Fetch system settings for cancellation policy
    const { data: settings } = await supabase
      .from('system_settings')
      .select('cancellation_hours_prior, business_phone')
      .single();

    const cancellationHoursPrior = settings?.cancellation_hours_prior || 24;
    const businessPhone = settings?.business_phone || '1300 302 542';

    // Calculate hours until booking
    const bookingTime = new Date(booking.booking_time);
    const now = new Date();
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    console.log('⏰ Hours until booking:', hoursUntilBooking, 'Cancellation policy:', cancellationHoursPrior);

    // Check if cancellation is allowed
    if (hoursUntilBooking < cancellationHoursPrior) {
      console.log('❌ Cancellation not allowed - too close to booking time');
      return {
        statusCode: 200,
        headers,
        body: generateNotAllowedPage(booking, cancellationHoursPrior, businessPhone)
      };
    }

    // Cancellation is allowed - update booking status
    console.log('✅ Cancellation allowed - updating booking');

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Cancelled by customer via email link',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', bookingId);

    if (updateError) {
      console.error('❌ Error updating booking:', updateError);
      throw new Error('Failed to cancel booking');
    }

    // If recurring, update all occurrences to cancelled
    if (booking.is_recurring === true || booking.is_recurring === 'true') {
      console.log('🔄 Recurring booking - cancelling all occurrences');

      const { error: occurrencesError } = await supabase
        .from('booking_occurrences')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId);

      if (occurrencesError) {
        console.error('❌ Error cancelling occurrences:', occurrencesError);
      } else {
        console.log('✅ All occurrences cancelled');
      }
    }

    console.log('✅ Booking cancelled successfully');

    // TODO: Send cancellation emails to client and therapist
    // await sendCancellationEmails(booking);

    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(booking)
    };

  } catch (error) {
    console.error('❌ Error in cancel-booking function:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorPage('An error occurred while processing your cancellation')
    };
  }
};

function generateSuccessPage(booking) {
  const isRecurring = booking.is_recurring === true || booking.is_recurring === 'true';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancelled</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 600px;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #dc2626; font-size: 32px; margin-bottom: 16px; }
        p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 12px; }
        .booking-id {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
          margin: 24px 0;
          font-weight: 600;
          color: #1f2937;
        }
        .info-box {
          background: #fef2f2;
          border-left: 4px solid #dc2626;
          padding: 16px;
          border-radius: 4px;
          margin: 20px 0;
          text-align: left;
        }
        .info-box strong { color: #991b1b; }
        .button {
          display: inline-block;
          background: #007e8c;
          color: white;
          padding: 14px 28px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          margin-top: 24px;
          transition: background 0.2s;
        }
        .button:hover { background: #006673; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">✅</div>
        <h1>Booking Cancelled</h1>
        <p>Your ${isRecurring ? 'recurring booking series has' : 'booking has'} been successfully cancelled.</p>

        <div class="booking-id">
          Booking ID: ${booking.booking_id}
        </div>

        ${isRecurring ? `
        <div class="info-box">
          <strong>🔄 Recurring Booking Series</strong>
          <p style="margin-top: 8px;">All ${booking.total_occurrences} sessions in this series have been cancelled.</p>
        </div>
        ` : ''}

        <div class="info-box">
          <strong>📧 Confirmation Email</strong>
          <p style="margin-top: 8px;">A cancellation confirmation email has been sent to your email address.</p>
        </div>

        <p style="margin-top: 24px;">Thank you for letting us know. We hope to serve you again in the future.</p>

        <a href="https://rejuvenators.com.au" class="button">Return to Website</a>
      </div>
    </body>
    </html>
  `;
}

function generateNotAllowedPage(booking, cancellationHoursPrior, businessPhone) {
  const isRecurring = booking.is_recurring === true || booking.is_recurring === 'true';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cancellation Not Allowed</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 600px;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #d97706; font-size: 32px; margin-bottom: 16px; }
        p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 12px; }
        .booking-id {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
          margin: 24px 0;
          font-weight: 600;
          color: #1f2937;
        }
        .warning-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 20px;
          border-radius: 4px;
          margin: 24px 0;
          text-align: left;
        }
        .warning-box strong { color: #92400e; font-size: 18px; }
        .phone {
          font-size: 28px;
          font-weight: 700;
          color: #007e8c;
          margin: 24px 0;
        }
        a { color: #007e8c; font-weight: 600; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>Cancellation Not Allowed Online</h1>
        <p>Your ${isRecurring ? 'recurring booking series is' : 'booking is'} scheduled within the ${cancellationHoursPrior}-hour cancellation window.</p>

        <div class="booking-id">
          Booking ID: ${booking.booking_id}
        </div>

        <div class="warning-box">
          <strong>📞 Please Call Us</strong>
          <p style="margin-top: 12px; color: #78350f;">To discuss cancellation options for this booking, please contact our team directly.</p>
        </div>

        <div class="phone">
          <a href="tel:${businessPhone.replace(/\s/g, '')}">${businessPhone}</a>
        </div>

        <p>Our team is available to assist you and discuss any special circumstances.</p>
      </div>
    </body>
    </html>
  `;
}

function generateAlreadyCancelledPage(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Already Cancelled</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 600px;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #4b5563; font-size: 32px; margin-bottom: 16px; }
        p { color: #6b7280; font-size: 16px; line-height: 1.6; }
        .booking-id {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
          margin: 24px 0;
          font-weight: 600;
          color: #1f2937;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">ℹ️</div>
        <h1>Already Cancelled</h1>
        <p>This booking has already been cancelled.</p>

        <div class="booking-id">
          Booking ID: ${booking.booking_id}
        </div>

        <p>If you have any questions, please contact us at 1300 302 542.</p>
      </div>
    </body>
    </html>
  `;
}

function generateErrorPage(message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Error</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 600px;
          text-align: center;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #dc2626; font-size: 32px; margin-bottom: 16px; }
        p { color: #4b5563; font-size: 16px; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Error</h1>
        <p>${message}</p>
        <p style="margin-top: 20px;">Please contact us at 1300 302 542 for assistance.</p>
      </div>
    </body>
    </html>
  `;
}
