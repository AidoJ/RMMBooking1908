import { supabaseClient } from '../utility';
import dayjs from 'dayjs';

/**
 * Calculate duration in minutes from start and finish times
 * Hybrid approach: Use stored duration_minutes if available, otherwise calculate from times
 */
function calculateDayDuration(startTime: string, finishTime: string, storedDuration?: number): number {
  // Use stored duration if available and valid
  if (storedDuration && storedDuration > 0) {
    return storedDuration;
  }

  // Fallback: Calculate from start/finish times
  if (!startTime || !finishTime) return 0;

  const start = dayjs(`2000-01-01 ${startTime}`);
  const end = dayjs(`2000-01-01 ${finishTime}`);
  return end.diff(start, 'minute');
}

export interface TherapistAvailability {
  therapist_id: string;
  therapist_name: string;
  therapist_email: string;
  gender: string;
  rating: number;
  is_available: boolean;
  conflict_reason?: string;
  hourly_rate: number;
  afterhours_rate: number;
  is_afterhours: boolean;
}

export interface DayAvailability {
  date: string;
  start_time: string;
  sessions_count: number;
  therapists_required: number;
  therapists_available: number;
  available_therapists: TherapistAvailability[];
  can_fulfill: boolean;
  status: 'available' | 'partial' | 'unavailable';
  alternatives?: string[];
  duration_minutes: number; // Day-specific duration
}

export interface QuoteAvailabilityResult {
  quote_id: string;
  can_fulfill_completely: boolean;
  overall_status: 'available' | 'partial' | 'unavailable';
  duration_minutes: number;
  days: DayAvailability[];
  summary: {
    total_days: number;
    available_days: number;
    partial_days: number;
    unavailable_days: number;
  };
  quote?: any; // Full quote data for accessing service_arrangement and other fields
}

/**
 * Check if a specific time falls within business hours
 */
function isBusinessHours(date: string, time: string): boolean {
  const dayOfWeek = dayjs(date).day();
  const hour = parseInt(time.split(':')[0]);

  // Weekend is always afterhours
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Assuming business hours 8AM - 6PM (can be made configurable)
  return hour >= 8 && hour < 18;
}

/**
 * Get system settings for therapist rates
 * NOTE: This function is deprecated and no longer used for rate calculation.
 * Rates are now fetched from individual therapist profiles.
 * Kept for backwards compatibility only.
 */
async function getSystemRates(): Promise<{daytimeRate: number, weekendRate: number}> {
  try {
    const { data: settings, error } = await supabaseClient
      .from('system_settings')
      .select('key, value')
      .in('key', ['therapist_daytime_hourly_rate', 'therapist_weekend_hourly_rate']);

    if (error) {
      console.error('Error fetching system settings:', error);
      // Fallback rates
      return { daytimeRate: 75, weekendRate: 100 };
    }

    const daytimeRate = settings?.find(s => s.key === 'therapist_daytime_hourly_rate')?.value || '75';
    const weekendRate = settings?.find(s => s.key === 'therapist_weekend_hourly_rate')?.value || '100';

    return {
      daytimeRate: parseFloat(daytimeRate),
      weekendRate: parseFloat(weekendRate)
    };
  } catch (error) {
    console.error('Error getting system rates:', error);
    return { daytimeRate: 75, weekendRate: 100 };
  }
}

/**
 * Get therapist's hourly rate based on time using therapist profile rates
 */
async function getTherapistRate(therapist: any, date: string, time: string): Promise<number> {
  const isBusinessTime = isBusinessHours(date, time);

  // Use therapist profile rates
  const rate = isBusinessTime ? therapist.hourly_rate : therapist.afterhours_rate;

  // Validation: ensure rates exist
  if (!rate || rate <= 0) {
    throw new Error(`Missing or invalid rate for therapist ${therapist.first_name} ${therapist.last_name}. Please ensure hourly_rate and afterhours_rate are set in the therapist profile.`);
  }

  return rate;
}

/**
 * Check if therapist is available based on their weekly schedule
 */
async function checkTherapistWeeklyAvailability(
  therapistId: string,
  date: string,
  startTime: string
): Promise<boolean> {
  const dayOfWeek = dayjs(date).day();

  const { data: availability } = await supabaseClient
    .from('therapist_availability')
    .select('start_time, end_time')
    .eq('therapist_id', therapistId)
    .eq('day_of_week', dayOfWeek);

  if (!availability || availability.length === 0) {
    return false; // No availability set for this day
  }

  // Check if requested time falls within available hours
  return availability.some(slot => {
    return startTime >= slot.start_time && startTime < slot.end_time;
  });
}

/**
 * Check if therapist has time off on the requested date
 */
