// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_ai9rrg6'; // Booking request to client
let EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = 'template_51wt6of'; // Therapist booking request template
let EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = 'template_confirmed'; // Booking Confirmed to client
let EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = 'template_therapist_ok'; // Booking confirmed for therapist
let EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = 'template_declined'; // Booking declined
let EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = 'template_alternate'; // Looking for Alternate Therapist
let EMAILJS_GIFT_CARD_TEMPLATE_ID = 'template_gift_card'; // Gift card delivery template
let EMAILJS_QUOTE_CONFIRMATION_TEMPLATE_ID = 'template_quote_request'; // Enhanced quote confirmation template
let EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Initialize EmailJS when the script loads
(function() {
    // Wait for EmailJS to be available
    const initEmailJS = () => {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            console.log('✅ EmailJS initialized successfully');
            return true;
        }
        return false;
    };
    
    // Try to initialize immediately
    if (!initEmailJS()) {
        // If not available, wait and try again
        setTimeout(initEmailJS, 1000);
    }
})();

// Email service functions
const EmailService = {
  // Send Email 1: Booking Request Received to Client
  async sendBookingRequestReceived(bookingData) {
    console.log('📧 Sending booking confirmation email...', bookingData);
    
    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
      // Send parameters that match the template variables exactly
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        customer_code: bookingData.customer_code || 'N/A',
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        room_number: bookingData.room_number || '',
        gender_preference: bookingData.gender_preference || 'No preference',
        therapist: bookingData.therapist_name || 'Available Therapist',
        parking: bookingData.parking || 'N/A',
        booker_name: bookingData.booker_name || '',
        notes: bookingData.notes || '',
        estimated_price: bookingData.total_price || 'N/A',
        base_price: bookingData.base_price || bookingData.total_price || 'N/A'
        // NOTE: Excluding therapist_fee from customer email
      };
      
      console.log('📧 Template parameters:', templateParams);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, 
        templateParams
      );
      
      console.log('✅ Email sent successfully:', response);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending customer email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 2: Booking Request to Selected Therapist (including therapist fees) + SMS
async sendTherapistBookingRequest(bookingData, therapistData, timeoutMinutes) {
  console.log('📧📱 Sending therapist booking request (email + SMS)...', { bookingData, therapistData, timeoutMinutes });
  
  // Ensure EmailJS is initialized
  if (typeof emailjs === 'undefined') {
    console.error('❌ EmailJS not loaded');
    return { success: false, error: 'EmailJS not loaded' };
  }
  
  try {
    // Generate Accept/Decline URLs
    const baseUrl = window.location.origin;
    const acceptUrl = `${baseUrl}/.netlify/functions/booking-response?action=accept&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
    const declineUrl = `${baseUrl}/.netlify/functions/booking-response?action=decline&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
    
    // Calculate therapist fee
    const therapistFee = bookingData.therapist_fee ? `$${parseFloat(bookingData.therapist_fee).toFixed(2)}` : 'TBD';
    
    // Format client phone for display
    const clientPhone = bookingData.customer_phone || 'Not provided';
    
    // Determine booking type display
    let bookingTypeDisplay = bookingData.booking_type || 'Standard Booking';
    if (bookingTypeDisplay === 'Hotel/Accommodation') {
      bookingTypeDisplay = '🏨 Hotel/Accommodation';
    } else if (bookingTypeDisplay === 'In-home') {
      bookingTypeDisplay = '🏠 In-Home Service';
    } else if (bookingTypeDisplay === 'Corporate Event/Office') {
      bookingTypeDisplay = '🏢 Corporate/Office';
    }
    
    // Send email parameters that match the therapist template variables
    const templateParams = {
      to_email: therapistData.email,
      to_name: `${therapistData.first_name} ${therapistData.last_name}`,
      therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
      booking_id: bookingData.booking_id,
      client_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim(),
      client_phone: clientPhone,
      service_name: bookingData.service_name || 'Massage Service',
      duration: `${bookingData.duration_minutes || 60} minutes`,
      booking_date: bookingData.booking_date || new Date().toLocaleDateString(),
      booking_time: bookingData.booking_time || '09:00',
      address: bookingData.address || 'Address not provided',
      business_name: bookingData.business_name || 'Private Residence',
      booking_type: bookingTypeDisplay,
      room_number: bookingData.room_number || 'N/A',
      booker_name: bookingData.booker_name || 'N/A',
      parking: bookingData.parking || 'Unknown',
      notes: bookingData.notes || 'No special notes',
      therapist_fee: therapistFee,
      timeout_minutes: timeoutMinutes || 60,
      accept_url: acceptUrl,
      decline_url: declineUrl
    };
    
    console.log('📧 Therapist email template parameters:', templateParams);
    console.log('📧 Using template ID:', EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID);
    
    // Send email
    const emailResponse = await emailjs.send(
      EMAILJS_SERVICE_ID, 
      EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, 
      templateParams
    );
    
    console.log('✅ Therapist email sent successfully:', emailResponse);
    
    // NEW: Also send SMS notification to therapist
    let smsResponse = { success: false };
    
    // Try to get therapist phone from database
    try {
      const { data: therapistProfile } = await window.supabase
        .from('therapist_profiles')
        .select('phone')
        .eq('id', therapistData.id)
        .single();
      
      if (therapistProfile && therapistProfile.phone) {
        console.log('📱 Sending SMS to therapist...');
        smsResponse = await this.sendTherapistBookingRequestSMS(
          therapistProfile.phone,
          bookingData,
          therapistData,
          timeoutMinutes
        );
      } else {
        console.log('📱 No phone number found for therapist, skipping SMS');
      }
    } catch (error) {
      console.error('❌ Error fetching therapist phone:', error);
    }
    
    return { 
      success: true, 
      message: 'Therapist notification sent successfully', 
      emailResponse,
      smsResponse,
      emailSent: true,
      smsSent: smsResponse.success
    };
    
  } catch (error) {
    console.error('❌ Error sending therapist notification:', error);
    return { success: false, error: error.message };
  }
},

