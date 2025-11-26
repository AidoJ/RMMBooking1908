// Timezone Helper - Detect Australian timezone from coordinates
// Used for booking and quote forms

/**
 * Detect Australian timezone from latitude/longitude coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - Timezone string (e.g., 'Australia/Melbourne')
 */
export function detectTimezoneFromCoords(lat, lng) {
  if (!lat || !lng) {
    console.warn('⚠️ No coordinates provided for timezone detection');
    return 'Australia/Sydney'; // Default fallback
  }

  // Australian timezone boundaries (approximate)
  // Based on state borders and timezone rules

  // Western Australia (Perth timezone - no DST)
  if (lng >= 112.5 && lng < 129) {
    return 'Australia/Perth';
  }

  // Northern Territory (Darwin timezone - no DST)
  // NT is roughly north of -26° latitude
  if (lat > -26 && lng >= 129 && lng < 138) {
    return 'Australia/Darwin';
  }

  // South Australia (Adelaide timezone - has DST)
  // SA is roughly between 129°E and 141°E, south of -26°
  if (lat <= -26 && lng >= 129 && lng < 141) {
    return 'Australia/Adelaide';
  }

  // Queensland (Brisbane timezone - no DST)
  // QLD is roughly between 138°E and 154°E, north of NSW border (~-29°)
  if (lat > -29 && lng >= 138 && lng < 154) {
    return 'Australia/Brisbane';
  }

  // Victoria (Melbourne timezone - has DST)
  // VIC is roughly south of -34° and between 141°E and 150°E
  if (lat <= -34 && lng >= 141 && lng < 150) {
    return 'Australia/Melbourne';
  }

  // Tasmania (Hobart timezone - has DST, same as Melbourne)
  // TAS is roughly south of -40°
  if (lat <= -40) {
    return 'Australia/Hobart';
  }

  // New South Wales / ACT (Sydney timezone - has DST)
  // Default for eastern Australia
  if (lng >= 141) {
    return 'Australia/Sydney';
  }

  // Default fallback
  console.warn('⚠️ Could not determine timezone from coordinates, defaulting to Sydney');
  return 'Australia/Sydney';
}

/**
 * Get timezone display name
 * @param {string} timezone - Timezone string (e.g., 'Australia/Melbourne')
 * @returns {string} - Human-readable timezone name
 */
export function getTimezoneDisplayName(timezone) {
  const timezoneNames = {
    'Australia/Perth': 'Perth (AWST, UTC+8, no DST)',
    'Australia/Adelaide': 'Adelaide (ACST/ACDT, UTC+9:30/+10:30)',
    'Australia/Darwin': 'Darwin (ACST, UTC+9:30, no DST)',
    'Australia/Brisbane': 'Brisbane (AEST, UTC+10, no DST)',
    'Australia/Sydney': 'Sydney (AEST/AEDT, UTC+10/+11)',
    'Australia/Melbourne': 'Melbourne (AEST/AEDT, UTC+10/+11)',
    'Australia/Hobart': 'Hobart (AEST/AEDT, UTC+10/+11)'
  };

  return timezoneNames[timezone] || timezone;
}

/**
 * Get timezone abbreviation (considers current date for DST)
 * @param {string} timezone - Timezone string
 * @param {Date} date - Date to check (defaults to now)
 * @returns {string} - Timezone abbreviation (e.g., 'AEDT' or 'AEST')
 */
export function getTimezoneAbbreviation(timezone, date = new Date()) {
  // Simple DST check for Australian timezones
  // DST runs from first Sunday in October to first Sunday in April
  const month = date.getMonth(); // 0-11

  // October (9) to March (2) is summer in Australia (DST period for relevant zones)
  const isDST = month >= 9 || month <= 2;

  const abbreviations = {
    'Australia/Perth': 'AWST', // No DST
    'Australia/Darwin': 'ACST', // No DST
    'Australia/Brisbane': 'AEST', // No DST
    'Australia/Adelaide': isDST ? 'ACDT' : 'ACST',
    'Australia/Sydney': isDST ? 'AEDT' : 'AEST',
    'Australia/Melbourne': isDST ? 'AEDT' : 'AEST',
    'Australia/Hobart': isDST ? 'AEDT' : 'AEST'
  };

  return abbreviations[timezone] || '';
}

/**
 * Display timezone notification to user
 * @param {string} timezone - Detected timezone
 * @param {HTMLElement} container - Element to display notification in
 */
export function showTimezoneNotification(timezone, container) {
  if (!container) return;

  const displayName = getTimezoneDisplayName(timezone);
  const abbreviation = getTimezoneAbbreviation(timezone);

  container.innerHTML = `
    <div style="
      background-color: #e6f7ff;
      border: 1px solid #91d5ff;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <span style="font-size: 18px;">🕐</span>
      <div>
        <strong>Timezone Detected:</strong> ${displayName}
        <br>
        <small style="color: #666;">All times will be interpreted as ${abbreviation}</small>
      </div>
    </div>
  `;
}

// Log when module loads
console.log('✅ Timezone helper module loaded');
