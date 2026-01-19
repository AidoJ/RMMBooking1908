/**
 * Booking Reschedule Function (Option A - Contact to Reschedule)
 *
 * Shows booking details and provides contact information for rescheduling.
 * Policy: Can reschedule up to 3 hours before appointment.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate HTML response
function generateHTML(booking, hoursUntil, canReschedule) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Booking - Rejuvenators Mobile Massage</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background-color: #007e8c; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .info { background-color: #e8f4f5; color: #007e8c; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007e8c; }
        .warning { background-color: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5c6cb; }
        .details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 10px 0; border-bottom: 1px solid #eee; }
        .contact-box { background-color: #28a745; color: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .contact-box h3 { margin-top: 0; }
        .contact-box a { color: white; text-decoration: underline; font-size: 18px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007e8c; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .policy { background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Reschedule Your Booking</h1>
        </div>
        <div class="content">
            ${canReschedule ? `
            <div class="info">
                <h3 style="margin-top: 0;">Want to change your appointment time?</h3>
                <p>We're happy to help you find a new time that works better for you.</p>
            </div>
            ` : `
            <div class="error">
                <h3 style="margin-top: 0;">⚠️ Rescheduling Not Available</h3>
                <p>Your booking is in less than 3 hours. Per our policy, appointments cannot be rescheduled within 3 hours of the scheduled time.</p>
                <p>If you have an emergency, please call us immediately.</p>
            </div>
            `}

            <div class="details">
                <h3 style="margin-top: 0;">Current Booking Details</h3>
                <table>
                    <tr><td><strong>Booking ID:</strong></td><td>${booking.booking_id}</td></tr>
                    <tr><td><strong>Service:</strong></td><td>${booking.services?.name || 'Massage Service'}</td></tr>
                    <tr><td><strong>Duration:</strong></td><td>${booking.duration_minutes} minutes</td></tr>
                    <tr><td><strong>Current Date & Time:</strong></td><td>${new Date(booking.booking_time).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
                    <tr><td><strong>Therapist:</strong></td><td>${booking.therapist_profiles ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}` : 'To be assigned'}</td></tr>
                    <tr><td><strong>Address:</strong></td><td>${booking.address}</td></tr>
                </table>
            </div>

            ${canReschedule ? `
            <div class="contact-box">
                <h3>📞 Contact Us to Reschedule</h3>
                <p style="margin-bottom: 15px;">Please call or email us with your preferred new date and time:</p>
                <p style="font-size: 24px; margin: 10px 0;"><a href="tel:1300302542">1300 302 542</a></p>
                <p style="font-size: 18px; margin: 10px 0;"><a href="mailto:info@rejuvenators.com?subject=Reschedule%20Booking%20${booking.booking_id}">info@rejuvenators.com</a></p>
                <p style="font-size: 14px; margin-top: 15px; opacity: 0.9;">When contacting us, please mention your Booking ID: <strong>${booking.booking_id}</strong></p>
            </div>

            <div class="warning">
                <h4 style="margin-top: 0;">📝 Rescheduling Policy</h4>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Reschedules must be requested at least 3 hours before your appointment</li>
                    <li>Subject to therapist availability</li>
                    <li>We'll do our best to accommodate your preferred time</li>
                    <li>The same therapist may not be available for the new time</li>
                </ul>
            </div>
            ` : `
            <div class="contact-box" style="background-color: #dc3545;">
                <h3>🆘 Emergency Contact</h3>
                <p style="margin-bottom: 15px;">If you have an emergency, please call us immediately:</p>
                <p style="font-size: 24px; margin: 10px 0;"><a href="tel:1300302542">1300 302 542</a></p>
            </div>
            `}

            <div class="policy">
                <strong>Cancellation Policy:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>More than 12 hours before:</strong> Full refund</li>
                    <li><strong>3-12 hours before:</strong> 50% cancellation fee applies</li>
                    <li><strong>Less than 3 hours before:</strong> No cancellations allowed</li>
                </ul>
            </div>

            <p style="text-align: center;">
                <a href="https://rejuvenators.com" class="btn">Return to Website</a>
            </p>
        </div>
        <div class="footer">
            <p>Thank you for choosing Rejuvenators Mobile Massage</p>
        </div>
    </div>
</body>
</html>`;
}

function generateErrorHTML(title, message) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Rejuvenators Mobile Massage</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background-color: #007e8c; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .error { background-color: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5c6cb; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007e8c; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rejuvenators Mobile Massage</h1>
        </div>
        <div class="content">
            <div class="error">
                <h2 style="margin-top: 0;">❌ ${title}</h2>
                <p>${message}</p>
            </div>
            <p style="text-align: center;">
                <a href="https://rejuvenators.com" class="btn">Return to Website</a>
            </p>
        </div>
        <div class="footer">
            <p>Questions? Contact us at 1300 302542 or info@rejuvenators.com</p>
        </div>
    </div>
</body>
</html>`;
}

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'text/html',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // Get token from query string
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Invalid Request', 'No reschedule token provided. Please use the link from your confirmation email.')
      };
    }

    // Look up booking by reschedule token
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name),
        therapist_profiles (id, first_name, last_name, email, phone)
      `)
      .eq('reschedule_token', token)
      .single();

    if (bookingError || !booking) {
      console.error('Booking lookup error:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorHTML('Booking Not Found', 'This reschedule link is invalid or has expired. Please contact us if you need assistance.')
      };
    }

    // Check if already cancelled
    if (booking.status === 'cancelled' || booking.status === 'client_cancelled') {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Booking Cancelled', 'This booking has been cancelled and cannot be rescheduled.')
      };
    }

    // Check if booking is completed
    if (booking.status === 'completed') {
      return {
        statusCode: 400,
        headers,
        body: generateErrorHTML('Booking Completed', 'This booking has already been completed and cannot be rescheduled.')
      };
    }

    // Calculate time until booking
    const now = new Date();
    const bookingTime = new Date(booking.booking_time);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Can reschedule if more than 3 hours away
    const canReschedule = hoursUntil >= 3;

    return {
      statusCode: 200,
      headers,
      body: generateHTML(booking, hoursUntil, canReschedule)
    };

  } catch (error) {
    console.error('Reschedule page error:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorHTML('Error', `An unexpected error occurred. Please contact us at 1300 302542 for assistance.`)
    };
  }
};