// NEW: Send SMS booking request to therapist
async sendTherapistBookingRequestSMS(therapistPhone, bookingData, therapistData, timeoutMinutes) {
  try {
    // Format phone number
    const formattedPhone = this.formatPhoneNumber(therapistPhone);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }
    
    // Generate shortened Accept/Decline URLs for SMS (optimized for character count)
    const baseUrl = window.location.origin;
    const acceptUrl = `${baseUrl}/.netlify/functions/booking-response?action=accept&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
    const declineUrl = `${baseUrl}/.netlify/functions/booking-response?action=decline&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
    
    // Create compact SMS message with clickable links + text backup
    const dateTime = new Date(bookingData.booking_time).toLocaleDateString('en-AU', { 
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    }).replace(',', '');
    const shortAddress = bookingData.address ? 
      bookingData.address.split(',')[0].substring(0, 15) : 'TBD';
    const fee = bookingData.therapist_fee ? 
      '$' + parseFloat(bookingData.therapist_fee).toFixed(0) : 'TBD';
    
    // Compact SMS message with clickable links only
    const message = `📱 NEW BOOKING ${bookingData.booking_id}

${bookingData.first_name} ${bookingData.last_name} - ${dateTime}
${shortAddress} - ${fee}

✅ Accept: ${acceptUrl}
❌ Decline: ${declineUrl}

- Rejuvenators`;

    console.log('📱 Sending therapist SMS to:', formattedPhone);
    
    const response = await fetch('/.netlify/functions/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Therapist SMS sent successfully');
      return { success: true, sid: result.sid };
    } else {
      console.error('❌ Therapist SMS failed:', result.error);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ Error sending therapist SMS:', error);
    return { success: false, error: error.message };
  }
},

