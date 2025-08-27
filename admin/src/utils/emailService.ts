// EmailJS configuration (matches booking platform)
const EMAILJS_SERVICE_ID = 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Template IDs for admin notifications
const TEMPLATE_IDS = {
  BOOKING_UPDATE_CUSTOMER: 'template_butcv1',
  BOOKING_UPDATE_THERAPIST: 'template_buttv1', 
  THERAPIST_REASSIGNED_OLD: 'template_brot-v1',
  THERAPIST_REASSIGNED_NEW: 'template_brnt-v1',
  CORPORATE_QUOTE: 'template_corporate_quote'
};

// Declare emailjs as global variable (loaded via CDN)
declare global {
  interface Window {
    emailjs: any;
  }
}

// Initialize EmailJS when available
const initEmailJS = () => {
  if (typeof window !== 'undefined' && window.emailjs) {
    window.emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log('✅ EmailJS initialized successfully');
    return true;
  }
  return false;
};

// Try to initialize immediately, or wait for window to load
if (!initEmailJS()) {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', initEmailJS);
  }
}

export interface BookingData {
  id: string;
  booking_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  therapist_name?: string;
  therapist_email?: string;
  service_name?: string;
  booking_time: string;
  address?: string;
  business_name?: string;
  duration_minutes?: number;
  price?: number;
  therapist_fee?: number;
  notes?: string;
  room_number?: string;
  
  // Quote-specific fields
  event_type?: string;
  expected_attendees?: number;
  number_of_massages?: number;
  preferred_therapists?: number;
  corporate_contact_name?: string;
  corporate_contact_email?: string;
  corporate_contact_phone?: string;
  po_number?: string;
  urgency?: string;
  setup_requirements?: string;
  special_requirements?: string;
  duration_per_massage?: number;
  payment_method?: string;
  preferred_time_range?: string;
  created_at?: string;
}

