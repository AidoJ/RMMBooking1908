// COMPLETE UPDATED booking-timeout-handler.js - Fixed first therapist timeout logic + recurring support v2
// Replace your entire netlify/functions/booking-timeout-handler.js with this code
// FORCE DEPLOY: 2025-11-18 20:25 - Added booking_occurrences join

const { createClient } = require('@supabase/supabase-js');
const { getLocalDate, getLocalTime, getLocalDateTime } = require('./utils/timezoneHelpers');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role bypasses RLS

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('Configuration error: Missing Supabase service role credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * TIMEOUT LOGIC:
 *
 * SIMPLE RULE:
 * - If booking is TODAY (before midnight) → Use therapist_response_timeout_minutes
 * - If booking is TOMORROW or LATER (after midnight) → Use standard_response_timeout_minutes
 *
 * BOTH STAGES USE THE SAME TIMEOUT:
 * - First stage: Original therapist gets [timeout] minutes to respond
 * - Second stage: Alternate therapists get SAME [timeout] minutes to respond
 *
 * NO DOUBLING, NO MULTIPLICATION - JUST THE APPROPRIATE TIMEOUT VALUE
 */

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID || 'template_51wt6of';
const EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = process.env.EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID || 'template_alternate';
const EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_DECLINED_TEMPLATE_ID || 'template_declined';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

exports.handler = async (event, context) => {
  console.log('🕐 Starting booking timeout check...');

  try {
    // Get BOTH timeout settings from database
    const { data: sameDayTimeoutSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'therapist_response_timeout_minutes')
      .single();

    const { data: standardTimeoutSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'standard_response_timeout_minutes')
      .single();

    const sameDayTimeoutMinutes = sameDayTimeoutSetting && sameDayTimeoutSetting.value ? parseInt(sameDayTimeoutSetting.value) : 60;
    const standardTimeoutMinutes = standardTimeoutSetting && standardTimeoutSetting.value ? parseInt(standardTimeoutSetting.value) : 240;

    console.log('⏰ Timeout settings:');
    console.log('  - Same-day bookings:', sameDayTimeoutMinutes, 'minutes');
    console.log('  - Standard bookings (tomorrow+):', standardTimeoutMinutes, 'minutes');

    // Find bookings that need timeout processing
    const bookingsToProcess = await findBookingsNeedingTimeout(sameDayTimeoutMinutes, standardTimeoutMinutes);
    console.log('📊 Found', bookingsToProcess.length, 'bookings needing timeout processing');

    if (bookingsToProcess.length === 0) {
      console.log('✅ No bookings need timeout processing');
      return { statusCode: 200, body: 'No timeouts to process' };
    }

    // Process each booking with correct timeout
    const results = [];
    const now = new Date();
    for (const booking of bookingsToProcess) {
      console.log('🔄 Processing booking:', booking.booking_id, 'status:', booking.status, 'stage:', booking.timeoutStage);

      // Determine if booking is same-day or future
      const bookingDate = new Date(booking.booking_time);
      const nowDate = new Date(now);
      const isSameDay = (
        bookingDate.getFullYear() === nowDate.getFullYear() &&
        bookingDate.getMonth() === nowDate.getMonth() &&
        bookingDate.getDate() === nowDate.getDate()
      );

      // Use appropriate timeout based on booking date
      const appropriateTimeout = isSameDay ? sameDayTimeoutMinutes : standardTimeoutMinutes;

      const daysUntilBooking = Math.floor((bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`⏰ Booking ${booking.booking_id}: ${isSameDay ? 'SAME-DAY' : 'FUTURE'} (${daysUntilBooking} days), using ${appropriateTimeout} minute timeout`);

      const result = await processBookingTimeout(booking, appropriateTimeout);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log('✅ Processed', successCount + '/' + results.length, 'bookings successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processed ' + successCount + '/' + results.length + ' bookings',
        results: results
      })
    };

  } catch (error) {
    console.error('❌ Error in timeout handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// UPDATED: Find bookings that need timeout processing (fixed first therapist timeout)
// Now correctly handles same-day vs future bookings with different timeouts
async function findBookingsNeedingTimeout(sameDayTimeoutMinutes, standardTimeoutMinutes) {
  try {
    const now = new Date();

    // Use the LARGER timeout for query efficiency (standard is larger)
    // We'll do precise timeout checks per booking in the processing loop
    const maxTimeoutMinutes = Math.max(sameDayTimeoutMinutes, standardTimeoutMinutes);
    const firstTimeoutCutoff = new Date(now.getTime() - maxTimeoutMinutes * 60 * 1000);
    const secondTimeoutCutoff = new Date(now.getTime() - (maxTimeoutMinutes * 2) * 60 * 1000);

    console.log('🔍 Looking for bookings needing timeout processing...');
    console.log('📅 Using max timeout of', maxTimeoutMinutes, 'minutes for initial query');
    console.log('📅 First timeout cutoff:', firstTimeoutCutoff.toISOString());
    console.log('📅 Second timeout cutoff:', secondTimeoutCutoff.toISOString());

    // FIXED: Find bookings for FIRST timeout (status = 'requested' and past first timeout AND no therapist response)
    // EXCLUDE quote-based bookings (BK-Q pattern) as they follow quote workflow
    // CRITICAL: Also exclude bookings that might be in the process of being accepted (updated_at within last 2 minutes)
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const { data: firstTimeoutBookings, error: error1 } = await supabase
      .from('bookings')
      .select('*, services(id, name), customers(id, first_name, last_name, email, phone), therapist_profiles!therapist_id(id, first_name, last_name, email)')
      .eq('status', 'requested')
      .is('therapist_response_time', null) // IMPORTANT: Only if therapist hasn't responded yet
      .not('booking_id', 'like', 'BK-%') // EXCLUDE BK-Q pattern quote bookings only
      .lt('created_at', firstTimeoutCutoff.toISOString())
      .or('updated_at.is.null,updated_at.lt.' + twoMinutesAgo.toISOString()) // Exclude recently updated bookings
      .or('occurrence_number.is.null,occurrence_number.eq.0'); // NEW: Only check timeout on initial booking or non-recurring (NULL)

    if (error1) {
      console.error('❌ Error fetching first timeout bookings:', error1);
    } else {
      console.log('📊 First timeout bookings found:', firstTimeoutBookings ? firstTimeoutBookings.length : 0);
    }

    // Find bookings for SECOND timeout (status = 'timeout_reassigned' or 'seeking_alternate' and past second timeout)
    // CRITICAL: Check updated_at (when reassigned) not created_at
    // EXCLUDE quote-based bookings (BK-Q pattern) as they follow quote workflow
    const { data: secondTimeoutBookings, error: error2 } = await supabase
      .from('bookings')
      .select('*, services(id, name), customers(id, first_name, last_name, email, phone), therapist_profiles!therapist_id(id, first_name, last_name, email)')
      .in('status', ['timeout_reassigned', 'seeking_alternate'])
      .not('booking_id', 'like', 'BK-%') // EXCLUDE BK-Q pattern quote bookings only
      .lt('updated_at', firstTimeoutCutoff.toISOString()) // Use updated_at (when reassigned) and same timeout period
      .or('occurrence_number.is.null,occurrence_number.eq.0'); // Only initial or non-recurring

    if (error2) {
      console.error('❌ Error fetching second timeout bookings:', error2);
    } else {
      console.log('📊 Second timeout bookings found:', secondTimeoutBookings ? secondTimeoutBookings.length : 0);
    }

    const allBookings = [
      ...(firstTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'first' })),
      ...(secondTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'second' }))
    ];

    console.log('📊 Total bookings to process:', allBookings.length);
    
    return allBookings;

  } catch (error) {
    console.error('❌ Error finding timeout bookings:', error);
    return [];
  }
}

