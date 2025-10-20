// therapist-status-update.js - Handle therapist status updates (On My Way, I've Arrived)
// Sends email and SMS notifications to customers

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
const EMAILJS_ON_MY_WAY_TEMPLATE = 'template_onmyway';
const EMAILJS_ARRIVED_TEMPLATE = 'template_arrived';

// Twilio configuration (from existing environment variables)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const bookingId = params.get('booking');
    const status = params.get('status'); // 'on_my_way' or 'arrived'

    console.log('📱 Status update received:', { bookingId, status });

    if (!bookingId || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }

    if (status !== 'on_my_way' && status !== 'arrived') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid status' })
      };
    }

    // Get booking details with therapist and customer info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services(name),
        therapist_profiles!bookings_therapist_id_fkey(first_name, last_name, phone, home_address)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Booking not found' })
      };
    }

    const therapist = booking.therapist_profiles;
    const therapistFirstName = therapist.first_name;
    const therapistFullName = `${therapist.first_name} ${therapist.last_name}`;
    const customerFirstName = booking.first_name || booking.booker_name?.split(' ')[0] || 'Valued Customer';
    const customerFullName = booking.booker_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim() || 'Guest';
    const serviceName = booking.services?.name || 'Massage Service';

    // Calculate travel time for "on my way" status
    let travelTimeMinutes = null;
    if (status === 'on_my_way' && GOOGLE_MAPS_API_KEY) {
      try {
        travelTimeMinutes = await calculateTravelTime(therapist.home_address, booking.address);
        console.log(`🚗 Estimated travel time: ${travelTimeMinutes} minutes`);
      } catch (error) {
        console.error('❌ Error calculating travel time:', error);
        // Continue without travel time
      }
    }

    // Send email notification to customer
    try {
      await sendCustomerStatusEmail(booking, therapistFullName, customerFullName, serviceName, status);
      console.log('✅ Customer email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending customer email:', emailError);
    }

    // Send SMS notification to customer
    if (booking.customer_phone) {
      try {
        await sendCustomerStatusSMS(
          booking,
          therapistFirstName,
          customerFirstName,
          status,
          travelTimeMinutes
        );
        console.log('✅ Customer SMS sent successfully');
      } catch (smsError) {
        console.error('❌ Error sending customer SMS:', smsError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${status === 'on_my_way' ? 'On My Way' : 'Arrived'} notification sent to customer`
      })
    };

  } catch (error) {
    console.error('❌ Error in status update handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

// Calculate travel time using Google Maps Distance Matrix API
async function calculateTravelTime(origin, destination) {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ Google Maps API key not configured');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const durationSeconds = data.rows[0].elements[0].duration.value;
      const durationMinutes = Math.ceil(durationSeconds / 60);
      return durationMinutes;
    } else {
      console.error('❌ Google Maps API error:', data.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Error calling Google Maps API:', error);
    return null;
  }
}

// Send email notification to customer using EmailJS templates
async function sendCustomerStatusEmail(booking, therapistName, customerName, serviceName, status) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }

    const bookingTime = new Date(booking.booking_time);
    const dateFormatted = bookingTime.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = bookingTime.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const templateId = status === 'on_my_way' ? EMAILJS_ON_MY_WAY_TEMPLATE : EMAILJS_ARRIVED_TEMPLATE;

    const templateParams = {
      to_email: booking.customer_email,
      to_name: customerName,
      customer_name: customerName,
      therapist_name: therapistName,
      booking_id: booking.booking_id,
      service_name: serviceName,
      booking_date: dateFormatted,
      booking_time: timeFormatted,
      duration: `${booking.duration_minutes} minutes`,
      address: booking.address,
      room_number: booking.room_number || 'N/A'
    };

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

    if (!response.ok) {
      throw new Error('EmailJS error: ' + response.status);
    }

    console.log('✅ Status email sent to customer:', booking.customer_email);
    return { success: true };

  } catch (error) {
    console.error('❌ Error sending status email:', error);
    throw error;
  }
}

// Send SMS notification to customer using Twilio
async function sendCustomerStatusSMS(booking, therapistFirstName, customerFirstName, status, travelTimeMinutes) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error('❌ Twilio credentials not configured');
      return { success: false, error: 'Twilio not configured' };
    }

    let smsMessage = '';

    if (status === 'on_my_way') {
      // Format: Hi [First Name], This is [Therapist First Name] and I'm on my way to your location for your booking [Booking ID].
      // I expect to be with you within [X] minutes approx.
      // Kind regards, [Therapist First Name]

      const travelTimeText = travelTimeMinutes ?
        `I expect to be with you within ${travelTimeMinutes} minutes approx.` :
        `I'll be with you shortly.`;

      smsMessage = `Hi ${customerFirstName},
This is ${therapistFirstName} and I'm on my way to your location for your booking ${booking.booking_id}.

${travelTimeText}

Kind regards,
${therapistFirstName}`;
    } else {
      // Format: Hi [First Name], This is [Therapist First Name] and I've just arrived at your location for your booking [Booking ID].
      // Kind regards, [Therapist First Name]

      smsMessage = `Hi ${customerFirstName},
This is ${therapistFirstName} and I've just arrived at your location for your booking ${booking.booking_id}.

Kind regards,
${therapistFirstName}`;
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
    console.log('✅ Status SMS sent to customer:', booking.customer_phone);
    return { success: true, sid: result.sid };

  } catch (error) {
    console.error('❌ Error sending status SMS:', error);
    throw error;
  }
}
