import { supabaseClient } from '../utility';
import { TherapistAssignment } from '../components/QuoteAvailabilityChecker';

interface QuoteData {
  id: string;
  // Customer Info
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  company_name?: string;
  corporate_contact_name?: string;
  corporate_contact_email?: string;
  corporate_contact_phone?: string;

  // Event Details
  event_location?: string;
  event_name?: string;
  event_type?: string;
  latitude?: number;
  longitude?: number;

  // Financial
  total_amount: number;
  total_therapist_fees: number;
  discount_amount?: number;
  gst_amount?: number;
  final_amount?: number;
  discount_code?: string;
  gift_card_code?: string;
  gift_card_amount?: number;

  // Service Details
  duration_minutes: number;
  service_id?: string;
  payment_method: string;

  // Additional Details
  po_number?: string;
  setup_requirements?: string;
  special_requirements?: string;
  notes?: string;
}

interface BookingRecord {
  parent_quote_id: string;
  quote_day_number: number;
  therapist_id: string;
  booking_time: string;
  duration_minutes: number;
  status: string;

  // Financial fields
  price: number;
  therapist_fee: number;
  net_price: number;
  discount_amount: number;
  tax_rate_amount: number;
  gift_card_amount: number;

  // Customer info (corporate vs individual logic)
  customer_email: string;
  customer_phone?: string;
  booker_name: string;
  business_name?: string;
  first_name?: string;
  last_name?: string;

  // Reference codes
  discount_code?: string;
  gift_card_code?: string;
  booking_id: string;

  // Payment & service
  payment_method: string;
  payment_status: string;
  address?: string;
  service_id?: string;
  booking_type: string;

