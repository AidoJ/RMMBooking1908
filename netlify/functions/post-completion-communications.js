const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { booking_id, customer_email, customer_name, therapist_name } = JSON.parse(event.body);

    if (!booking_id || !customer_email || !customer_name || !therapist_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    console.log('🎉 Post-completion communications triggered for booking:', booking_id);

    // Send email notification
    await sendCompletionEmail(customer_email, customer_name, therapist_name, booking_id);

    // Send SMS notification (if phone number available)
    await sendCompletionSMS(booking_id);

    // Create feedback tracking record
    await createFeedbackTracking(booking_id, customer_email, customer_name);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Post-completion communications sent successfully' 
      })
    };

  } catch (error) {
    console.error('Error in post-completion communications:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function sendCompletionEmail(customerEmail, customerName, therapistName, bookingId) {
  try {
    console.log('📧 Sending completion email to:', customerEmail);

    const emailData = {
      service_id: 'service_rejuvenators',
      template_id: 'template_completion_feedback',
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        customer_name: customerName,
        therapist_name: therapistName,
        booking_id: bookingId,
        feedback_url: `${process.env.SITE_URL || 'https://rmmbook.netlify.app'}/feedback?booking=${bookingId}`,
        google_reviews_url: 'https://g.page/r/CQ2YvQZqJQYhEBM/review'
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`EmailJS API error: ${response.status}`);
    }

    console.log('✅ Completion email sent successfully');

  } catch (error) {
    console.error('❌ Error sending completion email:', error);
    // Don't throw - continue with other communications
  }
}

async function sendCompletionSMS(bookingId) {
  try {
    // Get customer phone from booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('customer_phone, first_name, last_name')
      .eq('booking_id', bookingId)
      .single();

    if (bookingError || !booking?.customer_phone) {
      console.log('📱 No phone number available for SMS');
      return;
    }

    console.log('📱 Sending completion SMS to:', booking.customer_phone);

    const smsData = {
      service_id: 'service_rejuvenators',
      template_id: 'template_completion_sms',
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        customer_name: `${booking.first_name} ${booking.last_name}`,
        booking_id: bookingId,
        feedback_url: `${process.env.SITE_URL || 'https://rmmbook.netlify.app'}/feedback?booking=${bookingId}`,
        google_reviews_url: 'https://g.page/r/CQ2YvQZqJQYhEBM/review'
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(smsData)
    });

    if (!response.ok) {
      throw new Error(`EmailJS SMS API error: ${response.status}`);
    }

    console.log('✅ Completion SMS sent successfully');

  } catch (error) {
    console.error('❌ Error sending completion SMS:', error);
    // Don't throw - continue with other communications
  }
}

async function createFeedbackTracking(bookingId, customerEmail, customerName) {
  try {
    console.log('📝 Creating feedback tracking record for booking:', bookingId);

    const { error } = await supabase
      .from('customer_feedback')
      .insert({
        booking_id: bookingId,
        customer_email: customerEmail,
        customer_name: customerName,
        feedback_type: 'internal_rating',
        status: 'pending'
      });

    if (error) {
      throw error;
    }

    console.log('✅ Feedback tracking record created');

  } catch (error) {
    console.error('❌ Error creating feedback tracking:', error);
    // Don't throw - this is not critical
  }
}

