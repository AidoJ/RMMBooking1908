// Therapist Payment Calculation Service
// Handles weekly payment generation and management

import { supabaseClient } from '../utility';

export interface WeeklyPaymentData {
  therapist_id: string;
  therapist_name: string;
  week_start_date: string;
  week_end_date: string;
  total_assignments: number;
  total_hours: number;
  total_fee: number;
  payment_status: 'pending' | 'paid';
  paid_amount?: number;
  payment_date?: string;
  invoice_number?: string;
  payment_reference?: string;
  notes?: string;
}

export interface TherapistAssignment {
  id: string;
  booking_id: string;
  therapist_id: string;
  status: string;
  therapist_fee: number;
  hours_worked: number;
  confirmed_at: string;
  booking_time: string;
  weekly_payment_id?: string;
}

export class TherapistPaymentService {
  
  /**
   * Get the start and end dates for a given week
   * Assumes week starts on Monday
   */
  static getWeekBounds(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Get current week bounds
   */
  static getCurrentWeek(): { start: Date; end: Date } {
    return this.getWeekBounds(new Date());
  }

  /**
   * Get week bounds for a specific date string
   */
  static getWeekBoundsForDate(dateString: string): { start: Date; end: Date } {
    return this.getWeekBounds(new Date(dateString));
  }

  // Note: Complex payment generation methods have been replaced by database functions
  // See: generate_weekly_payments_for_date_range() in therapist_payments_database_function.sql

  /**
   * Generate weekly payments for all therapists using database function
   */
  static async generateWeeklyPaymentsForAllTherapists(
    weekStart?: Date,
    weekEnd?: Date
  ): Promise<{ success: boolean; paymentIds: string[]; errors: string[] }> {
    try {
      // Use current week if no dates provided
      const week = weekStart && weekEnd ? { start: weekStart, end: weekEnd } : this.getCurrentWeek();
      
      console.log(`📊 Generating weekly payments using database function for week ${week.start.toISOString().split('T')[0]} to ${week.end.toISOString().split('T')[0]}`);
      
      // Call the database function to do the heavy lifting
      const { data, error } = await supabaseClient
        .rpc('generate_weekly_payments_for_date_range', {
          start_date: week.start.toISOString().split('T')[0],
          end_date: week.end.toISOString().split('T')[0]
        });

      if (error) {
        console.error('Database function error:', error);
        throw error;
      }

      const paymentIds = (data || []).map((row: any) => row.payment_id);
      const therapistNames = (data || []).map((row: any) => row.therapist_name);
      
      console.log(`✅ Generated ${paymentIds.length} payment records for therapists: ${therapistNames.join(', ')}`);
      
      return {
        success: true,
        paymentIds,
        errors: []
      };

    } catch (error: any) {
      console.error('Error calling database payment generation:', error);
      return {
        success: false,
        paymentIds: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Get weekly payment data for display in admin interface
   */
  static async getWeeklyPaymentData(
    weekStart: Date,
    weekEnd: Date
  ): Promise<WeeklyPaymentData[]> {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_payments')
        .select(`
          *,
          therapist_profiles!inner(
            first_name,
            last_name
          )
        `)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .eq('week_end_date', weekEnd.toISOString().split('T')[0])
        .order('created_at');

      if (error) {
        console.error('Error fetching weekly payment data:', error);
        throw error;
      }

      return (data || []).map(payment => ({
        therapist_id: payment.therapist_id,
        therapist_name: `${(payment.therapist_profiles as any).first_name} ${(payment.therapist_profiles as any).last_name}`,
        week_start_date: payment.week_start_date,
        week_end_date: payment.week_end_date,
        total_assignments: payment.total_assignments,
        total_hours: payment.total_hours,
        total_fee: payment.total_fee,
        payment_status: payment.payment_status,
        paid_amount: payment.paid_amount,
        payment_date: payment.payment_date,
        invoice_number: payment.invoice_number,
        payment_reference: payment.payment_reference,
        notes: payment.notes
      }));

    } catch (error) {
      console.error('Error in getWeeklyPaymentData:', error);
      throw error;
    }
  }

  /**
   * Mark a weekly payment as paid
   */
  static async markPaymentAsPaid(
    therapistId: string,
    weekStart: Date,
    weekEnd: Date,
    paymentDetails: {
      paid_amount: number;
      payment_date: string;
      invoice_number: string;
      payment_reference?: string;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabaseClient
        .from('therapist_payments')
        .update({
          payment_status: 'paid',
          paid_amount: paymentDetails.paid_amount,
          payment_date: paymentDetails.payment_date,
          invoice_number: paymentDetails.invoice_number,
          payment_reference: paymentDetails.payment_reference,
          notes: paymentDetails.notes,
          updated_at: new Date().toISOString()
        })
        .eq('therapist_id', therapistId)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .eq('week_end_date', weekEnd.toISOString().split('T')[0]);

      if (error) {
        console.error('Error marking payment as paid:', error);
        throw error;
      }

      return true;

    } catch (error) {
      console.error('Error in markPaymentAsPaid:', error);
      return false;
    }
  }

  /**
   * Get payment history for a specific therapist
   */
  static async getTherapistPaymentHistory(
    therapistId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 10
  ): Promise<WeeklyPaymentData[]> {
    try {
      let query = supabaseClient
        .from('therapist_payments')
        .select(`
          *,
          therapist_profiles!inner(
            first_name,
            last_name
          )
        `)
        .eq('therapist_id', therapistId);

      if (startDate) {
        query = query.gte('week_start_date', startDate.toISOString().split('T')[0]);
      }

      if (endDate) {
        query = query.lte('week_end_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching therapist payment history:', error);
        throw error;
      }

      return (data || []).map(payment => ({
        therapist_id: payment.therapist_id,
        therapist_name: `${(payment.therapist_profiles as any).first_name} ${(payment.therapist_profiles as any).last_name}`,
        week_start_date: payment.week_start_date,
        week_end_date: payment.week_end_date,
        total_assignments: payment.total_assignments,
        total_hours: payment.total_hours,
        total_fee: payment.total_fee,
        payment_status: payment.payment_status,
        paid_amount: payment.paid_amount,
        payment_date: payment.payment_date,
        invoice_number: payment.invoice_number,
        payment_reference: payment.payment_reference,
        notes: payment.notes
      }));

    } catch (error) {
      console.error('Error in getTherapistPaymentHistory:', error);
      throw error;
    }
  }
}