  // Additional fields
  service_acknowledgement: boolean;
  terms_acceptance: boolean;
  is_split_booking: boolean;
  responding_therapist_id: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

/**
 * Creates booking records from a quote and therapist assignments
 */
export async function createBookingsFromQuote(
  quoteData: QuoteData,
  therapistAssignments: TherapistAssignment[]
): Promise<{ success: boolean; bookingIds?: string[]; error?: string }> {

  try {
    console.log('🔄 Creating bookings from quote:', quoteData.id, 'with', therapistAssignments.length, 'assignments');
    console.log('💰 Total amount:', quoteData.total_amount, 'GST:', quoteData.gst_amount);
    console.log('📅 Duration:', quoteData.duration_minutes, 'minutes');

    // Validate inputs
    if (!therapistAssignments || therapistAssignments.length === 0) {
      throw new Error('No therapist assignments provided');
    }

    if (!quoteData.total_amount || !quoteData.duration_minutes) {
      throw new Error('Quote missing required financial or duration data');
    }

    // Check for existing bookings for this quote to prevent duplicates
    const { data: existingBookings, error: checkError } = await supabaseClient
      .from('bookings')
      .select('id, booking_id')
      .eq('parent_quote_id', quoteData.id);

    if (checkError) {
      console.warn('Warning: Could not check for existing bookings:', checkError.message);
    } else if (existingBookings && existingBookings.length > 0) {
      console.log('⚠️ Found', existingBookings.length, 'existing bookings for quote:', quoteData.id);
      console.log('Existing booking IDs:', existingBookings.map(b => b.booking_id).join(', '));
      throw new Error(`Quote ${quoteData.id} already has ${existingBookings.length} booking(s). Use update workflow instead.`);
    }

    // Calculate per-booking amounts (split evenly)
    const totalBookings = therapistAssignments.length;
    const pricePerBooking = quoteData.total_amount / totalBookings;
    const discountPerBooking = (quoteData.discount_amount || 0) / totalBookings;
    const gstPerBooking = (quoteData.gst_amount || 0) / totalBookings;
    const giftCardPerBooking = (quoteData.gift_card_amount || 0) / totalBookings;
    const netPricePerBooking = pricePerBooking - discountPerBooking;

    // Calculate duration per booking
    const durationPerBooking = quoteData.duration_minutes / totalBookings;

    // Determine customer info (corporate vs individual)
    const usesCorporateInfo = !!quoteData.company_name;
    const customerEmail = usesCorporateInfo ?
      (quoteData.corporate_contact_email || quoteData.customer_email) :
      quoteData.customer_email;
    const customerPhone = usesCorporateInfo ?
      (quoteData.corporate_contact_phone || quoteData.customer_phone) :
      quoteData.customer_phone;
    const bookerName = usesCorporateInfo ?
      (quoteData.corporate_contact_name || quoteData.customer_name) :
      quoteData.customer_name;

    // Parse first/last name
    const nameParts = bookerName?.split(' ') || ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare booking records
    const bookingRecords: BookingRecord[] = [];
    const dayNumbers = new Map<string, number>();
    let currentDayNumber = 1;

    for (let i = 0; i < therapistAssignments.length; i++) {
      const assignment = therapistAssignments[i];

      // Assign day numbers
      if (!dayNumbers.has(assignment.date)) {
        dayNumbers.set(assignment.date, currentDayNumber++);
      }
      const dayNumber = dayNumbers.get(assignment.date)!;

      // Calculate therapist fee for this assignment
      const assignmentDurationMinutes = durationPerBooking;
      const therapistHours = assignmentDurationMinutes / 60;
      const therapistFee = therapistHours * assignment.hourly_rate;

      // Create booking time string - handle different time formats
      let formattedTime = assignment.start_time;
      // If time is in HH:MM format, add seconds
      if (formattedTime.length === 5 && formattedTime.includes(':')) {
        formattedTime += ':00';
      }
      const bookingTime = `${assignment.date}T${formattedTime}.000Z`;

      // Generate unique booking ID
      const bookingId = `BK-${quoteData.id}-${dayNumber}-${i + 1}`;

      // Build combined notes
      const notesArray: string[] = [];
      if (quoteData.setup_requirements) notesArray.push(`Setup: ${quoteData.setup_requirements}`);
      if (quoteData.special_requirements) notesArray.push(`Special: ${quoteData.special_requirements}`);
      if (quoteData.po_number) notesArray.push(`PO: ${quoteData.po_number}`);
      if (quoteData.notes) notesArray.push(quoteData.notes);
      if (assignment.is_override && assignment.override_reason) {
        notesArray.push(`Override: ${assignment.override_reason}`);
      }

      const bookingRecord: BookingRecord = {
        parent_quote_id: quoteData.id,
        quote_day_number: dayNumber,
        therapist_id: assignment.therapist_id,
        booking_time: bookingTime,
        duration_minutes: Math.round(assignmentDurationMinutes),
        status: 'requested', // CRITICAL: This blocks therapist diary immediately

        // Financial (split evenly)
        price: parseFloat(pricePerBooking.toFixed(2)),
        therapist_fee: parseFloat(therapistFee.toFixed(2)),
        net_price: parseFloat(netPricePerBooking.toFixed(2)),
        discount_amount: parseFloat(discountPerBooking.toFixed(2)),
        tax_rate_amount: parseFloat(gstPerBooking.toFixed(2)),
        gift_card_amount: parseFloat(giftCardPerBooking.toFixed(2)),

        // Customer info
        customer_email: customerEmail || '',
        customer_phone: customerPhone,
        booker_name: bookerName || '',
        business_name: quoteData.company_name,
        first_name: firstName,
        last_name: lastName,

        // Reference codes
        discount_code: quoteData.discount_code,
        gift_card_code: quoteData.gift_card_code,
        booking_id: bookingId,

        // Payment & service
        payment_method: quoteData.payment_method,
        payment_status: 'pending',
        address: quoteData.event_location,
        service_id: quoteData.service_id,
        booking_type: quoteData.company_name ? 'Corporate Event/Office' : 'Hotel/Accommodation',

        // Additional fields
        service_acknowledgement: true,
        terms_acceptance: true,
        is_split_booking: totalBookings > 1,
        responding_therapist_id: assignment.therapist_id,
        latitude: quoteData.latitude,
        longitude: quoteData.longitude,
        notes: notesArray.length > 0 ? notesArray.join(' | ') : undefined
      };

      bookingRecords.push(bookingRecord);
    }

    console.log('📋 Prepared', bookingRecords.length, 'booking records');
    console.log('💵 Price per booking:', pricePerBooking.toFixed(2), 'GST per booking:', gstPerBooking.toFixed(2));
    console.log('🔒 All bookings will have status: REQUESTED (blocks therapist diaries)');

    // Insert booking records into database
    const { data: insertedBookings, error: insertError } = await supabaseClient
      .from('bookings')
      .insert(bookingRecords)
      .select('id, booking_id');

    if (insertError) {
      console.error('Error inserting bookings:', insertError);
      throw new Error(`Failed to create bookings: ${insertError.message}`);
    }

    const bookingIds = insertedBookings?.map(b => b.id) || [];

    console.log('✅ Successfully created', bookingIds.length, 'PENDING bookings - therapist diaries now BLOCKED');
    console.log('📋 Booking IDs created:', insertedBookings?.map(b => b.booking_id).join(', '));

    return {
      success: true,
      bookingIds
    };

  } catch (error) {
    console.error('Error in createBookingsFromQuote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Updates booking statuses when quote is accepted/declined
 */
export async function updateBookingStatus(
  quoteId: string,
  newStatus: 'confirmed' | 'declined',
  paymentStatus?: 'pending' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {

  try {
    const updateData: any = { status: newStatus };
    if (paymentStatus) {
      updateData.payment_status = paymentStatus;
    }

    const { error } = await supabaseClient
      .from('bookings')
      .update(updateData)
      .eq('parent_quote_id', quoteId);

    if (error) {
      throw new Error(`Failed to update booking status: ${error.message}`);
    }

    console.log(`Updated all bookings for quote ${quoteId} to status: ${newStatus}`);

    return { success: true };

  } catch (error) {
    console.error('Error updating booking status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Complete quote acceptance workflow - updates quote, bookings, and notifies therapists
 */
export async function acceptQuoteWorkflow(
  quoteId: string
): Promise<{ success: boolean; error?: string; bookingCount?: number }> {

  try {
    console.log(`Starting quote acceptance workflow for quote: ${quoteId}`);

    // 1. Update quote status to 'accepted'
    const { error: quoteError } = await supabaseClient
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    if (quoteError) {
      throw new Error(`Failed to update quote status: ${quoteError.message}`);
    }

    // 2. Get all bookings for this quote to count them
    const { data: bookings, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('id, therapist_id')
      .eq('parent_quote_id', quoteId);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    // 3. Update all related bookings to 'confirmed'
    const { error: bookingError } = await supabaseClient
      .from('bookings')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('parent_quote_id', quoteId);

    if (bookingError) {
      throw new Error(`Failed to update booking status: ${bookingError.message}`);
    }

    console.log(`Quote acceptance complete: Quote ${quoteId} accepted, ${bookings?.length || 0} bookings confirmed`);

    // TODO: Add therapist diary slot confirmation
    // TODO: Send therapist notifications

    return {
      success: true,
      bookingCount: bookings?.length || 0
    };

  } catch (error) {
    console.error('Error in quote acceptance workflow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Complete quote decline workflow - updates quote, bookings, and releases diary slots
 */
export async function declineQuoteWorkflow(
  quoteId: string
): Promise<{ success: boolean; error?: string; bookingCount?: number }> {

  try {
    console.log(`Starting quote decline workflow for quote: ${quoteId}`);

    // 1. Update quote status to 'declined'
    const { error: quoteError } = await supabaseClient
      .from('quotes')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString()
      })
      .eq('id', quoteId);

    if (quoteError) {
      throw new Error(`Failed to update quote status: ${quoteError.message}`);
    }

    // 2. Get all bookings for this quote to count them
    const { data: bookings, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('id, therapist_id')
      .eq('parent_quote_id', quoteId);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    // 3. Update all related bookings to 'declined'
    const { error: bookingError } = await supabaseClient
      .from('bookings')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString()
      })
      .eq('parent_quote_id', quoteId);

    if (bookingError) {
      throw new Error(`Failed to update booking status: ${bookingError.message}`);
    }

    console.log(`Quote decline complete: Quote ${quoteId} declined, ${bookings?.length || 0} bookings declined`);

    // TODO: Release therapist diary slots
    // TODO: Send therapist notifications

    return {
      success: true,
      bookingCount: bookings?.length || 0
    };

  } catch (error) {
    console.error('Error in quote decline workflow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}