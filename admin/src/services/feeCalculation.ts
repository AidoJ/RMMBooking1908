import { supabaseClient } from '../utility';

export interface FeeCalculationResult {
  therapistFee: number;
  hourlyRate: number;
  hoursWorked: number;
  rateType: 'daytime' | 'afterhours' | 'weekend';
}

export interface SystemSettings {
  therapist_daytime_hourly_rate: number;
  therapist_afterhours_hourly_rate: number;
  therapist_weekend_hourly_rate?: number;
  business_opening_time: number;
  business_closing_time: number;
}

// Cache for system settings to avoid repeated database calls
let cachedSettings: SystemSettings | null = null;
let settingsLastFetched = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getSystemSettings(): Promise<SystemSettings> {
  const now = Date.now();
  
  if (cachedSettings && (now - settingsLastFetched) < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabaseClient
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'therapist_daytime_hourly_rate',
        'therapist_afterhours_hourly_rate', 
        'therapist_weekend_hourly_rate',
        'business_opening_time',
        'business_closing_time'
      ]);

    if (error) throw error;

    const settings: Partial<SystemSettings> = {};
    data.forEach(setting => {
      settings[setting.key as keyof SystemSettings] = parseFloat(setting.value);
    });

    // Default fallbacks
    cachedSettings = {
      therapist_daytime_hourly_rate: settings.therapist_daytime_hourly_rate || 90,
      therapist_afterhours_hourly_rate: settings.therapist_afterhours_hourly_rate || 105,
      therapist_weekend_hourly_rate: settings.therapist_weekend_hourly_rate,
      business_opening_time: settings.business_opening_time || 9,
      business_closing_time: settings.business_closing_time || 17,
    };

    settingsLastFetched = now;
    return cachedSettings;

  } catch (error) {
    console.error('Error fetching system settings:', error);
    // Return default settings if database fails
    return {
      therapist_daytime_hourly_rate: 90,
      therapist_afterhours_hourly_rate: 105,
      business_opening_time: 9,
      business_closing_time: 17,
    };
  }
}

export function isWeekend(dateString: string): boolean {
  const date = new Date(dateString);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function isAfterHours(timeString: string, settings: SystemSettings): boolean {
  // Parse time string (assumes format like "14:30" or "2:30 PM")
  let hour: number;
  
  if (timeString.includes('AM') || timeString.includes('PM')) {
    // 12-hour format
    const [time, period] = timeString.split(' ');
    const [hourStr] = time.split(':');
    hour = parseInt(hourStr);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
  } else {
    // 24-hour format
    const [hourStr] = timeString.split(':');
    hour = parseInt(hourStr);
  }

  return hour < settings.business_opening_time || hour >= settings.business_closing_time;
}

export function determineRateType(
  bookingDate: string, 
  bookingTime: string, 
  settings: SystemSettings
): 'daytime' | 'afterhours' | 'weekend' {
  if (isWeekend(bookingDate)) {
    return 'weekend';
  }
  
  if (isAfterHours(bookingTime, settings)) {
    return 'afterhours';
  }
  
  return 'daytime';
}

export function getHourlyRate(rateType: string, settings: SystemSettings): number {
  switch (rateType) {
    case 'weekend':
      return settings.therapist_weekend_hourly_rate || settings.therapist_afterhours_hourly_rate;
    case 'afterhours':
      return settings.therapist_afterhours_hourly_rate;
    case 'daytime':
    default:
      return settings.therapist_daytime_hourly_rate;
  }
}

export async function calculateTherapistFee(
  bookingDate: string,
  bookingTime: string,
  totalDurationMinutes: number,
  therapistCount: number,
  serviceArrangement?: 'split' | 'multiply'
): Promise<FeeCalculationResult> {
  const settings = await getSystemSettings();
  
  // Calculate duration per therapist based on arrangement
  // Multiply: each therapist gets full duration; Split: divide
  const durationPerTherapist = (serviceArrangement === 'multiply')
    ? totalDurationMinutes
    : (totalDurationMinutes / Math.max(1, therapistCount));
  const hoursWorked = parseFloat((durationPerTherapist / 60).toFixed(2));
  
  // Determine rate type and hourly rate
  const rateType = determineRateType(bookingDate, bookingTime, settings);
  const hourlyRate = getHourlyRate(rateType, settings);
  
  // Calculate fee
  const therapistFee = parseFloat((hoursWorked * hourlyRate).toFixed(2));
  
  return {
    therapistFee,
    hourlyRate,
    hoursWorked,
    rateType
  };
}

// Utility function to clear settings cache (useful for testing or after settings updates)
export function clearSettingsCache(): void {
  cachedSettings = null;
  settingsLastFetched = 0;
}