export interface TherapistData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export const EmailService = {
  // Send booking update notification to customer
  async sendBookingUpdateToCustomer(bookingData: BookingData, changes: string[]): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        client_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        client_email: bookingData.customer_email,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        service: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        date_time: new Date(bookingData.booking_time).toLocaleDateString() + ' at ' + new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        room_number: bookingData.room_number || '',
        notes: bookingData.notes || '',
        changes: changes.join('\\n• ')
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.BOOKING_UPDATE_CUSTOMER,
        templateParams
      );

      console.log('✅ Customer update email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending customer update email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Send booking update notification to therapist
  async sendBookingUpdateToTherapist(bookingData: BookingData, therapistData: TherapistData, changes: string[]): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: therapistData.email,
        to_name: `${therapistData.first_name} ${therapistData.last_name}`,
        therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
        customer_name: bookingData.customer_name,
        client_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        client_email: bookingData.customer_email,
        customer_phone: bookingData.customer_phone || 'Not provided',
        client_phone: bookingData.customer_phone || 'Not provided',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        service: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        date_time: new Date(bookingData.booking_time).toLocaleDateString() + ' at ' + new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        room_number: bookingData.room_number || '',
        notes: bookingData.notes || '',
        therapist_fee: bookingData.therapist_fee ? `$${bookingData.therapist_fee.toFixed(2)}` : 'TBD',
        changes: changes.join('\\n• ')
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.BOOKING_UPDATE_THERAPIST,
        templateParams
      );

      console.log('✅ Therapist update email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending therapist update email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Send notification to old therapist when reassigned
  async sendReassignmentToOldTherapist(bookingData: BookingData, oldTherapist: TherapistData, newTherapist: TherapistData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: oldTherapist.email || '',
        therapist_name: `${oldTherapist.first_name || ''} ${oldTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        customer_name: bookingData.customer_name || 'Unknown Customer',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name || 'Service',
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        new_therapist_name: `${newTherapist.first_name || ''} ${newTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        old_therapist_name: `${oldTherapist.first_name || ''} ${oldTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        reason: 'Administrative change'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.THERAPIST_REASSIGNED_OLD,
        templateParams
      );

      console.log('✅ Old therapist reassignment email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending old therapist reassignment email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Send notification to new therapist when reassigned
  async sendReassignmentToNewTherapist(bookingData: BookingData, newTherapist: TherapistData, oldTherapist: TherapistData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: newTherapist.email || '',
        therapist_name: `${newTherapist.first_name || ''} ${newTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        customer_name: bookingData.customer_name || 'Unknown Customer',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name || 'Service',
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address || '',
        business_name: bookingData.business_name || '',
        duration: `${bookingData.duration_minutes || 60} minutes`,
        customer_phone: bookingData.customer_phone || 'Not provided',
        customer_email: bookingData.customer_email || '',
        notes: bookingData.notes || '',
        old_therapist_name: `${oldTherapist.first_name || ''} ${oldTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        new_therapist_name: `${newTherapist.first_name || ''} ${newTherapist.last_name || ''}`.trim() || 'Unknown Therapist',
        therapist_fee: bookingData.therapist_fee ? `$${bookingData.therapist_fee.toFixed(2)}` : 'TBD',
        reason: 'Administrative change'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.THERAPIST_REASSIGNED_NEW,
        templateParams
      );

      console.log('✅ New therapist reassignment email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending new therapist reassignment email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Send corporate quote to client
  async sendCorporateQuote(bookingData: BookingData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Generate quote reference ID
      const quoteReference = `RMM-${bookingData.id.slice(0, 8).toUpperCase()}`;
      
      // Calculate quote expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      // Format event date
      const eventDate = new Date(bookingData.booking_time).toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });

      // Format event time from preferred_time_range or booking_time
      const eventTime = bookingData.preferred_time_range || 
                       new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      // Calculate total event duration
      const totalMinutes = (bookingData.number_of_massages || 0) * (bookingData.duration_per_massage || 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const totalDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      // Generate action URLs
      const baseUrl = window.location.origin;
      const acceptUrl = `${baseUrl}/.netlify/functions/quote-response?action=accept&id=${bookingData.id}`;
      const declineUrl = `${baseUrl}/.netlify/functions/quote-response?action=decline&id=${bookingData.id}`;
      const onlineQuoteUrl = `${baseUrl}/.netlify/functions/generate-quote-pdf?id=${bookingData.id}`;

      const templateParams = {
        // Required EmailJS system fields
        to_email: bookingData.corporate_contact_email,
        to_name: bookingData.corporate_contact_name,
        
        // Contact Information
        corporate_contact_email: bookingData.corporate_contact_email,
        corporate_contact_name: bookingData.corporate_contact_name,
        
        // Company Details
        business_name: bookingData.business_name || 'Your Company',
        event_type: bookingData.event_type || 'Corporate Wellness Event',
        
        // Quote Information
        quote_reference: quoteReference,
        quote_amount: `$${(bookingData.price || 0).toFixed(2)}`,
        quote_expiry_date: expiryDate.toLocaleDateString('en-AU'),
        
        // Event Details
        event_date: eventDate,
        event_time: eventTime,
        event_address: bookingData.address || 'Address TBD',
        number_of_massages: (bookingData.number_of_massages || 1).toString(),
        duration_per_massage: `${bookingData.duration_per_massage || 30} minutes`,
        expected_attendees: (bookingData.expected_attendees || 1).toString(),
        total_event_duration: totalDuration,
        preferred_therapists: (bookingData.preferred_therapists || 1).toString(),
        
        // Requirements
        special_requirements: bookingData.special_requirements || 'None specified',
        setup_requirements: bookingData.setup_requirements || 'Standard setup',
        
        // Payment Information
        payment_method: bookingData.payment_method || 'Credit Card',
        po_number: bookingData.po_number || 'Not provided',
        
        // Action URLs
        accept_url: acceptUrl,
        decline_url: declineUrl,
        online_quote_url: onlineQuoteUrl,
        
        // System Fields
        from_name: 'Rejuvenators Mobile Massage',
        reply_to: 'info@rejuvenators.com'
      };

      console.log('📧 DEBUGGING CORPORATE QUOTE EMAIL');
      console.log('📧 Template ID:', TEMPLATE_IDS.CORPORATE_QUOTE);
      console.log('📧 Service ID:', EMAILJS_SERVICE_ID);
      console.log('📧 Raw booking data:', bookingData);
      console.log('📧 All template parameters being sent:');
      console.table(templateParams);
      
      // Log each parameter individually for easy comparison
      Object.keys(templateParams).forEach(key => {
        const value = templateParams[key as keyof typeof templateParams];
        console.log(`📧 ${key}: "${value}" (type: ${typeof value})`);
      });

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.CORPORATE_QUOTE,
        templateParams
      );

      console.log('✅ Corporate quote email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending corporate quote email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Test function with minimal parameters to isolate the issue
  async sendCorporateQuoteMinimal(bookingData: BookingData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Minimal template params - only the absolute essentials
      const minimalParams = {
        to_email: bookingData.corporate_contact_email,
        to_name: bookingData.corporate_contact_name,
        corporate_contact_name: bookingData.corporate_contact_name || 'Contact',
        business_name: bookingData.business_name || 'Company',
        quote_reference: `RMM-TEST`,
        quote_amount: '$100.00',
        from_name: 'Rejuvenators Mobile Massage'
      };

      console.log('📧 TESTING WITH MINIMAL PARAMS:');
      console.table(minimalParams);

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.CORPORATE_QUOTE,
        minimalParams
      );

      console.log('✅ Minimal corporate quote email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending minimal corporate quote email:', error);
      return { success: false, error: (error as Error).message };
    }
  }
};