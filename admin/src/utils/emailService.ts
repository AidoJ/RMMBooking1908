// EmailJS configuration (matches booking platform)
const EMAILJS_SERVICE_ID = 'service_puww2kb';
const EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Template IDs for admin notifications
const TEMPLATE_IDS = {
  BOOKING_UPDATE_CUSTOMER: 'template_butcv1',
  BOOKING_UPDATE_THERAPIST: 'template_buttv1', 
  THERAPIST_REASSIGNED_OLD: 'template_brot-v1',
  THERAPIST_REASSIGNED_NEW: 'template_brnt-v1'
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
  notes?: string;
  room_number?: string;
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
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        duration: `${bookingData.duration_minutes || 60} minutes`,
        changes: changes.join('\\n• '),
        // Additional variables that might be expected
        client_name: bookingData.customer_name,
        client_email: bookingData.customer_email,
        room_number: bookingData.room_number || ''
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
        therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id || bookingData.id,
        service_name: bookingData.service_name,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        duration: `${bookingData.duration_minutes || 60} minutes`,
        customer_phone: bookingData.customer_phone || 'Not provided',
        changes: changes.join('\\n• '),
        // Additional variables that might be expected
        client_name: bookingData.customer_name,
        client_email: bookingData.customer_email,
        client_phone: bookingData.customer_phone || 'Not provided',
        room_number: bookingData.room_number || ''
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
  }
};