async function checkTherapistTimeOff(
  therapistId: string,
  date: string
): Promise<boolean> {
  const { data: timeOff } = await supabaseClient
    .from('therapist_time_off')
    .select('start_date, end_date, start_time, end_time')
    .eq('therapist_id', therapistId)
    .eq('is_active', true)
    .lte('start_date', date)
    .gte('end_date', date);

  return Boolean(timeOff && timeOff.length > 0);
}

/**
 * Check for existing booking conflicts
 */
async function checkBookingConflicts(
  therapistId: string,
  date: string,
  startTime: string,
  durationMinutes: number
): Promise<boolean> {
  const startDateTime = dayjs(`${date}T${startTime}`);
  const endDateTime = startDateTime.add(durationMinutes, 'minute');

  const { data: conflicts } = await supabaseClient
    .from('bookings')
    .select('booking_time, duration_minutes')
    .eq('therapist_id', therapistId)
    .in('status', ['confirmed', 'requested']) // Include tentative bookings
    .gte('booking_time', startDateTime.subtract(30, 'minute').toISOString()) // Buffer before
    .lte('booking_time', endDateTime.add(30, 'minute').toISOString()); // Buffer after

  if (!conflicts || conflicts.length === 0) {
    return false;
  }

  // Check for actual time overlaps with buffer
  return conflicts.some(booking => {
    const bookingStart = dayjs(booking.booking_time);
    const bookingEnd = bookingStart.add(booking.duration_minutes + 30, 'minute'); // Add buffer
    const requestStart = startDateTime.subtract(30, 'minute'); // Add buffer
    const requestEnd = endDateTime.add(30, 'minute');

    return requestStart.isBefore(bookingEnd) && requestEnd.isAfter(bookingStart);
  });
}

/**
 * Get available therapists for a specific date/time slot
 */
