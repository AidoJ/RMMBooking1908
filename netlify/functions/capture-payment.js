const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Helper function to get week bounds (Monday to Sunday)
const getWeekBounds = (date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Helper function to create or update payment records
const createOrUpdatePaymentRecord = async (booking, supabase) => {
  if (!booking.therapist_id || !booking.therapist_fee || booking.therapist_fee <= 0) {
    return; // Skip if no therapist or no fee
  }

  try {
    // Get week bounds for this booking
    const bookingDate = new Date(booking.booking_time);
    const weekBounds = getWeekBounds(bookingDate);
    
    // Check if payment record already exists for this therapist and week
    const { data: existingPayment, error: searchError } = await supabase
      .from('therapist_payments')
      .select('id, total_assignments, total_hours, total_fee')
      .eq('therapist_id', booking.therapist_id)
      .eq('week_start_date', weekBounds.start.toISOString().split('T')[0])
      .eq('week_end_date', weekBounds.end.toISOString().split('T')[0])
      .single();

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw searchError;
    }

    let paymentRecordId;

    if (existingPayment) {
      // Update existing payment record
      const { data: updatedPayment, error: updateError } = await supabase
        .from('therapist_payments')
        .update({
          total_assignments: existingPayment.total_assignments + 1,
          total_hours: existingPayment.total_hours, // Hours handled by assignments
          total_fee: existingPayment.total_fee + booking.therapist_fee,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPayment.id)
        .select('id')
        .single();

      if (updateError) throw updateError;
      paymentRecordId = updatedPayment.id;
    } else {
      // Create new payment record
      const { data: newPayment, error: createError } = await supabase
        .from('therapist_payments')
        .insert({
          therapist_id: booking.therapist_id,
          week_start_date: weekBounds.start.toISOString().split('T')[0],
          week_end_date: weekBounds.end.toISOString().split('T')[0],
          total_assignments: 1,
          total_hours: 0, // Will be updated by assignment completion
          total_fee: booking.therapist_fee,
          payment_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) throw createError;
      paymentRecordId = newPayment.id;
    }

    // Link the booking to the payment record
    await supabase
      .from('bookings')
      .update({ weekly_payment_id: paymentRecordId })
      .eq('id', booking.id);

    console.log(`✅ Payment record ${existingPayment ? 'updated' : 'created'} for booking ${booking.booking_id}`);

  } catch (error) {
    console.error('Error creating/updating payment record:', error);
    // Don't fail the job completion if payment record creation fails
  }
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { payment_intent_id, booking_id, completed_by } = JSON.parse(event.body);

    // Validate required fields
    if (!payment_intent_id || !booking_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Payment intent ID and booking ID are required' }),
      };
    }

    // Step 1: Verify booking exists and is in correct state
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('payment_intent_id', payment_intent_id)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Booking not found or payment intent mismatch' }),
      };
    }

    if (booking.payment_status === 'paid') {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ error: 'Payment has already been completed' }),
      };
    }

    // Step 2: Capture the payment via Stripe
    const paymentIntent = await stripe.paymentIntents.capture(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      throw new Error('Payment capture failed');
    }

    // Step 3: Update booking status in database
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: completed_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      // If database update fails, we have a problem - payment was captured but booking not updated
      console.error('CRITICAL: Payment captured but booking update failed:', updateError);
      throw new Error('Database update failed after payment capture');
    }

    // Step 4: Update any related therapist assignments to completed status
    await supabase
      .from('booking_therapist_assignments')
      .update({
        status: 'completed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', booking.id)
      .in('status', ['assigned', 'confirmed']); // Only update pending assignments

    // Step 5: Create or update payment record
    await createOrUpdatePaymentRecord(updatedBooking, supabase);

    // Step 6: Add to booking status history
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: booking.id,
        status: 'completed',
        notes: `Job completed and payment captured (paid). Completed by: ${completed_by}`,
        changed_by: completed_by,
        changed_at: new Date().toISOString(),
      });

    console.log(`✅ Payment captured for booking ${booking_id}:`, paymentIntent.id);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        success: true,
        payment_intent: paymentIntent.id,
        amount_captured: paymentIntent.amount_received,
        booking_status: 'completed',
        payment_status: 'paid',
      }),
    };

  } catch (error) {
    console.error('Payment Capture Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: 'Failed to capture payment',
        message: error.message 
      }),
    };
  }
};