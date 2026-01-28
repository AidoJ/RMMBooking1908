// EmailJS configuration (matches booking platform)
const EMAILJS_SERVICE_ID = 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Template IDs for admin notifications
const TEMPLATE_IDS = {
  BOOKING_UPDATE_CUSTOMER: 'template_butcv1',
  BOOKING_UPDATE_THERAPIST: 'template_buttv1',
  THERAPIST_REASSIGNED_OLD: 'template_brot-v1',
  THERAPIST_REASSIGNED_NEW: 'template_brnt-v1',
  CORPORATE_QUOTE: 'template_corporate_quote',
  INVOICE: 'template_invoice',
  QUOTE_CONFIRMED_CLIENT: 'quoteconfirmed_client',
  QUOTE_CONFIRMED_THERAPIST: 'quoteconfirmed_therapist',
  OFFICIAL_RECEIPT: 'official_receipt',
  // Admin Edit Page specific templates
  ADMIN_EDIT_CUSTOMER_UPDATE: 'Booking Update-Customer',
  ADMIN_EDIT_THERAPIST_UPDATE: 'Booking Update-Therapist',
  ADMIN_EDIT_THERAPIST_REASSIGN_ORIGINAL: 'Booking Reassign - old',
  ADMIN_EDIT_THERAPIST_REASSIGN_NEW: 'Booking Reassign - new',
  // Therapist Payment Confirmation
  THERAPIST_PAYMENT_CONFIRMATION: 'template_pay_confirm'
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
  total_sessions?: number;
  preferred_therapists?: number;
  corporate_contact_name?: string;
  corporate_contact_email?: string;
  corporate_contact_phone?: string;
  po_number?: string;
  urgency?: string;
  setup_requirements?: string;
  special_requirements?: string;
  session_duration_minutes?: number;
  payment_method?: string;
  preferred_time_range?: string;
  created_at?: string;
  
  // Invoice-specific fields
  invoice_number?: string;
  invoice_date?: string;
  discount_amount?: number;
  tax_rate_amount?: number;
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

  // Send booking reassignment notification to original therapist
  async sendBookingReassignmentToOriginalTherapist(bookingData: BookingData, originalTherapistData: TherapistData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: originalTherapistData.email,
        to_name: `${originalTherapistData.first_name} ${originalTherapistData.last_name}`,
        therapist_name: `${originalTherapistData.first_name} ${originalTherapistData.last_name}`,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name,
        room_number: bookingData.room_number,
        reason: 'Administrative reassignment'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.THERAPIST_REASSIGNED_OLD,
        templateParams
      );

      console.log('✅ Original therapist reassignment email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending original therapist reassignment email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Send booking assignment notification to new therapist
  async sendBookingAssignmentToNewTherapist(bookingData: BookingData, newTherapistData: TherapistData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: newTherapistData.email,
        to_name: `${newTherapistData.first_name} ${newTherapistData.last_name}`,
        therapist_name: `${newTherapistData.first_name} ${newTherapistData.last_name}`,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name,
        room_number: bookingData.room_number,
        duration_minutes: bookingData.duration_minutes,
        price: bookingData.price
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.THERAPIST_REASSIGNED_NEW,
        templateParams
      );

      console.log('✅ New therapist assignment email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending new therapist assignment email:', error);
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

      // Use the actual quote reference from booking_id field (RQ format)
      const quoteReference = bookingData.booking_id || `RQ${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}001`;
      
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

      // Calculate total event duration using quote fields
      const totalMinutes = (bookingData.total_sessions || 0) *
                           (bookingData.session_duration_minutes || 0);
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
        number_of_massages: (bookingData.total_sessions || 1).toString(),
        duration_per_massage: `${bookingData.session_duration_minutes || 30} minutes`,
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
  },

  // Send invoice email to client
  async sendInvoiceEmail(bookingData: BookingData, systemSettings: { [key: string]: string } = {}): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Format invoice date
      const invoiceDate = bookingData.invoice_date 
        ? new Date(bookingData.invoice_date).toLocaleDateString('en-AU')
        : new Date().toLocaleDateString('en-AU');

      // Format payment due date (30 days from invoice date)
      const dueDateObj = new Date(bookingData.invoice_date || Date.now());
      dueDateObj.setDate(dueDateObj.getDate() + 30);
      const paymentDueDate = dueDateObj.toLocaleDateString('en-AU');

      // Format event date
      const eventDate = new Date(bookingData.booking_time).toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });

      // Format event time
      const eventTime = bookingData.preferred_time_range || 
                       new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      // Calculate pricing breakdown
      const subtotal = ((finalAmount));
      const discountAmount = bookingData.discount_amount || 0;
      const gstAmount = bookingData.tax_rate_amount || 0;
      const totalAmount = bookingData.price || 0;

      // Create invoice PDF download URL
      const baseUrl = window.location.origin;
      const invoicePdfUrl = `${baseUrl}/.netlify/functions/generate-invoice-pdf?id=${bookingData.id}`;

      const templateParams = {
        to_email: bookingData.corporate_contact_email,
        to_name: bookingData.corporate_contact_name,
        corporate_contact_name: bookingData.corporate_contact_name || 'Contact',
        business_name: bookingData.business_name || 'Company',
        invoice_number: bookingData.invoice_number,
        quote_reference: bookingData.booking_id,
        invoice_date: invoiceDate,
        payment_due_date: paymentDueDate,
        event_date: eventDate,
        event_time: eventTime,
        event_address: bookingData.address || 'Not specified',
        expected_attendees: bookingData.expected_attendees?.toString() || 'Not specified',
        number_of_massages: bookingData.total_sessions?.toString() || '0',
        duration_per_massage: `${bookingData.session_duration_minutes || 0} minutes`,
        event_type: bookingData.event_type || 'Corporate Event',
        subtotal: `$${subtotal.toFixed(2)}`,
        discount_amount: discountAmount > 0 ? `-$${discountAmount.toFixed(2)}` : '$0.00',
        gst_amount: `$${gstAmount.toFixed(2)}`,
        total_amount: `$${totalAmount.toFixed(2)}`,
        payment_method: bookingData.payment_method || 'Bank Transfer',
        payment_terms: 'Net 30 Days',
        po_number: bookingData.po_number || 'Not provided',
        from_name: 'Rejuvenators Mobile Massage',
        // System settings for business details
        rejuvenators_business_name: systemSettings.business_name || 'Rejuvenators Mobile Massage',
        business_address: systemSettings.business_address || '',
        business_abn: systemSettings.business_abn || '',
        // Bank account details (always show regardless of payment method)
        bank_account_name: systemSettings.bank_account_name || '',
        bank_account_bsb: systemSettings.bank_account_bsb || '',
        bank_account_no: systemSettings.bank_account_no || '',
        // PDF download link
        invoice_pdf_url: invoicePdfUrl
      };

      console.log('📧 Sending invoice email with params:', templateParams);

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.INVOICE,
        templateParams
      );

      console.log('✅ Invoice email sent:', response);
      return { success: true };

    } catch (error) {
      console.error('❌ Error sending invoice email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Enhanced function to send official quote with detailed booking information
  async sendEnhancedOfficialQuote(quoteData: any, therapistAssignments: any[], bookingIds: string[], businessEmail?: string): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Generate quote reference with version
      const version = quoteData.quote_version || 1;
      const versionSuffix = version > 1 ? ` (Rev ${version})` : '';
      const quoteReference = `${quoteData.id || `RQ${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}001`}${versionSuffix}`;

      // Calculate quote expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Format financial information
      const subtotal = (quoteData.final_amount || 0) + (quoteData.discount_amount || 0);
      const totalAmount = quoteData.final_amount || quoteData.total_amount || 0;

      // Group assignments by date for display
      const dayGroups = therapistAssignments.reduce((groups: any, assignment: any) => {
        const date = assignment.date;
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(assignment);
        return groups;
      }, {});

      // Create therapist schedule as beautifully formatted text for email
      let therapistScheduleText = '';
      Object.keys(dayGroups).sort().forEach((date, dayIndex) => {
        const assignments = dayGroups[date];
        const formattedDate = new Date(date).toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Simple day header
        therapistScheduleText += `\n📅 ${formattedDate}\n\n`;

        assignments.forEach((assignment: any, index: number) => {
          // Lookup per-day duration from quote_dates by date
          const qd = (quoteData.quote_dates || []).find((d: any) => {
            if (!d.event_date) return false;
            const dStr = new Date(d.event_date).toISOString().slice(0, 10);
            return dStr === assignment.date;
          });
          
          let duration = 0;
          if (qd && typeof qd.duration_minutes === 'number' && qd.duration_minutes > 0) {
            duration = qd.duration_minutes;
          } else if (qd && qd.start_time && qd.finish_time) {
            try {
              const [sh, sm] = String(qd.start_time).split(':').map((v: string) => parseInt(v, 10));
              const [eh, em] = String(qd.finish_time).split(':').map((v: string) => parseInt(v, 10));
              const startMins = (isNaN(sh) ? 0 : sh) * 60 + (isNaN(sm) ? 0 : sm);
              const endMins = (isNaN(eh) ? 0 : eh) * 60 + (isNaN(em) ? 0 : em);
              duration = Math.max(0, endMins - startMins);
            } catch {
              duration = 0;
            }
          }

          // If no per-day duration, fallback to split (legacy)
          if (duration === 0) {
            duration = Math.round((quoteData.duration_minutes || 0) / Math.max(1, therapistAssignments.length));
          }

          // Respect service arrangement: multiply vs split
          const serviceArrangement = quoteData.service_arrangement || 'split';
          const therapistsPerDay = assignments.length;
          let displayDuration = duration;
          
          if (serviceArrangement === 'split' && therapistsPerDay > 1) {
            displayDuration = Math.floor(duration / therapistsPerDay);
          }
          // else multiply: show full duration

          const hours = Math.floor(displayDuration / 60);
          const mins = displayDuration % 60;
          const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

          // Format time to remove seconds
          const timeFormatted = assignment.start_time.substring(0, 5);

          // Clean, simple formatting for email
          therapistScheduleText += `${assignment.therapist_name}\n`;
          therapistScheduleText += `Start: ${timeFormatted}  •  Duration: ${durationText}\n`;

          if (assignment.is_override) {
            const reason = assignment.override_reason || 'Custom arrangement';
            therapistScheduleText += `Note: ${reason}\n`;
          }

          therapistScheduleText += `\n`;
        });
      });


      // Create action URLs (using quote_id for multi-booking support)
      const baseUrl = window.location.origin;
      const acceptUrl = `${baseUrl}/.netlify/functions/quote-response?action=accept&quote_id=${quoteData.id}`;
      const declineUrl = `${baseUrl}/.netlify/functions/quote-response?action=decline&quote_id=${quoteData.id}`;
      const onlineQuoteUrl = `${baseUrl}/.netlify/functions/generate-quote-pdf?quote_id=${quoteData.id}`;

      // Determine contact information (corporate vs individual)
      const usesCorporateInfo = !!quoteData.company_name;
      const contactEmail = usesCorporateInfo ?
        (quoteData.corporate_contact_email || quoteData.customer_email) :
        quoteData.customer_email;
      const contactName = usesCorporateInfo ?
        (quoteData.corporate_contact_name || quoteData.customer_name) :
        quoteData.customer_name;

      const templateParams = {
        // Required EmailJS system fields
        to_email: contactEmail,
        to_name: contactName,
        // BCC to business email for archive (if provided)
        ...(businessEmail && { bcc: businessEmail }),

        // Contact Information
        corporate_contact_email: contactEmail,
        corporate_contact_name: contactName,

        // Company Details
        business_name: quoteData.company_name || quoteData.customer_name || 'Individual Booking',
        event_type: quoteData.event_type || 'Wellness Event',

        // Quote Information
        quote_reference: quoteReference,
        quote_amount: `$${totalAmount.toFixed(2)}`,
        quote_expiry_date: expiryDate.toLocaleDateString('en-AU'),

        // Event Overview
        event_name: quoteData.event_name || 'Wellness Event',
        event_address: quoteData.event_location || 'Address TBD',
        expected_attendees: (quoteData.expected_attendees || 1).toString(),
        total_therapists: therapistAssignments.length.toString(),
        total_days: Object.keys(dayGroups).length.toString(),

        // Service Details
        total_sessions: (quoteData.total_sessions || 1).toString(),
        session_duration: `${quoteData.session_duration_minutes || 60} minutes`,
        total_duration: `${Math.floor((quoteData.duration_minutes || 0) / 60)}h ${(quoteData.duration_minutes || 0) % 60}m`,

        // Financial Breakdown
        subtotal: `$${subtotal.toFixed(2)}`,
        discount_amount: quoteData.discount_amount > 0 ? `-$${quoteData.discount_amount.toFixed(2)}` : '$0.00',
        gst_amount: `$${(quoteData.gst_amount || 0).toFixed(2)}`,
        total_amount: `$${totalAmount.toFixed(2)}`,

        // Requirements
        special_requirements: quoteData.special_requirements || 'None specified',
        setup_requirements: quoteData.setup_requirements || 'Standard setup',

        // Payment Information
        payment_method: quoteData.payment_method || 'Credit Card',
        po_number: quoteData.po_number || 'Not provided',

        // Therapist Schedule (Text) - Enhanced formatting for email display
        therapist_schedule_text: therapistScheduleText,

        // Enhanced formatting for email template
        schedule_header: `THERAPIST SCHEDULE - ${Object.keys(dayGroups).length} DAY${Object.keys(dayGroups).length > 1 ? 'S' : ''}`,
        schedule_summary: `${therapistAssignments.length} therapist session${therapistAssignments.length > 1 ? 's' : ''} across ${Object.keys(dayGroups).length} day${Object.keys(dayGroups).length > 1 ? 's' : ''}`,

        // Professional formatting alternative
        schedule_overview: therapistAssignments.map((assignment: any) => {
          // Lookup per-day duration from quote_dates by date
          const qd = (quoteData.quote_dates || []).find((d: any) => {
            if (!d.event_date) return false;
            const dStr = new Date(d.event_date).toISOString().slice(0, 10);
            return dStr === assignment.date;
          });
          let duration = 0;
          if (qd && typeof qd.duration_minutes === 'number' && qd.duration_minutes > 0) {
            duration = qd.duration_minutes;
          } else if (qd && qd.start_time && qd.finish_time) {
            try {
              const [sh, sm] = String(qd.start_time).split(':').map((v: string) => parseInt(v, 10));
              const [eh, em] = String(qd.finish_time).split(':').map((v: string) => parseInt(v, 10));
              const startMins = (isNaN(sh) ? 0 : sh) * 60 + (isNaN(sm) ? 0 : sm);
              const endMins = (isNaN(eh) ? 0 : eh) * 60 + (isNaN(em) ? 0 : em);
              duration = Math.max(0, endMins - startMins);
            } catch {
              duration = 0;
            }
          } else {
            // Fallback to previous behavior if quote_dates missing
            duration = Math.round((quoteData.duration_minutes || 0) / Math.max(1, therapistAssignments.length));
          }

          const hours = Math.floor(duration / 60);
          const minutes = duration % 60;
          const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          const fee = ((duration / 60) * (assignment.hourly_rate || 0)).toFixed(2);
          const timeFormatted = assignment.start_time.substring(0, 5);
          const formattedDate = new Date(assignment.date).toLocaleDateString('en-AU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });

          return `${formattedDate} at ${timeFormatted} - ${assignment.therapist_name} (${durationText}, $${fee})`;
        }).join('\n'),

        // Action URLs
        accept_url: acceptUrl,
        decline_url: declineUrl,
        online_quote_url: onlineQuoteUrl,

        // Professional summary sections
        event_summary: `${quoteData.event_name || 'Wellness Event'} - ${Object.keys(dayGroups).length} day${Object.keys(dayGroups).length > 1 ? 's' : ''}, ${therapistAssignments.length} session${therapistAssignments.length > 1 ? 's' : ''}`,

        financial_summary: [
          `Service Total: $${subtotal.toFixed(2)}`,
          quoteData.discount_amount > 0 ? `Discount: -$${quoteData.discount_amount.toFixed(2)}` : null,
          `GST (10%): $${(quoteData.gst_amount || 0).toFixed(2)}`,
          `TOTAL: $${totalAmount.toFixed(2)}`
        ].filter(Boolean).join('\n'),

        // Contact and business details
        company_header: quoteData.company_name ?
          `${quoteData.company_name}` :
          `Individual Booking`,

        // System Fields
        from_name: 'Rejuvenators Mobile Massage',
        reply_to: 'info@rejuvenators.com',

        // Booking references for tracking
        booking_ids: bookingIds.join(', '),
        total_bookings: bookingIds.length.toString()
      };

      console.log('📧 Sending enhanced official quote email');
      console.log('📧 Quote data:', quoteData);
      console.log('📧 Therapist assignments:', therapistAssignments);
      if (businessEmail) {
        console.log('📧 BCC archive copy to:', businessEmail);
      }
      console.log('📧 Template parameters:', templateParams);

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.CORPORATE_QUOTE,
        templateParams
      );

      console.log('✅ Enhanced official quote email sent:', response);

      // Send copy to business email for archive
      if (businessEmail) {
        try {
          await window.emailjs.send(
            EMAILJS_SERVICE_ID,
            TEMPLATE_IDS.CORPORATE_QUOTE,
            { ...templateParams, to_email: businessEmail, to_name: 'Archive' }
          );
          console.log('✅ Archive copy sent to:', businessEmail);
        } catch (archiveError) {
          console.error('⚠️ Failed to send archive copy:', archiveError);
          // Don't fail the whole operation if archive fails
        }
      }

      return { success: true };

    } catch (error) {
      console.error('❌ Error sending enhanced official quote email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send quote booking confirmation to therapists
   */
  async sendQuoteTherapistConfirmation(params: {
    therapistEmail: string;
    therapistName: string;
    quoteReference: string;
    clientName: string;
    companyName: string;
    serviceName: string;
    therapistScheduleHTML: string;
    therapistFee: string;
    eventAddress: string;
    parkingInfo: string;
    contactPerson: string;
    contactPhone: string;
    specialRequirements?: string;
  }) {
    console.log('📧 Sending quote therapist confirmation:', params.therapistEmail);

    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not initialized');
      }

      const templateParams = {
        to_email: params.therapistEmail,
        therapist_name: params.therapistName,
        quote_reference: params.quoteReference,
        client_name: params.clientName,
        company_name: params.companyName,
        service_name: params.serviceName,
        therapist_schedule: params.therapistScheduleHTML,
        therapist_fee: params.therapistFee,
        event_address: params.eventAddress,
        parking_info: params.parkingInfo || 'N/A',
        contact_person: params.contactPerson,
        contact_phone: params.contactPhone,
        special_requirements: params.specialRequirements || ''
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.QUOTE_CONFIRMED_THERAPIST,
        templateParams
      );

      console.log('✅ Quote therapist confirmation sent:', response);
      return { success: true };

    } catch (error) {
      console.error('❌ Error sending therapist confirmation:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send quote booking confirmation to client
   */
  async sendQuoteClientConfirmation(params: {
    clientEmail: string;
    clientName: string;
    companyName: string;
    quoteReference: string;
    serviceName: string;
    eventAddress: string;
    therapistScheduleHTML: string;
    subtotal: string;
    discount?: string;
    gst: string;
    totalAmount: string;
    paymentMethodInvoice?: boolean;
    invoiceNumber?: string;
    paymentDueDate?: string;
  }) {
    console.log('📧 Sending quote client confirmation:', params.clientEmail);

    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not initialized');
      }

      const templateParams = {
        to_email: params.clientEmail,
        client_name: params.clientName,
        company_name: params.companyName,
        quote_reference: params.quoteReference,
        service_name: params.serviceName,
        event_address: params.eventAddress,
        therapist_schedule: params.therapistScheduleHTML,
        subtotal: params.subtotal,
        discount: params.discount || '',
        gst: params.gst,
        total_amount: params.totalAmount,
        payment_method_invoice: params.paymentMethodInvoice || false,
        invoice_number: params.invoiceNumber || '',
        payment_due_date: params.paymentDueDate || ''
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.QUOTE_CONFIRMED_CLIENT,
        templateParams
      );

      console.log('✅ Quote client confirmation sent:', response);
      return { success: true };

    } catch (error) {
      console.error('❌ Error sending client confirmation:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send official payment receipt
   */
  async sendOfficialReceipt(params: {
    clientEmail: string;
    clientName: string;
    receiptNumber: string;
    receiptDate: string;
    paymentDate: string;
    invoiceNumber: string;
    quoteReference: string;
    companyName: string;
    subtotal: string;
    discount?: string;
    gst: string;
    totalAmount: string;
    amountPaid: string;
    paymentMethod: string;
    paymentReference?: string;
    serviceName: string;
    eventDates: string;
    eventAddress: string;
  }) {
    console.log('📧 Sending official receipt:', params.clientEmail);

    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not initialized');
      }

      const templateParams = {
        to_email: params.clientEmail,
        client_name: params.clientName,
        receipt_number: params.receiptNumber,
        receipt_date: params.receiptDate,
        payment_date: params.paymentDate,
        invoice_number: params.invoiceNumber,
        quote_reference: params.quoteReference,
        company_name: params.companyName,
        subtotal: params.subtotal,
        discount: params.discount || '',
        gst: params.gst,
        total_amount: params.totalAmount,
        amount_paid: params.amountPaid,
        payment_method: params.paymentMethod,
        payment_reference: params.paymentReference || '',
        service_name: params.serviceName,
        event_dates: params.eventDates,
        event_address: params.eventAddress
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.OFFICIAL_RECEIPT,
        templateParams
      );

      console.log('✅ Official receipt sent:', response);
      return { success: true };

    } catch (error) {
      console.error('❌ Error sending receipt:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  // ====== ADMIN EDIT PAGE SPECIFIC FUNCTIONS ======

  /**
   * Send booking modification notification to customer (Admin Edit Page)
   * This is specific to admin-initiated changes, different from booking platform updates
   */
  async sendAdminEditCustomerNotification(bookingData: BookingData, changes: any[]): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Format changes for email display
      const changesList = changes.map(change => {
        return `${change.fieldLabel}: ${change.originalValue} → ${change.newValue}`;
      }).join('\n• ');

      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || 'N/A',
        room_number: bookingData.room_number || 'N/A',
        therapist_name: bookingData.therapist_name || 'To be assigned',
        price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'TBD',
        changes_list: changesList,
        changes_count: changes.length
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.ADMIN_EDIT_CUSTOMER_UPDATE,
        templateParams
      );

      console.log('✅ Admin edit customer notification sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending admin edit customer notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send booking modification notification to therapist (Admin Edit Page)
   * This is specific to admin-initiated changes for the assigned therapist
   */
  async sendAdminEditTherapistNotification(bookingData: BookingData, therapistData: TherapistData, changes: any[], therapistFee?: number): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Format changes for email display
      const changesList = changes.map(change => {
        return `${change.fieldLabel}: ${change.originalValue} → ${change.newValue}`;
      }).join('\n• ');

      const templateParams = {
        to_email: therapistData.email,
        to_name: `${therapistData.first_name} ${therapistData.last_name}`,
        therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
        customer_name: bookingData.customer_name,
        customer_phone: bookingData.customer_phone || 'Not provided',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || 'N/A',
        room_number: bookingData.room_number || 'N/A',
        therapist_fee: therapistFee ? `$${therapistFee.toFixed(2)}` : 'TBD',
        changes_list: changesList,
        changes_count: changes.length
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.ADMIN_EDIT_THERAPIST_UPDATE,
        templateParams
      );

      console.log('✅ Admin edit therapist notification sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending admin edit therapist notification:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send notification to original therapist when booking is reassigned (Admin Edit Page)
   */
  async sendAdminEditTherapistReassignmentOriginal(bookingData: BookingData, originalTherapistData: TherapistData, newTherapistData: TherapistData): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: originalTherapistData.email,
        to_name: `${originalTherapistData.first_name} ${originalTherapistData.last_name}`,
        therapist_name: `${originalTherapistData.first_name} ${originalTherapistData.last_name}`,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        new_therapist_name: `${newTherapistData.first_name} ${newTherapistData.last_name}`,
        reason: 'Administrative reassignment due to scheduling requirements'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.ADMIN_EDIT_THERAPIST_REASSIGN_ORIGINAL,
        templateParams
      );

      console.log('✅ Admin edit original therapist reassignment notification sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending admin edit original therapist reassignment:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send notification to new therapist when they are assigned to a booking (Admin Edit Page)
   */
  async sendAdminEditTherapistReassignmentNew(bookingData: BookingData, newTherapistData: TherapistData, therapistFee?: number): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: newTherapistData.email,
        to_name: `${newTherapistData.first_name} ${newTherapistData.last_name}`,
        therapist_name: `${newTherapistData.first_name} ${newTherapistData.last_name}`,
        customer_name: bookingData.customer_name,
        customer_phone: bookingData.customer_phone || 'Not provided',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || 'N/A',
        room_number: bookingData.room_number || 'N/A',
        therapist_fee: therapistFee ? `$${therapistFee.toFixed(2)}` : 'TBD',
        notes: bookingData.notes || 'None'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.ADMIN_EDIT_THERAPIST_REASSIGN_NEW,
        templateParams
      );

      console.log('✅ Admin edit new therapist assignment notification sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending admin edit new therapist assignment:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send booking cancellation notification to customer
   */
  async sendBookingCancellationToCustomer(bookingData: BookingData, cancellationReason: string): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || 'N/A',
        room_number: bookingData.room_number || 'N/A',
        therapist_name: bookingData.therapist_name || 'Your therapist',
        cancellation_reason: cancellationReason,
        price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'TBD'
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        'Booking-cancel-client',
        templateParams
      );

      console.log('✅ Customer cancellation email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending customer cancellation email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send booking cancellation notification to therapist
   */
  async sendBookingCancellationToTherapist(bookingData: BookingData, therapistData: TherapistData, cancellationReason: string): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: therapistData.email,
        to_name: `${therapistData.first_name} ${therapistData.last_name}`,
        therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
        customer_name: bookingData.customer_name,
        customer_phone: bookingData.customer_phone || 'Not provided',
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString('en-AU', {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || 'N/A',
        room_number: bookingData.room_number || 'N/A',
        therapist_fee: bookingData.therapist_fee ? `$${bookingData.therapist_fee.toFixed(2)}` : 'TBD',
        cancellation_reason: cancellationReason
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        'Booking-cancel-therapist',
        templateParams
      );

      console.log('✅ Therapist cancellation email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending therapist cancellation email:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send individual booking invoice to customer
   */
  async sendIndividualInvoice(invoiceData: any): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      const templateParams = {
        to_email: invoiceData.customer_email,
        to_name: invoiceData.customer_name,
        from_name: 'Rejuvenators Mobile Massage',

        // Invoice details
        invoice_number: invoiceData.invoice_number,
        booking_id: invoiceData.booking_id,
        invoice_date: invoiceData.invoice_date,
        payment_due_date: invoiceData.payment_due_date,

        // Customer details
        customer_name: invoiceData.customer_name,
        customer_email: invoiceData.customer_email,
        customer_phone: invoiceData.customer_phone,

        // Service details
        service_name: invoiceData.service_name,
        duration: invoiceData.duration,
        booking_date: invoiceData.booking_date,
        booking_time: invoiceData.booking_time,
        address: invoiceData.address,
        business_name: invoiceData.business_name,
        room_number: invoiceData.room_number,

        // Therapist details
        therapist_name: invoiceData.therapist_name,
        therapist_email: invoiceData.therapist_email,

        // Pricing
        service_fee: invoiceData.service_fee,
        discount_amount: invoiceData.discount_amount,
        subtotal: invoiceData.subtotal,
        gst_amount: invoiceData.gst_amount,
        total_amount: invoiceData.total_amount,

        // Bank details
        bank_account_name: invoiceData.bank_account_name,
        bank_account_bsb: invoiceData.bank_account_bsb,
        bank_account_no: invoiceData.bank_account_no
      };

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        'Individual Invoice',
        templateParams
      );

      console.log('✅ Individual invoice sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending individual invoice:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * Send payment confirmation to therapist after payment is recorded
   */
  async sendTherapistPaymentConfirmation(params: {
    therapistEmail: string;
    therapistName: string;
    paymentDate: string;
    eftReference: string;
    weekPeriod: string;
    invoiceNumber: string;
    bookings: Array<{
      booking_id: string;
      booking_time: string;
      service_name: string;
      customer_name: string;
      therapist_fee: number;
    }>;
    totalFees: number;
    parkingAmount: number;
    totalPaid: number;
    paymentNotes?: string;
  }): Promise<{success: boolean, error?: string}> {
    try {
      if (!window.emailjs) {
        throw new Error('EmailJS not loaded');
      }

      // Generate booking items as plain text (EmailJS may not support HTML in variables)
      // Format: "Job #12345 - Mon, 15 Jan - Service Name - $50.00"
      const bookingItemsText = params.bookings.map(b => {
        const bookingDate = new Date(b.booking_time).toLocaleDateString('en-AU', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
        const serviceName = (b.service_name || '').trim();
        const bookingId = (b.booking_id || '').trim();
        const fee = b.therapist_fee ? b.therapist_fee.toFixed(2) : '0.00';
        
        return `Job #${bookingId} - ${bookingDate} - ${serviceName} - $${fee}`;
      }).join('\n');

      // Also generate HTML version for templates that support it
      const bookingItemsHtml = params.bookings.map(b => {
        const bookingDate = new Date(b.booking_time).toLocaleDateString('en-AU', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
        const serviceName = (b.service_name || '').trim();
        const bookingId = (b.booking_id || '').trim();
        const fee = b.therapist_fee ? b.therapist_fee.toFixed(2) : '0.00';
        
        return `<div class="booking-item">
          <span class="job-number">${bookingId}</span>
          <span class="date">${bookingDate} - ${serviceName}</span>
          <span class="fee">$${fee}</span>
        </div>`;
      }).join('');

      // Ensure all template parameters are properly formatted strings
      // Use plain text for booking_items to avoid EmailJS corruption issues
      const templateParams = {
        to_email: String(params.therapistEmail || ''),
        to_name: String(params.therapistName || ''),
        therapist_name: String(params.therapistName || ''),
        payment_date: String(params.paymentDate || ''),
        eft_reference: String(params.eftReference || ''),
        week_period: String(params.weekPeriod || ''),
        invoice_number: String(params.invoiceNumber || 'N/A'),
        booking_items: bookingItemsText, // Use plain text instead of HTML
        booking_items_html: bookingItemsHtml, // Also provide HTML version if template supports it
        booking_count: String(params.bookings?.length || 0),
        total_fees: String(Number(params.totalFees || 0).toFixed(2)),
        parking_amount: String(Number(params.parkingAmount || 0).toFixed(2)),
        total_paid: String(Number(params.totalPaid || 0).toFixed(2)),
        payment_notes: String(params.paymentNotes || ''),
        from_name: 'Rejuvenators Mobile Massage'
      };

      console.log('📧 Sending therapist payment confirmation:', params.therapistEmail);
      console.log('📧 Template params:', templateParams);

      const response = await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        TEMPLATE_IDS.THERAPIST_PAYMENT_CONFIRMATION,
        templateParams
      );

      console.log('✅ Therapist payment confirmation sent:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending therapist payment confirmation:', error);
      return { success: false, error: (error as Error).message };
    }
  }
};