export async function getAvailableTherapists(
  date: string,
  startTime: string,
  durationMinutes: number,
  requiredCount: number = 1,
  latitude?: number | null,
  longitude?: number | null
): Promise<TherapistAvailability[]> {
  try {
    // Get all active therapists with their hourly rates and location data
    const { data: therapists, error } = await supabaseClient
      .from('therapist_profiles')
      .select('id, first_name, last_name, email, gender, rating, is_active, hourly_rate, afterhours_rate, latitude, longitude, service_radius_km')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching therapists:', error);
      return [];
    }

    if (!therapists) {
      return [];
    }

    // Filter by geolocation if coordinates are provided
    let filteredTherapists = therapists;
    if (latitude && longitude) {
      console.log(`🌍 Filtering therapists by location: ${latitude}, ${longitude}`);

      // Haversine distance calculation
      const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      filteredTherapists = therapists.filter(t => {
        if (t.latitude == null || t.longitude == null || t.service_radius_km == null) {
          console.log(`⚠️ Therapist ${t.id} (${t.first_name} ${t.last_name}) missing location data - excluded from location filtering`);
          return false;
        }
        const dist = getDistanceKm(latitude, longitude, t.latitude, t.longitude);
        const inRange = dist <= t.service_radius_km;
        console.log(`📍 Therapist ${t.first_name} ${t.last_name}: distance ${dist.toFixed(2)}km, radius ${t.service_radius_km}km - ${inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
        return inRange;
      });

      console.log(`✅ Location filtering: ${filteredTherapists.length} of ${therapists.length} therapists service this area`);
    }

    const availabilityResults: TherapistAvailability[] = [];

    for (const therapist of filteredTherapists) {
      let isAvailable = true;
      let conflictReason = '';

      // Check weekly availability
      const hasWeeklyAvailability = await checkTherapistWeeklyAvailability(
        therapist.id,
        date,
        startTime
      );

      if (!hasWeeklyAvailability) {
        isAvailable = false;
        conflictReason = 'Not available on this day/time';
      }

      // Check time off
      if (isAvailable) {
        const hasTimeOff = await checkTherapistTimeOff(therapist.id, date);
        if (hasTimeOff) {
          isAvailable = false;
          conflictReason = 'On time off';
        }
      }

      // Check booking conflicts
      if (isAvailable) {
        const hasConflict = await checkBookingConflicts(
          therapist.id,
          date,
          startTime,
          durationMinutes
        );
        if (hasConflict) {
          isAvailable = false;
          conflictReason = 'Existing booking conflict';
        }
      }

      const isAfterHours = !isBusinessHours(date, startTime);

      // Include both rates from therapist profile
      availabilityResults.push({
        therapist_id: therapist.id,
        therapist_name: `${therapist.first_name} ${therapist.last_name}`,
        therapist_email: therapist.email,
        gender: therapist.gender,
        rating: therapist.rating || 0,
        is_available: isAvailable,
        conflict_reason: conflictReason,
        hourly_rate: therapist.hourly_rate || 0,
        afterhours_rate: therapist.afterhours_rate || 0,
        is_afterhours: isAfterHours
      });
    }

    return availabilityResults;

  } catch (error) {
    console.error('Error checking therapist availability:', error);
    return [];
  }
}

/**
 * Calculate how many therapists are needed based on workload
 */
function calculateTherapistsNeeded(sessionsCount: number, sessionDurationMinutes: number): number {
  const totalHours = (sessionsCount * sessionDurationMinutes) / 60;

  // If more than 4 hours of work, split between 2 therapists
  return totalHours > 4 ? 2 : 1;
}

/**
 * Check availability for an entire quote (all days)
 */
export async function checkQuoteAvailability(quoteId: string, latitude?: number | null, longitude?: number | null): Promise<QuoteAvailabilityResult> {
  try {
    // Get quote details
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .select(`
        *,
        quote_dates (
          event_date,
          start_time,
          finish_time,
          day_number,
          sessions_count,
          duration_minutes
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error('Quote not found');
    }

    const days: DayAvailability[] = [];
    let availableDays = 0;
    let partialDays = 0;
    let unavailableDays = 0;

    // Handle single day vs multi-day events
    const eventDays = quote.event_structure === 'single_day'
      ? [{
          event_date: quote.single_event_date,
          start_time: quote.single_start_time,
          day_number: 1,
          sessions_count: quote.total_sessions
        }]
      : (quote.quote_dates && quote.quote_dates.length > 0
         ? quote.quote_dates
         : [{
             event_date: null, // Will need manual entry
             start_time: null,
             day_number: 1,
             sessions_count: quote.total_sessions
           }]);

    for (const day of eventDays) {
      if (!day.event_date || !day.start_time) {
        continue;
      }

      // Calculate day-specific duration using hybrid approach
      const dayDurationMinutes = calculateDayDuration(
        day.start_time,
        day.finish_time || '',
        day.duration_minutes
      );

      // Use manual therapists_needed from quote edit form, fallback to legacy calculation
      const therapistsRequired = quote.therapists_needed || calculateTherapistsNeeded(
        day.sessions_count || quote.total_sessions,
        quote.session_duration_minutes
      );

      const availableTherapists = await getAvailableTherapists(
        day.event_date,
        day.start_time,
        quote.session_duration_minutes,
        therapistsRequired,
        latitude,
        longitude
      );

      const availableCount = availableTherapists.filter(t => t.is_available).length;

      let status: 'available' | 'partial' | 'unavailable';
      if (availableCount >= therapistsRequired) {
        status = 'available';
        availableDays++;
      } else if (availableCount > 0) {
        status = 'partial';
        partialDays++;
      } else {
        status = 'unavailable';
        unavailableDays++;
      }

      days.push({
        date: day.event_date,
        start_time: day.start_time,
        sessions_count: day.sessions_count || quote.total_sessions,
        therapists_required: therapistsRequired,
        therapists_available: availableCount,
        available_therapists: availableTherapists,
        can_fulfill: availableCount >= therapistsRequired,
        status,
        alternatives: status !== 'available' ? [] : undefined, // TODO: Generate alternatives
        duration_minutes: dayDurationMinutes // Day-specific duration
      });
    }

    const canFulfillCompletely = days.every(day => day.can_fulfill);
    const overallStatus = canFulfillCompletely
      ? 'available'
      : (availableDays > 0 ? 'partial' : 'unavailable');

    // Calculate total duration from individual day durations (accurate approach)
    const totalDurationMinutes = days.reduce((total, day) => total + day.duration_minutes, 0);

    return {
      quote_id: quoteId,
      can_fulfill_completely: canFulfillCompletely,
      overall_status: overallStatus,
      duration_minutes: totalDurationMinutes, // Sum of all day-specific durations
      days,
      summary: {
        total_days: days.length,
        available_days: availableDays,
        partial_days: partialDays,
        unavailable_days: unavailableDays
      },
      quote // Include full quote for accessing service_arrangement
    };

  } catch (error) {
    console.error('Error checking quote availability:', error);
    throw error;
  }
}

/**
 * Suggest alternative dates/times for unavailable slots
 */
export async function suggestAlternatives(
  originalDate: string,
  originalTime: string,
  durationMinutes: number,
  therapistsRequired: number,
  daysToCheck: number = 7,
  latitude?: number | null,
  longitude?: number | null
): Promise<string[]> {
  const alternatives: string[] = [];
  const startDate = dayjs(originalDate);

  // Check next 7 days for availability
  for (let i = 1; i <= daysToCheck; i++) {
    const checkDate = startDate.add(i, 'day');
    const dateStr = checkDate.format('YYYY-MM-DD');

    // Check same time
    const available = await getAvailableTherapists(
      dateStr,
      originalTime,
      durationMinutes,
      therapistsRequired,
      latitude,
      longitude
    );

    if (available.filter(t => t.is_available).length >= therapistsRequired) {
      alternatives.push(`${checkDate.format('MMMM DD, YYYY')} at ${originalTime}`);
    }
  }

  return alternatives.slice(0, 3); // Return top 3 alternatives
}