/**
 * Date/Time Utilities for Toronto/UTC conversion
 * Handles conversion between local Toronto time and UTC for scheduling
 */

/**
 * Convert a datetime-local input value (Toronto time) to UTC ISO string
 * @param {string} localDateTime - DateTime string from datetime-local input (YYYY-MM-DDTHH:mm)
 * @returns {string} UTC ISO string for backend
 *
 * Note: Since the user's browser is likely in Toronto timezone, we can use a simpler approach
 * that treats the datetime-local value as local time and converts to UTC.
 * For production, consider using a library like date-fns-tz for more robust timezone handling.
 */
export const convertTorontoToUTC = (localDateTime) => {
  if (!localDateTime) return null;

  // The datetime-local input gives us a string in the format: YYYY-MM-DDTHH:mm
  // Since most users are in Toronto, we'll treat this as local time

  // Add seconds if missing for proper ISO format
  const dateTimeWithSeconds = localDateTime.length === 16
    ? localDateTime + ':00'
    : localDateTime;

  // Create a date object from the input
  // This assumes the browser is in Toronto timezone
  const localDate = new Date(dateTimeWithSeconds);

  // Return ISO string which will be in UTC
  return localDate.toISOString();
};

/**
 * Convert a UTC ISO string to Toronto datetime-local format
 * @param {string} utcDateTime - UTC ISO string from backend
 * @returns {string} DateTime string for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export const convertUTCToToronto = (utcDateTime) => {
  if (!utcDateTime) return '';

  const date = new Date(utcDateTime);

  // Convert to Toronto timezone
  const torontoString = date.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Parse the Toronto string to get components
  const [datePart, timePart] = torontoString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute] = timePart.split(':');

  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

/**
 * Format a datetime for display in Toronto timezone
 * @param {string} dateTime - DateTime string (either local or UTC)
 * @returns {string} Formatted string like "Jan 20, 2025 at 9:00 AM EST"
 */
export const formatTorontoDateTime = (dateTime) => {
  if (!dateTime) return '';

  // Handle datetime-local format (no timezone info)
  let date;
  if (dateTime.includes('Z') || dateTime.includes('+') || dateTime.includes('-')) {
    // Has timezone info, parse as-is
    date = new Date(dateTime);
  } else {
    // No timezone info, assume it's already in local time
    // Just parse it for display
    date = new Date(dateTime + ':00'); // Add seconds if missing
  }

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  // Format for display in Toronto timezone
  const options = {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  const formatted = date.toLocaleString('en-US', options);

  // Add timezone abbreviation
  const isDST = isDaylightSavingTime(date);
  const timezone = isDST ? 'EDT' : 'EST';

  return `${formatted} ${timezone}`;
};

/**
 * Check if a date is in daylight saving time for Toronto
 * @param {Date} date - Date object to check
 * @returns {boolean} True if in DST, false otherwise
 */
const isDaylightSavingTime = (date) => {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);

  const janOffset = jan.getTimezoneOffset();
  const julOffset = jul.getTimezoneOffset();

  const stdOffset = Math.max(janOffset, julOffset);

  return date.getTimezoneOffset() < stdOffset;
};

/**
 * Get minimum datetime for datetime-local input (current time in Toronto)
 * @returns {string} DateTime string for min attribute (YYYY-MM-DDTHH:mm)
 */
export const getMinScheduleDateTime = () => {
  const now = new Date();

  // Add 1 minute to ensure we're in the future
  now.setMinutes(now.getMinutes() + 1);

  // Convert to Toronto timezone for datetime-local input
  const torontoString = now.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Parse and format for datetime-local
  const [datePart, timePart] = torontoString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute] = timePart.split(':');

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};