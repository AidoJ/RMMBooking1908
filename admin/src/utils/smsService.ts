import { supabaseClient } from '../utility';

export class SMSService {
  /**
   * Send SMS notification to therapist about a new booking
   */
  static async sendBookingRequestToTherapist(booking: any, therapist: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 Sending booking request SMS to therapist:', therapist.phone);
      
      if (!therapist.phone) {
        return { success: false, error: 'Therapist phone number not available' };
      }

      const baseUrl = 'https://rmmbookingplatform.netlify.app/.netlify/functions/therapist-response';
      const acceptLink = `${baseUrl}?booking_id=${booking.booking_id}&action=accept&therapist_id=${therapist.id}`;
      const declineLink = `${baseUrl}?booking_id=${booking.booking_id}&action=decline&therapist_id=${therapist.id}`;
      
      const message = `📱 NEW BOOKING REQUEST

Booking ID: ${booking.booking_id}
Client: ${booking.first_name} ${booking.last_name}
Date: ${new Date(booking.booking_time).toLocaleDateString()}
Time: ${new Date(booking.booking_time).toLocaleTimeString()}
Duration: ${booking.duration_minutes} minutes
Fee: $${booking.therapist_fee || 'TBD'}

Quick Response:
✅ Accept: ${acceptLink}
❌ Decline: ${declineLink}

- Rejuvenators`;

      const result = await this.sendSMS(therapist.phone, message);
      return result;

    } catch (error) {
      console.error('❌ Error sending booking request SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send SMS notification to customer about booking status
   */
  static async sendBookingUpdateToCustomer(booking: any, therapist: any, action: 'confirmed' | 'declined'): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 Sending booking update SMS to customer:', booking.customer_phone);
      
      if (!booking.customer_phone) {
        return { success: false, error: 'Customer phone number not available' };
      }

      const isConfirmed = action === 'confirmed';
      const message = isConfirmed ?
        `🎉 BOOKING CONFIRMED!

${therapist.first_name} ${therapist.last_name} has accepted your massage booking for ${new Date(booking.booking_time).toLocaleDateString()} at ${new Date(booking.booking_time).toLocaleTimeString()}.

Check your email for full details!
- Rejuvenators` :
        `❌ BOOKING UPDATE

Unfortunately, your therapist declined booking ${booking.booking_id}. We're looking for alternatives and will update you soon.
- Rejuvenators`;

      const result = await this.sendSMS(booking.customer_phone, message);
      return result;

    } catch (error) {
      console.error('❌ Error sending customer update SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send SMS notification to therapist about booking confirmation
   */
  static async sendBookingConfirmationToTherapist(booking: any, therapist: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 Sending booking confirmation SMS to therapist:', therapist.phone);
      
      if (!therapist.phone) {
        return { success: false, error: 'Therapist phone number not available' };
      }

      const message = `✅ BOOKING CONFIRMED!

You've accepted booking ${booking.booking_id}
Client: ${booking.first_name} ${booking.last_name}
Date: ${new Date(booking.booking_time).toLocaleDateString()} at ${new Date(booking.booking_time).toLocaleTimeString()}
Fee: $${booking.therapist_fee || 'TBD'}

Client will be notified. Check email for full details.
- Rejuvenators`;

      const result = await this.sendSMS(therapist.phone, message);
      return result;

    } catch (error) {
      console.error('❌ Error sending therapist confirmation SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send SMS notification to therapist about booking decline
   */
  static async sendBookingDeclineToTherapist(booking: any, therapist: any): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 Sending booking decline SMS to therapist:', therapist.phone);
      
      if (!therapist.phone) {
        return { success: false, error: 'Therapist phone number not available' };
      }

      const message = `📝 BOOKING DECLINED

You've declined booking ${booking.booking_id}. The client has been notified.
- Rejuvenators`;

      const result = await this.sendSMS(therapist.phone, message);
      return result;

    } catch (error) {
      console.error('❌ Error sending therapist decline SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Core SMS sending function
   */
  private static async sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`📱 Sending SMS to ${phoneNumber}`);
      console.log(`📄 Message preview: ${message.substring(0, 100)}...`);
      
      const response = await fetch('https://rmmbookingplatform.netlify.app/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, message: message })
      });
      
      const result = await response.json();
      console.log('📱 SMS API response:', result);
      
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error || 'SMS sending failed' };
      }
    } catch (error) {
      console.error('❌ Error sending SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Format phone number for SMS sending
   */
  static formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Handle Australian phone numbers
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return '+61' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      return '+61' + cleaned;
    } else if (phone.startsWith('+61')) {
      return phone;
    } else {
      return phone;
    }
  }
}

