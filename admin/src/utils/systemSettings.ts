import { supabaseClient } from '../utility';

// Settings cache to reduce database queries
let settingsCache: { [key: string]: string } = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface SystemSettingValue {
  string: string;
  boolean: boolean;
  integer: number;
  decimal: number;
}

/**
 * Get a system setting value with type safety
 */
export async function getSystemSetting<T extends keyof SystemSettingValue>(
  key: string,
  dataType: T,
  defaultValue?: SystemSettingValue[T]
): Promise<SystemSettingValue[T]> {
  try {
    // Check cache first
    const now = Date.now();
    if (settingsCache[key] && (now - cacheTimestamp) < CACHE_DURATION) {
      return parseSettingValue(settingsCache[key], dataType) as SystemSettingValue[T];
    }

    // Fetch from database
    const { data, error } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`System setting '${key}' not found`);
    }

    // Update cache
    settingsCache[key] = data.value;
    cacheTimestamp = now;

    return parseSettingValue(data.value, dataType) as SystemSettingValue[T];
  } catch (error) {
    console.error(`Error fetching system setting '${key}':`, error);
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Get multiple system settings at once
 */
export async function getSystemSettings(keys: string[]): Promise<{ [key: string]: string }> {
  try {
    const { data, error } = await supabaseClient
      .from('system_settings')
      .select('key, value')
      .in('key', keys);

    if (error) throw error;

    const settings: { [key: string]: string } = {};
    data?.forEach(setting => {
      settings[setting.key] = setting.value;
      settingsCache[setting.key] = setting.value;
    });

    cacheTimestamp = Date.now();
    return settings;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    throw error;
  }
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(key: string, value: string): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('system_settings')
      .update({
        value,
        updated_at: new Date().toISOString()
      })
      .eq('key', key);

    if (error) throw error;

    // Update cache
    settingsCache[key] = value;
    cacheTimestamp = Date.now();
  } catch (error) {
    console.error(`Error updating system setting '${key}':`, error);
    throw error;
  }
}

/**
 * Clear the settings cache (useful after bulk updates)
 */
export function clearSettingsCache(): void {
  settingsCache = {};
  cacheTimestamp = 0;
}

/**
 * Parse setting value based on data type
 */
function parseSettingValue(value: string, dataType: keyof SystemSettingValue): any {
  if (!value) return getDefaultValue(dataType);
  
  switch (dataType) {
    case 'boolean':
      return value === 'true';
    case 'integer':
      return parseInt(value) || 0;
    case 'decimal':
      return parseFloat(value) || 0;
    case 'string':
    default:
      return value;
  }
}

/**
 * Get default value for data type
 */
function getDefaultValue(dataType: keyof SystemSettingValue): any {
  switch (dataType) {
    case 'boolean':
      return false;
    case 'integer':
    case 'decimal':
      return 0;
    case 'string':
    default:
      return '';
  }
}

/**
 * Feature flag helper
 */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  try {
    return await getSystemSetting(featureKey, 'boolean', false);
  } catch (error) {
    console.error(`Error checking feature flag '${featureKey}':`, error);
    return false;
  }
}

/**
 * Common system settings with defaults
 */
export const SYSTEM_SETTINGS = {
  // Business
  COMPANY_NAME: 'company_name',
  COMPANY_EMAIL: 'company_email',
  COMPANY_PHONE: 'company_phone',
  BUSINESS_TIMEZONE: 'business_timezone',
  DEFAULT_CURRENCY: 'default_currency',

  // Pricing
  GLOBAL_SERVICE_BASE_PRICE: 'global_service_base_price',
  PLATFORM_COMMISSION_RATE: 'platform_commission_rate',
  PAYMENT_PROCESSING_FEE: 'payment_processing_fee',
  GST_RATE: 'gst_rate',
  LATE_CANCELLATION_FEE: 'late_cancellation_fee',

  // Booking Rules
  MAX_BOOKING_ADVANCE_DAYS: 'max_booking_advance_days',
  MIN_CANCELLATION_HOURS: 'min_cancellation_hours',
  AUTO_CONFIRM_BOOKINGS: 'auto_confirm_bookings',
  REQUIRE_PAYMENT_AUTHORIZATION: 'require_payment_authorization',
  MAX_DAILY_BOOKINGS_PER_THERAPIST: 'max_daily_bookings_per_therapist',
  THERAPIST_RESPONSE_TIMEOUT_MINUTES: 'therapist_response_timeout_minutes',

  // Operations
  DEFAULT_SERVICE_RADIUS_KM: 'default_service_radius_km',
  MAX_SERVICE_RADIUS_KM: 'max_service_radius_km',
  TRAVEL_TIME_BUFFER_MINUTES: 'travel_time_buffer_minutes',
  SETUP_CLEANUP_TIME_MINUTES: 'setup_cleanup_time_minutes',
  MINIMUM_BOOKING_DURATION: 'minimum_booking_duration',

  // Communications
  SMS_NOTIFICATIONS_ENABLED: 'sms_notifications_enabled',
  EMAIL_NOTIFICATIONS_ENABLED: 'email_notifications_enabled',
  BOOKING_CONFIRMATION_TIMEOUT_HOURS: 'booking_confirmation_timeout_hours',
  REMINDER_SMS_HOURS_BEFORE: 'reminder_sms_hours_before',

  // Feature Flags
  ENABLE_GUEST_BOOKINGS: 'enable_guest_bookings',
  ENABLE_ONLINE_PAYMENTS: 'enable_online_payments',
  ENABLE_SMS_CONFIRMATIONS: 'enable_sms_confirmations',
  ENABLE_THERAPIST_RATINGS: 'enable_therapist_ratings',
  ENABLE_AUTOMATIC_MATCHING: 'enable_automatic_matching',
  ENABLE_WEEKEND_BOOKINGS: 'enable_weekend_bookings',
  ENABLE_THERAPIST_SELECTION: 'enable_therapist_selection',
  ENABLE_ADDRESS_GEOCODING: 'enable_address_geocoding',
};

/**
 * Integration settings keys (sensitive)
 */
export const INTEGRATION_SETTINGS = {
  STRIPE_PUBLISHABLE_KEY: 'stripe_publishable_key',
  STRIPE_SECRET_KEY: 'stripe_secret_key',
  TWILIO_ACCOUNT_SID: 'twilio_account_sid',
  TWILIO_AUTH_TOKEN: 'twilio_auth_token',
  TWILIO_PHONE_NUMBER: 'twilio_phone_number',
  GOOGLE_MAPS_API_KEY: 'google_maps_api_key',
  EMAILJS_SERVICE_ID: 'emailjs_service_id',
  EMAILJS_TEMPLATE_ID: 'emailjs_template_id',
  EMAILJS_PUBLIC_KEY: 'emailjs_public_key',
};