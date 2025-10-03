import { supabaseClient } from '../utility';

export interface QuoteFinancialResult {
  baseAmount: number;
  weekendUpliftAmount: number;
  weekendUpliftPercentage: number;
  totalAmount: number;
  hasWeekendDays: boolean;
  calculationBreakdown: string;
}

/**
 * Get weekend uplift percentage from time_pricing_rules table
 * Based on existing logic from quote-form-enhanced.js
 */
async function getWeekendUpliftPercentage(eventDates: string[]): Promise<number> {
  try {
    console.log('🔍 Checking weekend uplift for dates:', eventDates);

    // Check if any dates fall on weekend (Saturday=6, Sunday=0)
    const weekendDates = eventDates.filter(date => {
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      console.log(`📅 Date: ${date}, Day of week: ${dayOfWeek}, Is weekend: ${isWeekend}`);
      return isWeekend;
    });

    if (weekendDates.length === 0) {
      console.log('✅ No weekend days found, no uplift applied');
      return 0; // No weekend days, no uplift
    }

    console.log('🔍 Weekend dates found:', weekendDates, 'Looking for pricing rules...');

    // Query time_pricing_rules for weekend uplift - try flexible query first
    const { data: weekendRules, error } = await supabaseClient
      .from('time_pricing_rules')
      .select('uplift_percentage, day_of_week, start_time, end_time')
      .in('day_of_week', ['0', '6']) // Sunday or Saturday
      .eq('is_active', true);

    console.log('📋 Found weekend pricing rules:', weekendRules);
    console.log('❌ Query error:', error);

    if (error || !weekendRules || weekendRules.length === 0) {
      console.warn('No weekend pricing rules found, using 0% uplift');
      return 0;
    }

    // Use the first available weekend rule
    const weekendRule = weekendRules[0];
    const upliftPercentage = parseFloat(weekendRule.uplift_percentage) || 0;

    console.log('💰 Weekend uplift percentage found:', upliftPercentage);
    return upliftPercentage;

  } catch (error) {
    console.error('Error fetching weekend uplift:', error);
    return 0; // Fallback to no uplift
  }
}

/**
 * Extract event dates from quote data
 * Handles both single day and multi-day events
 */
function extractEventDates(quoteData: any): string[] {
  const dates: string[] = [];

  if (quoteData.event_structure === 'single_day') {
    if (quoteData.single_event_date) {
      dates.push(quoteData.single_event_date);
    }
  } else {
    // Multi-day event - get dates from quote_dates
    if (quoteData.quote_dates && Array.isArray(quoteData.quote_dates)) {
      quoteData.quote_dates.forEach((dateEntry: any) => {
        if (dateEntry.event_date) {
          dates.push(dateEntry.event_date);
        }
      });
    }
  }

  return dates;
}

/**
 * Calculate total amount for quote including pro-rated weekend uplift
 * Based on per-day calculations like the booking side logic
 */
