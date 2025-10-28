// schedule-review-request.js - Schedule a review request notification
// Called when therapist completes a job

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const bookingId = params.get('booking');

    console.log('📅 Scheduling review request for booking:', bookingId);

    if (!bookingId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing booking ID' })
      };
    }

    // Get booking details with customer and therapist info
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customers(id, first_name, email, phone),
        therapist_profiles!bookings_therapist_id_fkey(id, first_name)
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

    // Calculate scheduled time (60 minutes from now)
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + 60);

    // Extract customer info (handle both registered customers and guest bookings)
    const customerFirstName = booking.customers?.first_name ||
                             booking.first_name ||
                             booking.booker_name?.split(' ')[0] ||
                             'Valued Customer';
    const customerEmail = booking.customers?.email || booking.customer_email;
    const customerPhone = booking.customers?.phone || booking.customer_phone;
    const therapistFirstName = booking.therapist_profiles?.first_name || 'Your Therapist';

    // Check if a review request already exists for this booking
    const { data: existing } = await supabase
      .from('scheduled_notifications')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('notification_type', 'review_request')
      .eq('status', 'pending')
      .single();

    if (existing) {
      console.log('⚠️ Review request already scheduled for this booking');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Review request already scheduled'
        })
      };
    }

    // Create scheduled notification
    const { data: notification, error: notificationError } = await supabase
      .from('scheduled_notifications')
      .insert({
        booking_id: bookingId,
        customer_id: booking.customers?.id,
        therapist_id: booking.therapist_id,
        notification_type: 'review_request',
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending',
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_first_name: customerFirstName,
        therapist_first_name: therapistFirstName,
        notification_data: {
          booking_id: booking.booking_id,
          google_review_url: 'https://g.page/r/CacL6QudFVwjEBM/review'
        }
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Error creating notification:', notificationError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to schedule notification' })
      };
    }

    console.log('✅ Review request scheduled for:', scheduledTime.toISOString());
    console.log('📧 Will send to:', customerEmail);
    console.log('📱 Will send to:', customerPhone);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Review request scheduled successfully',
        scheduled_time: scheduledTime.toISOString(),
        notification_id: notification.id
      })
    };

  } catch (error) {
    console.error('❌ Error in schedule-review-request handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};
