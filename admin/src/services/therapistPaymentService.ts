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

  /**
   * Fetch all completed therapist assignments for a given week
   * that haven't been linked to a payment record yet
   */
  static async getCompletedAssignmentsForWeek(
    weekStart: Date, 
    weekEnd: Date, 
    therapistId?: string
  ): Promise<TherapistAssignment[]> {
    try {
      let query = supabaseClient
        .from('booking_therapist_assignments')
        .select(`
          id,
          booking_id,
          therapist_id,
          status,
          therapist_fee,
          hours_worked,
          confirmed_at,
          weekly_payment_id,
          bookings!inner(
            booking_time,
            status
          )
        `)
        .eq('status', 'completed')
        .is('weekly_payment_id', null) // Only get assignments not yet linked to payments
        .gte('bookings.booking_time', weekStart.toISOString())
        .lte('bookings.booking_time', weekEnd.toISOString());

      if (therapistId) {
        query = query.eq('therapist_id', therapistId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching completed assignments:', error);
        throw error;
      }

      return (data || []).map(assignment => ({
        id: assignment.id,
        booking_id: assignment.booking_id,
        therapist_id: assignment.therapist_id,
        status: assignment.status,
        therapist_fee: assignment.therapist_fee || 0,
        hours_worked: assignment.hours_worked || 0,
        confirmed_at: assignment.confirmed_at,
        booking_time: (assignment.bookings as any).booking_time,
        weekly_payment_id: assignment.weekly_payment_id
      }));

    } catch (error) {
      console.error('Error in getCompletedAssignmentsForWeek:', error);
      throw error;
    }
  }

  /**
   * Calculate weekly payment totals for a therapist
   */
  static calculateWeeklyTotals(assignments: TherapistAssignment[]): {
    total_assignments: number;
    total_hours: number;
    total_fee: number;
  } {
    return {
      total_assignments: assignments.length,
      total_hours: assignments.reduce((sum, assignment) => sum + (assignment.hours_worked || 0), 0),
      total_fee: assignments.reduce((sum, assignment) => sum + (assignment.therapist_fee || 0), 0)
    };
  }

  /**
   * Generate weekly payment record for a single therapist
   */
  static async generateWeeklyPaymentForTherapist(
    therapistId: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<string | null> {
    try {
      // Get completed assignments for this therapist and week
      const assignments = await this.getCompletedAssignmentsForWeek(weekStart, weekEnd, therapistId);

      if (assignments.length === 0) {
        console.log(`No completed assignments found for therapist ${therapistId} in week ${weekStart.toISOString().split('T')[0]}`);
        return null;
      }

      // Calculate totals
      const totals = this.calculateWeeklyTotals(assignments);

      // Check if payment record already exists
      const { data: existingPayment } = await supabaseClient
        .from('therapist_payments')
        .select('id')
        .eq('therapist_id', therapistId)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .eq('week_end_date', weekEnd.toISOString().split('T')[0])
        .single();

      if (existingPayment) {
        console.log(`Payment record already exists for therapist ${therapistId} for week ${weekStart.toISOString().split('T')[0]}`);
        return existingPayment.id;
      }

      // Create weekly payment record
      const { data: paymentRecord, error: paymentError } = await supabaseClient
        .from('therapist_payments')
        .insert({
          therapist_id: therapistId,
          week_start_date: weekStart.toISOString().split('T')[0],
          week_end_date: weekEnd.toISOString().split('T')[0],
          total_assignments: totals.total_assignments,
          total_hours: totals.total_hours,
          total_fee: totals.total_fee,
          payment_status: 'pending'
        })
        .select('id')
        .single();

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
        throw paymentError;
      }

      const paymentId = paymentRecord.id;

      // Link all assignments to this payment record
      const assignmentIds = assignments.map(a => a.id);
      const { error: linkError } = await supabaseClient
        .from('booking_therapist_assignments')
        .update({ weekly_payment_id: paymentId })
        .in('id', assignmentIds);

      if (linkError) {
        console.error('Error linking assignments to payment:', linkError);
        throw linkError;
      }

      console.log(`Created payment record ${paymentId} for therapist ${therapistId} with ${assignments.length} assignments`);
      return paymentId;

    } catch (error) {
      console.error('Error generating weekly payment for therapist:', error);
      throw error;
    }
  }

  /**
   * Generate weekly payments for all therapists with completed assignments
   */
  static async generateWeeklyPaymentsForAllTherapists(
    weekStart?: Date,
    weekEnd?: Date
  ): Promise<{ success: boolean; paymentIds: string[]; errors: string[] }> {
    try {
      // Use current week if no dates provided
      const week = weekStart && weekEnd ? { start: weekStart, end: weekEnd } : this.getCurrentWeek();
      
      // Get all therapists who have completed assignments in this week
      const assignments = await this.getCompletedAssignmentsForWeek(week.start, week.end);
      
      // Group assignments by therapist
      const therapistAssignments = assignments.reduce((acc, assignment) => {
        if (!acc[assignment.therapist_id]) {
          acc[assignment.therapist_id] = [];
        }
        acc[assignment.therapist_id].push(assignment);
        return acc;
      }, {} as Record<string, TherapistAssignment[]>);

      const paymentIds: string[] = [];
      const errors: string[] = [];

      // Generate payment record for each therapist
      for (const therapistId of Object.keys(therapistAssignments)) {
        try {
          const paymentId = await this.generateWeeklyPaymentForTherapist(
            therapistId,
            week.start,
            week.end
          );
          
          if (paymentId) {
            paymentIds.push(paymentId);
          }
        } catch (error: any) {
          errors.push(`Therapist ${therapistId}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        paymentIds,
        errors
      };

    } catch (error: any) {
      console.error('Error generating weekly payments for all therapists:', error);
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