export async function calculateQuoteTotalAmount(
  eventDurationMinutes: number,
  hourlyRate: number,
  quoteData: any // Quote data containing event dates
): Promise<QuoteFinancialResult> {
  try {
    // Extract event dates
    const eventDates = extractEventDates(quoteData);

    if (eventDates.length === 0) {
      throw new Error('No event dates found');
    }

    // Calculate each day separately using quote_dates provided durations
    let totalAmount = 0;
    let totalWeekendUplift = 0;
    const breakdownLines: string[] = [];

    // Build a quick lookup of per-day minutes from quote_dates when available
    const quoteDatesArray: any[] = Array.isArray(quoteData?.quote_dates) ? quoteData.quote_dates : [];
    const minutesByDate: Record<string, number> = {};
    quoteDatesArray.forEach((entry: any) => {
      const dateStr = entry?.event_date;
      if (!dateStr) return;
      let minutes = 0;
      if (typeof entry.duration_minutes === 'number' && entry.duration_minutes > 0) {
        minutes = entry.duration_minutes;
      } else if (entry.start_time && entry.finish_time) {
        try {
          const [sh, sm] = String(entry.start_time).split(':').map((v: string) => parseInt(v, 10));
          const [eh, em] = String(entry.finish_time).split(':').map((v: string) => parseInt(v, 10));
          const startMins = sh * 60 + (isNaN(sm) ? 0 : sm);
          const endMins = eh * 60 + (isNaN(em) ? 0 : em);
          const diff = Math.max(0, endMins - startMins);
          minutes = diff;
        } catch {
          minutes = 0;
        }
      }
      if (minutes > 0) {
        minutesByDate[dateStr] = minutes;
      }
    });

    for (const date of eventDates) {
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

      // Determine this day's duration in minutes; if not present, fall back to even split
      let dayMinutes: number;
      if (minutesByDate[date] != null) {
        dayMinutes = minutesByDate[date];
      } else {
        // Fallback: evenly split total minutes across available dates
        dayMinutes = Math.floor(eventDurationMinutes / Math.max(1, eventDates.length));
      }
      const hoursForDay = dayMinutes / 60;

      // Base amount for this day
      const dayBaseAmount = hoursForDay * hourlyRate;

      let dayFinalAmount = dayBaseAmount;
      let dayUplift = 0;

      if (isWeekend) {
        // Get weekend uplift for this specific day
        const weekendUpliftPercentage = await getWeekendUpliftPercentage([date]);
        if (weekendUpliftPercentage > 0) {
          const upliftMultiplier = 1 + (weekendUpliftPercentage / 100);
          dayFinalAmount = dayBaseAmount * upliftMultiplier;
          dayUplift = dayFinalAmount - dayBaseAmount;

          console.log(`📅 ${date} (${getDayName(dayOfWeek)}): ${hoursForDay}h × $${hourlyRate} × ${upliftMultiplier} = $${dayFinalAmount.toFixed(2)}`);
          breakdownLines.push(`${date} (${getDayName(dayOfWeek)}): ${hoursForDay.toFixed(1)}h × $${hourlyRate} × ${upliftMultiplier} = $${dayFinalAmount.toFixed(2)}`);
        }
      } else {
        console.log(`📅 ${date} (${getDayName(dayOfWeek)}): ${hoursForDay}h × $${hourlyRate} = $${dayFinalAmount.toFixed(2)}`);
        breakdownLines.push(`${date} (${getDayName(dayOfWeek)}): ${hoursForDay.toFixed(1)}h × $${hourlyRate} = $${dayFinalAmount.toFixed(2)}`);
      }

      totalAmount += dayFinalAmount;
      totalWeekendUplift += dayUplift;
    }

    const baseAmount = (eventDurationMinutes / 60) * hourlyRate;
    const hasWeekendDays = totalWeekendUplift > 0;
    const overallUpliftPercentage = baseAmount > 0 ? (totalWeekendUplift / baseAmount) * 100 : 0;

    // Create calculation breakdown
    let breakdown = `Per-day calculation:\n${breakdownLines.join('\n')}`;
    if (hasWeekendDays) {
      breakdown += `\n\nBase: $${baseAmount.toFixed(2)} + Weekend uplift: $${totalWeekendUplift.toFixed(2)}`;
    }
    breakdown += `\nTotal: $${totalAmount.toFixed(2)}`;

    console.log(`💰 Final totals: Base $${baseAmount.toFixed(2)}, Uplift $${totalWeekendUplift.toFixed(2)}, Total $${totalAmount.toFixed(2)}`);

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      weekendUpliftAmount: Math.round(totalWeekendUplift * 100) / 100,
      weekendUpliftPercentage: Math.round(overallUpliftPercentage * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      hasWeekendDays,
      calculationBreakdown: breakdown
    };

  } catch (error) {
    console.error('Error calculating quote total amount:', error);

    // Fallback calculation without uplift
    const durationHours = eventDurationMinutes / 60;
    const baseAmount = durationHours * hourlyRate;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      weekendUpliftAmount: 0,
      weekendUpliftPercentage: 0,
      totalAmount: Math.round(baseAmount * 100) / 100,
      hasWeekendDays: false,
      calculationBreakdown: `${durationHours.toFixed(1)} hours × $${hourlyRate.toFixed(2)}/hr = $${baseAmount.toFixed(2)}`
    };
  }
}

/**
 * Helper function to get day name
 */
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Simplified version that takes event dates directly
 */
export async function calculateQuoteTotalAmountFromDates(
  eventDurationMinutes: number,
  hourlyRate: number,
  eventDates: string[]
): Promise<QuoteFinancialResult> {
  const mockQuoteData = {
    event_structure: eventDates.length === 1 ? 'single_day' : 'multi_day',
    single_event_date: eventDates.length === 1 ? eventDates[0] : null,
    quote_dates: eventDates.length > 1 ? eventDates.map(date => ({ event_date: date })) : []
  };

  return calculateQuoteTotalAmount(eventDurationMinutes, hourlyRate, mockQuoteData);
}

/**
 * New helper: calculate total from explicit quote_dates entries with per-day minutes
 */
export async function calculateQuoteTotalFromQuoteDates(
  hourlyRate: number,
  quoteDates: Array<{ event_date: string; start_time?: string; finish_time?: string; duration_minutes?: number; }>
): Promise<QuoteFinancialResult> {
  const eventDates = (quoteDates || []).map(d => d.event_date).filter(Boolean);
  const mockQuoteData = {
    event_structure: eventDates.length === 1 ? 'single_day' : 'multi_day',
    single_event_date: eventDates.length === 1 ? eventDates[0] : null,
    quote_dates: quoteDates || []
  };

  // eventDurationMinutes is only used for fallback splitting; provide sum of minutes when available
  const totalMinutes = (quoteDates || []).reduce((sum, d) => {
    if (typeof d.duration_minutes === 'number' && d.duration_minutes > 0) return sum + d.duration_minutes;
    if (d.start_time && d.finish_time) {
      try {
        const [sh, sm] = String(d.start_time).split(':').map((v: string) => parseInt(v, 10));
        const [eh, em] = String(d.finish_time).split(':').map((v: string) => parseInt(v, 10));
        const startMins = sh * 60 + (isNaN(sm) ? 0 : sm);
        const endMins = eh * 60 + (isNaN(em) ? 0 : em);
        const diff = Math.max(0, endMins - startMins);
        return sum + diff;
      } catch {
        return sum;
      }
    }
    return sum;
  }, 0);

  return calculateQuoteTotalAmount(totalMinutes, hourlyRate, mockQuoteData);
}