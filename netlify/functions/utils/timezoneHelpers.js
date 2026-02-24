/**
 * Timezone helper utilities for Netlify functions
 * Converts UTC times to local timezone for display in emails/SMS
 */

/**
 * Format UTC time to local timezone string
 * @param {string|Date} utcTime - UTC timestamp from database
 * @param {string} timezone - IANA timezone (e.g., 'Australia/Brisbane')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted local time string
 */
function formatInTimezone(utcTime, timezone = 'Australia/Brisbane', options = {}) {
  if (!utcTime) return '';

  const defaultOptions = {
    timeZone: timezone,
    ...options
  };

  return new Date(utcTime).toLocaleString('en-AU', defaultOptions);
}

/**
 * Get formatted date in local timezone
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Formatted date (e.g., "Monday, 29 December 2025")
 */
function getLocalDate(utcTime, timezone = 'Australia/Brisbane') {
  return formatInTimezone(utcTime, timezone, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get formatted time in local timezone
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Formatted time (e.g., "10:00 AM")
 */
function getLocalTime(utcTime, timezone = 'Australia/Brisbane') {
  return formatInTimezone(utcTime, timezone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get short date format in local timezone
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Short date (e.g., "Dec 29")
 */
function getShortDate(utcTime, timezone = 'Australia/Brisbane') {
  return formatInTimezone(utcTime, timezone, {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get full date and time in local timezone
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Full datetime (e.g., "Mon, 29 Dec 2025, 10:00 AM")
 */
function getLocalDateTime(utcTime, timezone = 'Australia/Brisbane') {
  return formatInTimezone(utcTime, timezone, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get date and time as separate strings
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {{date: string, time: string}} Object with date and time strings
 */
function getDateAndTime(utcTime, timezone = 'Australia/Brisbane') {
  return {
    date: getLocalDate(utcTime, timezone),
    time: getLocalTime(utcTime, timezone)
  };
}

/**
 * Get day-of-week number in local timezone (0=Sunday, 1=Monday, ..., 6=Saturday)
 * CRITICAL: Must use this instead of Date.getDay() which returns UTC day
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {number} Day of week (0-6)
 */
function getLocalDayOfWeek(utcTime, timezone = 'Australia/Brisbane') {
  const date = new Date(utcTime);
  // Get the short weekday name in the local timezone
  const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
  const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return dayMap[dayStr];
}

/**
 * Get time-only string (HH:MM) in local timezone
 * CRITICAL: Must use this instead of Date.toTimeString() which returns UTC time
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Time in HH:MM format (e.g., "09:00")
 */
function getLocalTimeOnly(utcTime, timezone = 'Australia/Brisbane') {
  const date = new Date(utcTime);
  // Use 24-hour format to get HH:MM for comparison with therapist_availability
  const timeStr = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  });
  return timeStr; // Returns "09:00" format
}

/**
 * Get date-only string (YYYY-MM-DD) in local timezone
 * CRITICAL: Must use this instead of Date.toISOString().split('T')[0] which returns UTC date
 * @param {string|Date} utcTime - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @returns {string} Date in YYYY-MM-DD format
 */
function getLocalDateOnly(utcTime, timezone = 'Australia/Brisbane') {
  const date = new Date(utcTime);
  // en-CA locale outputs YYYY-MM-DD format
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

module.exports = {
  formatInTimezone,
  getLocalDate,
  getLocalTime,
  getShortDate,
  getLocalDateTime,
  getDateAndTime,
  getLocalDayOfWeek,
  getLocalTimeOnly,
  getLocalDateOnly
};