// NEW: Format phone number helper function
formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Add Australian country code if missing
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1); // Remove leading 0, add +61
  } else if (cleaned.length === 9) {
    return '+61' + cleaned; // Add +61
  } else if (cleaned.length === 12 && cleaned.startsWith('61')) {
    return '+' + cleaned; // Add +
  } else if (cleaned.startsWith('+61')) {
    return cleaned; // Already formatted
  }
  
  return phone; // Return as-is if unsure
},

  // Send Email 3: Booking Confirmation to Customer (when therapist accepts)
  async sendBookingConfirmationToCustomer(bookingData) {
    console.log('📧 Sending booking confirmation to customer...', bookingData);

    try {
      // Generate intake form URL with booking ID
      const intakeFormUrl = `https://rmmbook.netlify.app/therapist/clientintake?booking=${bookingData.id || bookingData.booking_id}`;

      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        therapist: bookingData.therapist_name,
        estimated_price: bookingData.total_price || 'N/A',
        intake_form_url: intakeFormUrl
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID,
        templateParams
      );

      console.log('✅ Booking confirmation sent to customer:', response);
      return { success: true, message: 'Booking confirmation sent' };

    } catch (error) {
      console.error('❌ Error sending booking confirmation:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 4: Booking Confirmation to Therapist (when therapist accepts)
  async sendBookingConfirmationToTherapist(bookingData, therapistData) {
    console.log('📧 Sending booking confirmation to therapist...', { bookingData, therapistData });
    
    try {
      const templateParams = {
        to_email: therapistData.email,
        to_name: therapistData.name,
        therapist_name: therapistData.name,
        booking_id: bookingData.booking_id,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        therapist_fee: bookingData.therapist_fee || 'N/A'
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, 
        templateParams
      );

      console.log('✅ Booking confirmation sent to therapist:', response);
      return { success: true, message: 'Therapist confirmation sent' };

    } catch (error) {
      console.error('❌ Error sending therapist confirmation:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 5: "Looking for Alternate" to Customer (when therapist declines)
  async sendLookingForAlternateToCustomer(bookingData) {
    console.log('📧 Sending "looking for alternate" email to customer...', bookingData);
    
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, 
        templateParams
      );

      console.log('✅ "Looking for alternate" email sent to customer:', response);
      return { success: true, message: 'Alternate search email sent' };

    } catch (error) {
      console.error('❌ Error sending alternate search email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 6: Booking Declined to Customer (when no therapist accepts)
  async sendBookingDeclinedToCustomer(bookingData) {
    console.log('📧 Sending booking declined email to customer...', bookingData);
    
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, 
        templateParams
      );

      console.log('✅ Booking declined email sent to customer:', response);
      return { success: true, message: 'Booking declined email sent' };

    } catch (error) {
      console.error('❌ Error sending booking declined email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Gift Card Email
  async sendGiftCardEmail(giftCardData, sendToRecipient = false) {
    console.log('📧 Sending gift card email...', { giftCardData, sendToRecipient });

    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }

    try {
      // Determine recipient
      const recipient = sendToRecipient && giftCardData.recipient_email
        ? {
            email: giftCardData.recipient_email,
            name: giftCardData.recipient_name || 'Gift Card Recipient'
          }
        : {
            email: giftCardData.purchaser_email || giftCardData.card_holder_email,
            name: giftCardData.purchaser_name || giftCardData.card_holder_name
          };

      // Build template parameters
      const templateParams = {
        to_email: recipient.email,
        to_name: recipient.name,
        gift_card_code: giftCardData.code,
        gift_card_value: `$${parseFloat(giftCardData.initial_balance).toFixed(2)}`,
        purchaser_name: giftCardData.purchaser_name || giftCardData.card_holder_name || 'Anonymous',
        recipient_name: giftCardData.recipient_name || 'You',
        personal_message: giftCardData.message || 'Enjoy your relaxing massage experience!',
        expires_at: giftCardData.expires_at
          ? new Date(giftCardData.expires_at).toLocaleDateString('en-AU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : 'No expiry date',
        is_for_recipient: sendToRecipient,
        company_name: 'Rejuvenators Mobile Massage',
        company_phone: '1300 302 542',
        company_email: 'info@rejuvenators.com',
        booking_url: 'https://rejuvenators.com.au'
      };

      console.log('📧 Gift card template parameters:', templateParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_GIFT_CARD_TEMPLATE_ID,
        templateParams
      );

      console.log('✅ Gift card email sent successfully:', response);
      return {
        success: true,
        message: `Gift card email sent to ${sendToRecipient ? 'recipient' : 'purchaser'}`,
        sentTo: recipient.email
      };

    } catch (error) {
      console.error('❌ Error sending gift card email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Quote Confirmation Email (Enhanced)
  async sendQuoteConfirmationEmail(quoteData) {
    console.log('📧 Sending enhanced quote confirmation email...', quoteData);

    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }

    try {
      // Prepare template parameters for enhanced quote email
      const templateParams = {
        // Recipient info
        to_email: quoteData.to_email,
        to_name: quoteData.to_name,

        // Customer details
        customer_name: quoteData.customer_name,
        customer_email: quoteData.customer_email,
        customer_phone: quoteData.customer_phone,
        company_name: quoteData.company_name,

        // Quote reference
        quote_id: quoteData.quote_id,

        // Event structure and details
        event_structure: quoteData.event_structure,
        event_structure_display: quoteData.event_structure_display,
        event_name: quoteData.event_name,
        event_type: quoteData.event_type,
        event_location: quoteData.event_location,
        event_dates: quoteData.event_dates,
        expected_attendees: quoteData.expected_attendees,

        // Session specifications
        total_sessions: quoteData.total_sessions,
        session_duration_minutes: quoteData.session_duration_minutes,
        sessions_per_day: quoteData.sessions_per_day,
        total_event_duration: quoteData.total_event_duration,
        therapists_needed: quoteData.therapists_needed,

        // Business requirements
        payment_method: quoteData.payment_method,
        urgency: quoteData.urgency,
        po_number: quoteData.po_number,

        // Special requirements
        setup_requirements: quoteData.setup_requirements,
        special_requirements: quoteData.special_requirements,

        // Price estimate
        estimated_price_range: quoteData.estimated_price_range
      };

      console.log('📧 Enhanced quote template parameters:', templateParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_QUOTE_CONFIRMATION_TEMPLATE_ID,
        templateParams
      );

      console.log('✅ Enhanced quote confirmation email sent successfully:', response);
      return {
        success: true,
        message: 'Quote confirmation email sent successfully',
        sentTo: quoteData.to_email
      };

    } catch (error) {
      console.error('❌ Error sending enhanced quote confirmation email:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in other modules
window.EmailService = EmailService;