// Process a single booking timeout
async function processBookingTimeout(booking, timeoutMinutes) {
  try {
    console.log('⚡ Processing', booking.timeoutStage, 'timeout for booking', booking.booking_id);

    // CRITICAL: Verify booking has actually exceeded its timeout before processing
    const now = new Date();

    if (booking.timeoutStage === 'first') {
      // FIRST STAGE: Check time since booking was created
      const createdAt = new Date(booking.created_at);
      const minutesSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      console.log(`⏰ FIRST timeout: Booking ${booking.booking_id} created ${Math.floor(minutesSinceCreated)} minutes ago, timeout threshold is ${timeoutMinutes} minutes`);

      // Verify enough time has passed since creation
      if (minutesSinceCreated < timeoutMinutes) {
        console.log(`⏸️ Booking ${booking.booking_id} has not yet exceeded first timeout (${Math.floor(minutesSinceCreated)}/${timeoutMinutes} minutes) - skipping`);
        return { success: true, booking_id: booking.booking_id, action: 'skipped_not_yet_timeout' };
      }
      return await handleFirstTimeout(booking, timeoutMinutes);

    } else if (booking.timeoutStage === 'second') {
      // SECOND STAGE: Check time since booking was reassigned (updated_at)
      const updatedAt = new Date(booking.updated_at);
      const minutesSinceReassigned = (now.getTime() - updatedAt.getTime()) / (1000 * 60);

      console.log(`⏰ SECOND timeout: Booking ${booking.booking_id} reassigned ${Math.floor(minutesSinceReassigned)} minutes ago, timeout threshold is ${timeoutMinutes} minutes (SAME as first)`);

      // Verify enough time has passed since reassignment - USE SAME TIMEOUT (no doubling)
      if (minutesSinceReassigned < timeoutMinutes) {
        console.log(`⏸️ Booking ${booking.booking_id} has not yet exceeded second timeout (${Math.floor(minutesSinceReassigned)}/${timeoutMinutes} minutes) - skipping`);
        return { success: true, booking_id: booking.booking_id, action: 'skipped_not_yet_second_timeout' };
      }
      return await handleSecondTimeout(booking);

    } else {
      console.log('⚠️ Unknown timeout stage for booking', booking.booking_id);
      return { success: false, booking_id: booking.booking_id, reason: 'Unknown timeout stage' };
    }

  } catch (error) {
    console.error('❌ Error processing booking', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// UPDATED: Handle first timeout - check fallback preference properly
async function handleFirstTimeout(booking, timeoutMinutes) {
  try {
    console.log('🔄 First timeout for booking', booking.booking_id, '- fallback_option:', booking.fallback_option);

    // FIXED: Check if customer wants alternatives
    if (booking.fallback_option === 'yes') {
      console.log('✅ Customer wants alternatives - finding available therapists');
      
      // Find ALL available therapists for this specific time slot (excluding original)
      const availableTherapists = await findAllAvailableTherapistsForTimeSlot(booking, booking.therapist_id);
      
      if (availableTherapists.length === 0) {
        console.log('❌ No alternative therapists available for', booking.booking_id, '- declining immediately');
        await sendClientDeclineEmail(booking);
        await updateBookingStatus(booking.booking_id, 'declined');
        await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - no available therapists');
        return { success: true, booking_id: booking.booking_id, action: 'declined_no_alternatives' };
      }

      // 1. FIRST: Send "Looking for Alternate" email to customer
      await sendClientLookingForAlternateEmail(booking);

      // 2. CRITICAL: Update booking status to prevent reprocessing
      await updateBookingStatus(booking.booking_id, 'timeout_reassigned');
      await addStatusHistory(booking.id, 'timeout_reassigned', null, 'Reassigned to ' + availableTherapists.length + ' therapists after first timeout');

      // 3. Send booking requests to ALL available therapists  
      const emailResults = await sendBookingRequestsToMultipleTherapists(booking, availableTherapists, timeoutMinutes);
      
      console.log('📧 Sent booking requests to', availableTherapists.length, 'therapists');
      console.log('✅ Email success rate:', emailResults.filter(r => r.success).length + '/' + emailResults.length);

      return {
        success: true,
        booking_id: booking.booking_id,
        action: 'reassigned_to_multiple',
        therapist_count: availableTherapists.length,
        email_results: emailResults
      };

    } else {
      // Customer doesn't want alternatives - decline immediately
      console.log('❌ Customer does not want alternatives - declining booking', booking.booking_id);
      await sendClientDeclineEmail(booking);
      await updateBookingStatus(booking.booking_id, 'declined');
      await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - customer declined alternatives');
      
      return {
        success: true,
        booking_id: booking.booking_id,
        action: 'declined_no_fallback'
      };
    }

  } catch (error) {
    console.error('❌ Error in first timeout for', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// Handle second timeout - final decline
async function handleSecondTimeout(booking) {
  try {
    console.log('⏰ Second timeout for booking', booking.booking_id, '- sending final decline');

    // Send final decline email to client
    await sendClientDeclineEmail(booking);

    // CRITICAL: Update booking status to prevent reprocessing
    await updateBookingStatus(booking.booking_id, 'declined');
    await addStatusHistory(booking.id, 'declined', null, 'Automatic final timeout - no therapist responses');

    return {
      success: true,
      booking_id: booking.booking_id,
      action: 'final_decline'
    };

  } catch (error) {
    console.error('❌ Error in second timeout for', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// NEW: Find all available therapists for a specific time slot (same logic as booking-response.js)
async function findAllAvailableTherapistsForTimeSlot(booking, excludeTherapistId) {
  try {
    console.log('🔍 Finding ALL available therapists for', booking.booking_id, ', excluding', excludeTherapistId);
    console.log('📅 Booking time:', booking.booking_time);

    // Get therapists who provide this service
    const { data: therapistLinks } = await supabase
      .from('therapist_services')
      .select('therapist_id, therapist_profiles!therapist_id (id, first_name, last_name, email, gender, is_active, latitude, longitude, service_radius_km)')
      .eq('service_id', booking.service_id);

    let candidateTherapists = (therapistLinks || [])
      .map(row => row.therapist_profiles)
      .filter(t => t && t.is_active && t.id !== excludeTherapistId);

    console.log('📊 Found', candidateTherapists.length, 'therapists who provide this service (excluding original)');

    // Filter by gender preference
    if (booking.gender_preference && booking.gender_preference !== 'any') {
      candidateTherapists = candidateTherapists.filter(t => t.gender === booking.gender_preference);
      console.log('📊 After gender filter (' + booking.gender_preference + '):', candidateTherapists.length, 'therapists');
    }

    // Filter by location (if available)
    if (booking.latitude && booking.longitude) {
      candidateTherapists = candidateTherapists.filter(t => {
        if (!t.latitude || !t.longitude || !t.service_radius_km) return false;
        const distance = calculateDistance(
          booking.latitude, booking.longitude,
          t.latitude, t.longitude
        );
        return distance <= t.service_radius_km;
      });
      console.log('📊 After location filter:', candidateTherapists.length, 'therapists');
    }

    // Filter by actual time slot availability
    const availableTherapists = [];
    const bookingDate = new Date(booking.booking_time);
    const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 6=Saturday
    const bookingTimeOnly = bookingDate.toTimeString().slice(0, 5); // HH:MM format
    const bookingDateOnly = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('🕐 Checking availability for:', bookingDateOnly, 'at', bookingTimeOnly, '(day', dayOfWeek + ')');

    for (const therapist of candidateTherapists) {
      try {
        // Check if therapist works on this day of week
        const { data: availability } = await supabase
          .from('therapist_availability')
          .select('start_time, end_time')
          .eq('therapist_id', therapist.id)
          .eq('day_of_week', dayOfWeek);

        if (!availability || availability.length === 0) {
          console.log('❌', therapist.first_name, therapist.last_name, 'does not work on day', dayOfWeek);
          continue;
        }

        const { start_time, end_time } = availability[0];
        
        // Check if booking time is within working hours
        if (bookingTimeOnly < start_time || bookingTimeOnly >= end_time) {
          console.log('❌', therapist.first_name, therapist.last_name, 'not available at', bookingTimeOnly, '(works', start_time, '-', end_time + ')');
          continue;
        }

        // Check for existing bookings at this time
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('booking_time, duration_minutes, status')
          .eq('therapist_id', therapist.id)
          .gte('booking_time', bookingDateOnly + 'T00:00:00')
          .lt('booking_time', bookingDateOnly + 'T23:59:59')
          .in('status', ['requested', 'confirmed', 'timeout_reassigned', 'seeking_alternate']);

        // Check for time conflicts
        let hasConflict = false;
        const bookingStart = new Date(booking.booking_time);
        const bookingEnd = new Date(bookingStart.getTime() + (booking.duration_minutes * 60000));

        for (const existingBooking of existingBookings || []) {
          const existingStart = new Date(existingBooking.booking_time);
          const existingEnd = new Date(existingStart.getTime() + (existingBooking.duration_minutes * 60000));
          
          // Check for overlap (with 15-minute buffer)
          const bufferMs = 15 * 60000; // 15 minutes in milliseconds
          const existingStartWithBuffer = new Date(existingStart.getTime() - bufferMs);
          const existingEndWithBuffer = new Date(existingEnd.getTime() + bufferMs);
          
          if (bookingStart < existingEndWithBuffer && bookingEnd > existingStartWithBuffer) {
            console.log('❌', therapist.first_name, therapist.last_name, 'has conflict with existing booking at', existingBooking.booking_time);
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          console.log('✅', therapist.first_name, therapist.last_name, 'is available for', bookingDateOnly, 'at', bookingTimeOnly);
          availableTherapists.push(therapist);
        }

      } catch (error) {
        console.error('❌ Error checking availability for', therapist.first_name, therapist.last_name + ':', error);
        continue;
      }
    }

    // Remove duplicates by ID
    const uniqueTherapists = Array.from(
      new Map(availableTherapists.map(t => [t.id, t])).values()
    );

    console.log('📊 Final available therapists (after time slot check):', uniqueTherapists.length);
    uniqueTherapists.forEach(t => console.log('  ✅', t.first_name, t.last_name));
    
    return uniqueTherapists;

  } catch (error) {
    console.error('❌ Error finding available therapists:', error);
    return [];
  }
}

// Send booking requests to multiple therapists
async function sendBookingRequestsToMultipleTherapists(booking, therapists, timeoutMinutes) {
  const results = [];
  
  console.log('📧 Sending booking requests to', therapists.length, 'therapists...');
  
  for (const therapist of therapists) {
    try {
      console.log('📧 Sending to', therapist.first_name, therapist.last_name, '(' + therapist.email + ')');
      
      const result = await sendTherapistBookingRequest(booking, therapist, timeoutMinutes);
      results.push({
        therapist_id: therapist.id,
        therapist_name: therapist.first_name + ' ' + therapist.last_name,
        success: result.success,
        error: result.error
      });
      
      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('❌ Error sending to', therapist.first_name, therapist.last_name + ':', error);
      results.push({
        therapist_id: therapist.id,
        therapist_name: therapist.first_name + ' ' + therapist.last_name,
        success: false,
        error: error.message
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log('📧 Successfully sent', successCount + '/' + results.length, 'therapist emails');
  
  return results;
}

// Email functions
async function sendClientLookingForAlternateEmail(booking) {
  try {
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    // Check if recurring - query for all bookings in series
    let seriesBookings = [];
    let isRecurring = false;
    let sessionsList = '';

    if (booking.request_id) {
      const { data: allBookings, error: seriesError } = await supabase
        .from('bookings')
        .select('booking_id, booking_time, occurrence_number')
        .eq('request_id', booking.request_id)
        .order('occurrence_number', { ascending: true, nullsFirst: false });

      if (!seriesError && allBookings && allBookings.length > 1) {
        seriesBookings = allBookings;
        isRecurring = true;
      }
    }

    console.log('🔍 [TIMEOUT] Recurring check:', {
      has_series_bookings: seriesBookings.length > 0,
      total_bookings: seriesBookings.length,
      is_recurring: isRecurring
    });

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    if (isRecurring && seriesBookings.length > 0) {
      sessionsList = seriesBookings.map(b => {
        const occNum = b.occurrence_number;
        const label = occNum === 0 ? 'Initial booking' : `Repeat ${occNum}`;
        return `${label}: ${getLocalDateTime(b.booking_time, timezone)}`;
      }).join('\n');
      console.log(`✅ Built sessions list with ${seriesBookings.length} sessions`);
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: getLocalDateTime(booking.booking_time, timezone),
      address: booking.address,
      is_recurring: isRecurring,
      total_occurrences: seriesBookings.length || 1,
      sessions_list: sessionsList
    };

    const result = await sendEmail(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
    console.log('📧 "Looking for alternate" email sent to client:', booking.customer_email);
    return result;

  } catch (error) {
    console.error('❌ Error sending "looking for alternate" email:', error);
    return { success: false, error: error.message };
  }
}

async function sendClientDeclineEmail(booking) {
  try {
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    // Check if recurring - query for all bookings in series
    let seriesBookings = [];
    let isRecurring = false;
    let sessionsList = '';

    if (booking.request_id) {
      const { data: allBookings, error: seriesError } = await supabase
        .from('bookings')
        .select('booking_id, booking_time, occurrence_number')
        .eq('request_id', booking.request_id)
        .order('occurrence_number', { ascending: true, nullsFirst: false });

      if (!seriesError && allBookings && allBookings.length > 1) {
        seriesBookings = allBookings;
        isRecurring = true;
      }
    }

    console.log('🔍 [TIMEOUT DECLINE] Recurring check:', {
      has_series_bookings: seriesBookings.length > 0,
      total_bookings: seriesBookings.length,
      is_recurring: isRecurring
    });

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    if (isRecurring && seriesBookings.length > 0) {
      sessionsList = seriesBookings.map(b => {
        const occNum = b.occurrence_number;
        const label = occNum === 0 ? 'Initial booking' : `Repeat ${occNum}`;
        return `${label}: ${getLocalDateTime(b.booking_time, timezone)}`;
      }).join('\n');
      console.log(`✅ Built sessions list with ${seriesBookings.length} sessions`);
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: getLocalDateTime(booking.booking_time, timezone),
      address: booking.address,
      is_recurring: isRecurring,
      total_occurrences: seriesBookings.length || 1,
      sessions_list: sessionsList
    };

    const result = await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log('📧 Final decline email sent to client:', booking.customer_email);
    return result;

  } catch (error) {
    console.error('❌ Error sending final decline email:', error);
    return { success: false, error: error.message };
  }
}

async function sendTherapistBookingRequest(booking, therapist, timeoutMinutes) {
  try {
    // Generate Accept/Decline URLs
    const baseUrl = process.env.URL || 'https://booking.rejuvenators.com';
    const acceptUrl = baseUrl + '/.netlify/functions/booking-response?action=accept&booking=' + booking.booking_id + '&therapist=' + therapist.id;
    const declineUrl = baseUrl + '/.netlify/functions/booking-response?action=decline&booking=' + booking.booking_id + '&therapist=' + therapist.id;

    // Check if recurring - query for all bookings in series using request_id
    let seriesBookings = [];
    let isRecurring = false;
    let sessionsList = '';
    let totalSeriesEarnings = 0;

    if (booking.request_id) {
      // Fetch all bookings in the series
      const { data: allBookings, error: seriesError } = await supabase
        .from('bookings')
        .select('booking_id, booking_time, occurrence_number, therapist_fee')
        .eq('request_id', booking.request_id)
        .order('occurrence_number', { ascending: true, nullsFirst: false });

      if (!seriesError && allBookings && allBookings.length > 1) {
        seriesBookings = allBookings;
        isRecurring = true;
      }
    }

    console.log('🔍 [TIMEOUT THERAPIST] Recurring check:', {
      has_series_bookings: seriesBookings.length > 0,
      total_bookings: seriesBookings.length,
      is_recurring: isRecurring
    });

    // Convert UTC time to local timezone for display
    const timezone = booking.booking_timezone || 'Australia/Brisbane';

    if (isRecurring && seriesBookings.length > 0) {
      sessionsList = seriesBookings.map(b => {
        const occNum = b.occurrence_number;
        const label = occNum === 0 ? 'Initial booking' : `Repeat ${occNum}`;
        return `${label}: ${getLocalDateTime(b.booking_time, timezone)}`;
      }).join('\n');

      if (booking.therapist_fee) {
        totalSeriesEarnings = (parseFloat(booking.therapist_fee) * seriesBookings.length).toFixed(2);
      }
      console.log(`✅ Built sessions list with ${seriesBookings.length} sessions, total earnings: $${totalSeriesEarnings}`);
    }

    const templateParams = {
      to_email: therapist.email,
      to_name: therapist.first_name + ' ' + therapist.last_name,
      therapist_name: therapist.first_name + ' ' + therapist.last_name,
      booking_id: booking.booking_id,
      client_name: booking.first_name + ' ' + booking.last_name,
      client_phone: booking.customer_phone || 'Not provided',
      service_name: (booking.services && booking.services.name) ? booking.services.name : 'Massage Service',
      duration: booking.duration_minutes + ' minutes',
      booking_date: getLocalDate(booking.booking_time, timezone),
      booking_time: getLocalTime(booking.booking_time, timezone),
      address: booking.address,
      business_name: booking.business_name || 'Private Residence',
      booking_type: booking.booking_type || 'Standard Booking',
      room_number: booking.room_number || 'N/A',
      booker_name: booking.booker_name || 'N/A',
      parking: booking.parking || 'Unknown',
      notes: booking.notes || 'No special notes',
      therapist_fee: booking.therapist_fee ? '$' + booking.therapist_fee.toFixed(2) : 'TBD',
      timeout_minutes: timeoutMinutes,
      accept_url: acceptUrl,
      decline_url: declineUrl,
      is_recurring: isRecurring,
      total_occurrences: seriesBookings.length || 1,
      sessions_list: sessionsList,
      total_series_earnings: totalSeriesEarnings
    };

    const result = await sendEmail(EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, templateParams);
    console.log('📧 Booking request sent to therapist:', therapist.email);
    return result;

  } catch (error) {
    console.error('❌ Error sending therapist booking request:', error);
    return { success: false, error: error.message };
  }
}

// Utility functions
async function updateBookingStatus(bookingId, status) {
  try {
    // First, get the request_id for this booking (to handle series)
    const { data: bookingData, error: fetchError } = await supabase
      .from('bookings')
      .select('request_id')
      .eq('booking_id', bookingId)
      .single();

    if (fetchError || !bookingData) {
      console.error('❌ Error fetching booking for status update:', fetchError);
      throw fetchError || new Error('Booking not found');
    }

    const requestId = bookingData.request_id;

    // Update ALL bookings in the series using request_id
    // This ensures if booking times out, entire recurring series is cancelled
    const { error } = await supabase
      .from('bookings')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId);

    if (error) {
      console.error('❌ Error updating booking', bookingId, 'status:', error);
    } else {
      console.log('✅ Updated booking', bookingId, 'status to:', status);
    }
  } catch (error) {
    console.error('❌ Error updating booking status:', error);
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
  } catch (error) {
    console.error('❌ Error adding status history:', error);
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function sendEmail(templateId, templateParams) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }
    
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

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ EmailJS API error:', response.status, responseText);
      return { success: false, error: 'EmailJS error: ' + response.status };
    }

    return { success: true, response: responseText };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}
