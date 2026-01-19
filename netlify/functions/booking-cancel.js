/**
 * Booking Cancellation Function
 *
 * Handles client-initiated booking cancellations with policy enforcement:
 * - < 3 hours before: NOT allowed
 * - 3-12 hours before: 50% cancellation fee (50% refund)
 * - > 12 hours before: Full refund
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

// Helper to send emails via EmailJS
async function sendEmail(templateId, templateParams) {
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: templateParams
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`EmailJS error: ${errorText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Generate HTML response
function generateHTML(title, message, isSuccess, details = {}) {
  const bgColor = isSuccess ? '#d4edda' : '#f8d7da';
  const textColor = isSuccess ? '#155724' : '#721c24';
  const borderColor = isSuccess ? '#c3e6cb' : '#f5c6cb';
  const icon = isSuccess ? '✅' : '❌';

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
        .alert { background-color: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 10px 0; border-bottom: 1px solid #eee; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007e8c; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .policy { background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Rejuvenators Mobile Massage</h1>
        </div>
        <div class="content">
            <div class="alert">
                <h2 style="margin-top: 0;">${icon} ${title}</h2>
                <p>${message}</p>
            </div>
            ${details.booking_id ? `
            <div class="details">
                <h3 style="margin-top: 0;">Booking Details</h3>
                <table>
                    <tr><td><strong>Booking ID:</strong></td><td>${details.booking_id}</td></tr>
                    ${details.service ? `<tr><td><strong>Service:</strong></td><td>${details.service}</td></tr>` : ''}
                    ${details.date_time ? `<tr><td><strong>Date & Time:</strong></td><td>${details.date_time}</td></tr>` : ''}
                    ${details.refund_amount ? `<tr><td><strong>Refund Amount:</strong></td><td>${details.refund_amount}</td></tr>` : ''}
                    ${details.cancellation_fee ? `<tr><td><strong>Cancellation Fee:</strong></td><td>${details.cancellation_fee}</td></tr>` : ''}
                </table>
            </div>
            ` : ''}
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

// Generate cancellation confirmation page
function generateConfirmationPage(booking, hoursUntil, refundPercent, refundAmount, originalAmount) {
  const cancellationFee = originalAmount - refundAmount;

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Cancellation - Rejuvenators Mobile Massage</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background-color: #007e8c; color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .warning { background-color: #fff3cd; color: #856404; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
        .details { background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 10px 0; border-bottom: 1px solid #eee; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .btn { display: inline-block; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px; font-weight: bold; cursor: pointer; border: none; font-size: 16px; }
        .btn-danger { background-color: #dc3545; color: white; }
        .btn-secondary { background-color: #6c757d; color: white; }
        .refund-info { background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
        .fee-info { background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Confirm Cancellation</h1>
        </div>
        <div class="content">
            <div class="warning">
                <h3 style="margin-top: 0;">Are you sure you want to cancel this booking?</h3>
                <p>Your booking is scheduled in approximately <strong>${hoursUntil.toFixed(1)} hours</strong>.</p>
            </div>

            <div class="details">
                <h3 style="margin-top: 0;">Booking Details</h3>
                <table>
                    <tr><td><strong>Booking ID:</strong></td><td>${booking.booking_id}</td></tr>
                    <tr><td><strong>Service:</strong></td><td>${booking.services?.name || 'Massage Service'}</td></tr>
                    <tr><td><strong>Date & Time:</strong></td><td>${new Date(booking.booking_time).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
                    <tr><td><strong>Original Amount:</strong></td><td>$${originalAmount.toFixed(2)}</td></tr>
                </table>
            </div>

            ${refundPercent === 100 ? `
            <div class="refund-info">
                <h3 style="margin-top: 0;">✅ Full Refund</h3>
                <p>Since you're cancelling more than 12 hours before your appointment, you will receive a <strong>full refund of $${refundAmount.toFixed(2)}</strong>.</p>
            </div>
            ` : `
            <div class="fee-info">
                <h3 style="margin-top: 0;">⚠️ Cancellation Fee Applies</h3>
                <p>Since you're cancelling between 3-12 hours before your appointment:</p>
                <ul>
                    <li><strong>Cancellation Fee (50%):</strong> $${cancellationFee.toFixed(2)}</li>
                    <li><strong>Refund Amount (50%):</strong> $${refundAmount.toFixed(2)}</li>
                </ul>
            </div>
            `}

            <form method="POST" style="text-align: center; margin-top: 30px;">
                <input type="hidden" name="confirm" value="yes">
                <button type="submit" class="btn btn-danger">Yes, Cancel My Booking</button>
                <a href="https://rejuvenators.com" class="btn btn-secondary">No, Keep My Booking</a>
            </form>
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
        body: generateHTML('Invalid Request', 'No cancellation token provided. Please use the link from your confirmation email.', false)
      };
    }

    // Look up booking by cancel token
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (name),
        therapist_profiles (id, first_name, last_name, email, phone)
      `)
      .eq('cancel_token', token)
      .single();

    if (bookingError || !booking) {
      console.error('Booking lookup error:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: generateHTML('Booking Not Found', 'This cancellation link is invalid or has expired. Please contact us if you need assistance.', false)
      };
    }

    // Check if already cancelled
    if (booking.status === 'cancelled' || booking.status === 'client_cancelled') {
      return {
        statusCode: 400,
        headers,
        body: generateHTML('Already Cancelled', 'This booking has already been cancelled.', false, {
          booking_id: booking.booking_id
        })
      };
    }

    // Check if booking is completed
    if (booking.status === 'completed') {
      return {
        statusCode: 400,
        headers,
        body: generateHTML('Cannot Cancel', 'This booking has already been completed and cannot be cancelled.', false, {
          booking_id: booking.booking_id
        })
      };
    }

    // Calculate time until booking
    const now = new Date();
    const bookingTime = new Date(booking.booking_time);
    const hoursUntil = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    console.log(`📅 Booking ${booking.booking_id}: ${hoursUntil.toFixed(2)} hours until appointment`);

    // Policy check: Cannot cancel less than 3 hours before
    if (hoursUntil < 3) {
      return {
        statusCode: 400,
        headers,
        body: generateHTML(
          'Cancellation Not Allowed',
          `Your booking is in less than 3 hours. Per our cancellation policy, bookings cannot be cancelled within 3 hours of the appointment time. Please contact us at 1300 302542 if you have an emergency.`,
          false,
          {
            booking_id: booking.booking_id,
            service: booking.services?.name,
            date_time: bookingTime.toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })
          }
        )
      };
    }

    // Determine refund percentage based on time
    let refundPercent = 100; // > 12 hours = full refund
    if (hoursUntil >= 3 && hoursUntil <= 12) {
      refundPercent = 50; // 3-12 hours = 50% refund
    }

    const originalAmount = booking.price || 0;
    const refundAmount = (originalAmount * refundPercent) / 100;
    const cancellationFee = originalAmount - refundAmount;

    // Handle GET request - show confirmation page
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: generateConfirmationPage(booking, hoursUntil, refundPercent, refundAmount, originalAmount)
      };
    }

    // Handle POST request - process cancellation
    if (event.httpMethod === 'POST') {
      console.log(`🚫 Processing cancellation for booking ${booking.booking_id}`);
      console.log(`💰 Refund: ${refundPercent}% = $${refundAmount.toFixed(2)} of $${originalAmount.toFixed(2)}`);

      let refundId = null;
      let refundSuccess = false;

      // Process refund based on payment status
      if (booking.payment_intent_id) {
        try {
          // Get the payment intent to check its status
          const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);

          if (paymentIntent.status === 'requires_capture') {
            // Payment is authorized but not captured - just cancel it
            if (refundPercent === 100) {
              // Full cancellation - release the hold
              await stripe.paymentIntents.cancel(booking.payment_intent_id);
              console.log('✅ Payment authorization cancelled (full refund via release)');
              refundSuccess = true;
            } else {
              // Partial - capture only the cancellation fee amount
              const captureAmount = Math.round(cancellationFee * 100); // Convert to cents
              if (captureAmount > 0) {
                await stripe.paymentIntents.capture(booking.payment_intent_id, {
                  amount_to_capture: captureAmount
                });
                console.log(`✅ Captured partial amount: $${cancellationFee.toFixed(2)} as cancellation fee`);
              } else {
                await stripe.paymentIntents.cancel(booking.payment_intent_id);
              }
              refundSuccess = true;
            }
          } else if (paymentIntent.status === 'succeeded') {
            // Payment was captured - need to refund
            const refundAmountCents = Math.round(refundAmount * 100);

            if (refundAmountCents > 0) {
              const refund = await stripe.refunds.create({
                payment_intent: booking.payment_intent_id,
                amount: refundAmountCents,
                reason: 'requested_by_customer'
              });

              refundId = refund.id;
              console.log(`✅ Refund processed: ${refund.id} for $${refundAmount.toFixed(2)}`);
              refundSuccess = true;
            } else {
              console.log('No refund needed (0 amount)');
              refundSuccess = true;
            }
          } else {
            console.log(`Payment intent status: ${paymentIntent.status} - no refund action needed`);
            refundSuccess = true;
          }
        } catch (stripeError) {
          console.error('Stripe error:', stripeError);
          return {
            statusCode: 500,
            headers,
            body: generateHTML('Refund Error', `We encountered an error processing your refund. Please contact us at 1300 302542 for assistance. Error: ${stripeError.message}`, false, {
              booking_id: booking.booking_id
            })
          };
        }
      } else {
        // No payment intent - possibly invoice or manual payment
        console.log('No payment intent - manual refund may be required');
        refundSuccess = true;
      }

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'client_cancelled',
          payment_status: refundPercent === 100 ? 'refunded' : 'partial_refund',
          cancelled_at: new Date().toISOString(),
          client_cancelled_at: new Date().toISOString(),
          cancelled_by: 'client',
          cancellation_reason: `Client cancelled via email link. ${hoursUntil.toFixed(1)} hours before appointment.`,
          cancellation_fee: cancellationFee,
          refund_amount: refundAmount,
          refund_id: refundId,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        // Don't return error - refund was processed, just log the issue
      }

      // Add to booking status history
      await supabase
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: 'client_cancelled',
          notes: `Client cancelled booking via email link. Hours until appointment: ${hoursUntil.toFixed(1)}. Refund: $${refundAmount.toFixed(2)} (${refundPercent}%). Cancellation fee: $${cancellationFee.toFixed(2)}.`,
          changed_by: 'client',
          changed_at: new Date().toISOString()
        });

      // Notify therapist
      if (booking.therapist_profiles?.email) {
        try {
          await sendEmail(process.env.EMAILJS_THERAPIST_NOTIFICATION_TEMPLATE_ID || 'template_therapist_notification', {
            to_email: booking.therapist_profiles.email,
            to_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
            subject: `Booking Cancelled - ${booking.booking_id}`,
            message: `A booking has been cancelled by the client.\n\nBooking ID: ${booking.booking_id}\nClient: ${booking.first_name} ${booking.last_name}\nOriginal Date: ${bookingTime.toLocaleString('en-AU')}\nService: ${booking.services?.name || 'Massage Service'}\n\nThis time slot is now available for other bookings.`
          });
          console.log('✅ Therapist notification sent');
        } catch (emailError) {
          console.error('Failed to notify therapist:', emailError);
        }
      }

      // Send cancellation confirmation to client
      try {
        await sendEmail(process.env.EMAILJS_BOOKING_CANCELLED_TEMPLATE_ID || 'template_booking_cancelled', {
          to_email: booking.customer_email,
          to_name: `${booking.first_name} ${booking.last_name}`,
          customer_name: `${booking.first_name} ${booking.last_name}`,
          booking_id: booking.booking_id,
          service: booking.services?.name || 'Massage Service',
          date_time: bookingTime.toLocaleString('en-AU'),
          refund_amount: `$${refundAmount.toFixed(2)}`,
          cancellation_fee: `$${cancellationFee.toFixed(2)}`
        });
        console.log('✅ Client cancellation confirmation sent');
      } catch (emailError) {
        console.error('Failed to send client confirmation:', emailError);
      }

      // Return success page
      return {
        statusCode: 200,
        headers,
        body: generateHTML(
          'Booking Cancelled',
          `Your booking has been successfully cancelled.${refundAmount > 0 ? ` A refund of $${refundAmount.toFixed(2)} will be processed to your original payment method within 5-10 business days.` : ''}`,
          true,
          {
            booking_id: booking.booking_id,
            service: booking.services?.name,
            date_time: bookingTime.toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' }),
            refund_amount: `$${refundAmount.toFixed(2)}`,
            cancellation_fee: cancellationFee > 0 ? `$${cancellationFee.toFixed(2)}` : null
          }
        )
      };
    }

    // Default response for other methods
    return {
      statusCode: 405,
      headers,
      body: generateHTML('Method Not Allowed', 'Invalid request method.', false)
    };

  } catch (error) {
    console.error('Cancellation error:', error);
    return {
      statusCode: 500,
      headers,
      body: generateHTML('Error', `An unexpected error occurred. Please contact us at 1300 302542 for assistance. Error: ${error.message}`, false)
    };
  }
};
