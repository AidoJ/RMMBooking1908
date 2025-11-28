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

module.exports = {
  formatInTimezone,
  getLocalDate,
  getLocalTime,
  getShortDate,
  getLocalDateTime,
  getDateAndTime
};
