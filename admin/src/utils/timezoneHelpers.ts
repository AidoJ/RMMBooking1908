import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Convert UTC time from database to local time in specified timezone
 * @param utcTime - UTC timestamp from database (e.g., "2025-12-29T00:00:00+00")
 * @param bookingTimezone - IANA timezone string (e.g., "Australia/Brisbane")
 * @param format - dayjs format string (default: 'HH:mm')
 * @returns Formatted local time string
 */
export function formatBookingTime(
  utcTime: string | Date,
  bookingTimezone: string,
  format: string = 'HH:mm'
): string {
  if (!utcTime) return '';
  if (!bookingTimezone) bookingTimezone = 'Australia/Brisbane'; // fallback

  return dayjs.utc(utcTime).tz(bookingTimezone).format(format);
}

/**
 * Convert UTC time to local Date object in specified timezone
 * @param utcTime - UTC timestamp from database
 * @param bookingTimezone - IANA timezone string
 * @returns dayjs object in local timezone
 */
export function getLocalBookingTime(
  utcTime: string | Date,
  bookingTimezone: string
): dayjs.Dayjs {
  if (!bookingTimezone) bookingTimezone = 'Australia/Brisbane'; // fallback

  return dayjs.utc(utcTime).tz(bookingTimezone);
}

/**
 * Format booking date and time for display
 * @param utcTime - UTC timestamp from database
 * @param bookingTimezone - IANA timezone string
 * @returns Object with formatted date and time
 */
export function formatBookingDateTime(
  utcTime: string | Date,
  bookingTimezone: string
): { date: string; time: string; datetime: string } {
  const local = getLocalBookingTime(utcTime, bookingTimezone);

  return {
    date: local.format('MMM DD, YYYY'),
    time: local.format('h:mm A'),
    datetime: local.format('MMM DD, YYYY h:mm A')
  };
}

/**
 * Get timezone offset display (e.g., "UTC+10")
 * @param bookingTimezone - IANA timezone string
 * @param date - Date to check for DST (optional, defaults to now)
 * @returns Timezone offset string
 */
export function getTimezoneDisplay(bookingTimezone: string, date?: Date): string {
  const d = date ? dayjs(date).tz(bookingTimezone) : dayjs().tz(bookingTimezone);
  const offset = d.format('Z'); // e.g., "+10:00"
  const hours = offset.substring(0, 3); // e.g., "+10"
  return `UTC${hours}`;
}

/**
 * List of Australian timezones for dropdown filters
 */
export const AUSTRALIAN_TIMEZONES = [
  { value: 'Australia/Brisbane', label: 'Brisbane (UTC+10)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (UTC+10/+11)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (UTC+9:30/+10:30)' },
  { value: 'Australia/Perth', label: 'Perth (UTC+8)' },
  { value: 'Australia/Darwin', label: 'Darwin (UTC+9:30)' },
  { value: 'Australia/Hobart', label: 'Hobart (UTC+10/+11)' },
];

/**
 * Detect Australian timezone from coordinates
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns IANA timezone string
 */
export function detectTimezoneFromCoords(lat?: number | null, lng?: number | null): string {
  if (!lat || !lng) {
    console.warn('⚠️ No coordinates provided for timezone detection, defaulting to Sydney');
    return 'Australia/Sydney';
  }

  // Western Australia (Perth - no DST)
  if (lng >= 112.5 && lng < 129) return 'Australia/Perth';

  // Northern Territory (Darwin - no DST)
  if (lat > -26 && lng >= 129 && lng < 138) return 'Australia/Darwin';

  // South Australia (Adelaide - has DST)
  if (lat <= -26 && lng >= 129 && lng < 141) return 'Australia/Adelaide';

  // Queensland (Brisbane - no DST)
  if (lat > -29 && lng >= 138 && lng < 154) return 'Australia/Brisbane';

  // Victoria (Melbourne - has DST)
  if (lat <= -34 && lng >= 141 && lng < 150) return 'Australia/Melbourne';

  // Tasmania (Hobart - has DST)
  if (lat <= -40) return 'Australia/Hobart';

  // NSW/ACT (Sydney - has DST) - default for eastern Australia
  if (lng >= 141) return 'Australia/Sydney';

  console.warn('⚠️ Could not determine timezone, defaulting to Sydney');
  return 'Australia/Sydney';
}

/**
 * Convert local date and time to UTC ISO string
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm or HH:mm:ss format
 * @param timezone - IANA timezone string (e.g., 'Australia/Brisbane')
 * @returns UTC ISO string for database storage
 */
export function convertLocalToUTC(date: string, time: string, timezone: string): string {
  if (!date || !time) {
    console.error('❌ Missing date or time for UTC conversion');
    return '';
  }

  // Ensure time has seconds
  let formattedTime = time;
  if (formattedTime.length === 5 && formattedTime.includes(':')) {
    formattedTime += ':00';
  }

  // Create local datetime string
  const localDateTimeStr = `${date}T${formattedTime}`;

  // Parse as local time in the specified timezone, then convert to UTC
  const localTime = dayjs.tz(localDateTimeStr, timezone);
  const utcTime = localTime.utc();

  console.log(`🕐 Converting: ${localDateTimeStr} (${timezone}) → ${utcTime.toISOString()} (UTC)`);

  return utcTime.toISOString();
}
