// client-intake.js
// Public endpoint for clients to view/submit intake forms
// No authentication required - accessed via email link

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // GET: Fetch booking info and existing form data
    if (event.httpMethod === 'GET') {
      const bookingId = event.queryStringParameters?.booking;

      if (!bookingId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing booking parameter' })
        };
      }

      console.log('📋 Fetching intake form for booking:', bookingId);

      // Fetch booking details
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('❌ Booking not found:', bookingError);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Booking not found' })
        };
      }

      // Fetch existing intake form if it exists
      const { data: intakeForm, error: formError } = await supabase
        .from('client_intake_forms')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (formError && formError.code !== 'PGRST116') {
        console.error('❌ Error fetching intake form:', formError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'Failed to fetch intake form' })
        };
      }

      console.log('✅ Retrieved booking and form data');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          booking: booking,
          intakeForm: intakeForm
        })
      };
    }

    // POST: Submit/update intake form
    if (event.httpMethod === 'POST') {
      const formData = JSON.parse(event.body);
      const bookingId = formData.booking_id;

      if (!bookingId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing booking_id' })
        };
      }

      console.log('📝 Submitting intake form for booking:', bookingId);

      // Verify booking exists
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('❌ Booking not found:', bookingError);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Booking not found' })
        };
      }

      // Block form submission for cancelled bookings
      if (booking.status === 'cancelled') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Cannot submit intake form for cancelled booking'
          })
        };
      }

      // Insert or update intake form
      const { data, error } = await supabase
        .from('client_intake_forms')
        .upsert(formData, { onConflict: 'booking_id' })
        .select();

      if (error) {
        console.error('❌ Error submitting intake form:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      console.log('✅ Intake form submitted successfully');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data })
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('❌ Error in client-intake:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
