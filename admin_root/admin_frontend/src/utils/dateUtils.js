/**
 * Date Utilities
 * Helper functions for parsing and formatting dates without timezone issues
 */

/**
 * Parse a YYYY-MM-DD date string without timezone conversion
 *
 * Problem: new Date("2030-12-07") interprets as midnight UTC
 * In EST/PST: 2030-12-07 00:00 UTC = 2030-12-06 19:00/16:00 local → shows Dec 6
 *
 * Solution: Parse components manually to create date in local timezone
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Date} Date object in local timezone
 */
export const parseDateString = (dateString) => {
  if (!dateString) return null;

  try {
    // Split YYYY-MM-DD and parse as numbers
    const [year, month, day] = dateString.split('-').map(Number);

    // Create date in local timezone (month is 0-indexed)
    // This avoids the UTC midnight issue
    return new Date(year, month - 1, day);
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
};

/**
 * Format a date string for display (long format)
 * Example: "Saturday, December 7, 2030"
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export const formatDateLong = (dateString) => {
  if (!dateString) return 'N/A';

  const date = parseDateString(dateString);
  if (!date || isNaN(date.getTime())) {
    return dateString; // Return original if parsing fails
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format a date string for display (short format)
 * Example: "Dec 7, 2030"
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';

  const date = parseDateString(dateString);
  if (!date || isNaN(date.getTime())) {
    return dateString; // Return original if parsing fails
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format a date string using date-fns format
 * Example: format with 'EEEE, MMMM d, yyyy' → "Saturday, December 7, 2030"
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} formatStr - date-fns format string
 * @returns {string} Formatted date string
 */
export const formatDateWithDateFns = (dateString, formatStr) => {
  if (!dateString) return 'N/A';

  const date = parseDateString(dateString);
  if (!date || isNaN(date.getTime())) {
    return dateString; // Return original if parsing fails
  }

  // Dynamic import to avoid loading date-fns if not needed
  const { format } = require('date-fns');
  return format(date, formatStr);
};
