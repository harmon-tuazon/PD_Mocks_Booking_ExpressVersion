/**
 * Date Utilities
 * Helper functions for parsing and formatting dates without timezone issues
 */

/**
 * Parse a date string without timezone conversion
 *
 * Supports multiple formats:
 * - YYYY-MM-DD (e.g., "2030-12-07")
 * - ISO 8601 with timestamp (e.g., "2026-04-30T00:00:00+00:00")
 *
 * Problem: new Date("2030-12-07") interprets as midnight UTC
 * In EST/PST: 2030-12-07 00:00 UTC = 2030-12-06 19:00/16:00 local → shows Dec 6
 *
 * Solution: Parse components manually to create date in local timezone
 *
 * @param {string} dateString - Date in YYYY-MM-DD or ISO 8601 format
 * @returns {Date} Date object in local timezone
 */
export const parseDateString = (dateString) => {
  if (!dateString) return null;

  try {
    // Handle ISO 8601 format with timestamp (e.g., "2026-04-30T00:00:00+00:00")
    // Extract just the date part before the 'T'
    const datePart = dateString.includes('T')
      ? dateString.split('T')[0]
      : dateString;

    // Split YYYY-MM-DD and parse as numbers
    const [year, month, day] = datePart.split('-').map(Number);

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
