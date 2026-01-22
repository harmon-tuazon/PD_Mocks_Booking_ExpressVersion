/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions to ensure consistency across the app
 * and avoid timezone-related bugs when working with YYYY-MM-DD format
 */

/**
 * Format a YYYY-MM-DD date string for display
 * Uses local timezone to avoid off-by-one day errors
 *
 * @param {string|Date|null} dateValue - YYYY-MM-DD string, Date object, or null
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDisplayDate = (dateValue, options = {}) => {
  if (!dateValue) return 'Not set';

  try {
    let date;

    if (typeof dateValue === 'string') {
      // Parse YYYY-MM-DD string in local timezone to avoid off-by-one errors
      const [year, month, day] = dateValue.split('T')[0].split('-').map(Number);
      if (!year || !month || !day) {
        return dateValue; // Return original if parsing fails
      }
      date = new Date(year, month - 1, day);
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return String(dateValue);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateValue;
    }

    // Default options for full date display
    const defaultOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(dateValue);
  }
};

/**
 * Format a YYYY-MM-DD date string for short display (e.g., "Jan 15, 2025")
 *
 * @param {string|Date|null} dateValue - YYYY-MM-DD string, Date object, or null
 * @returns {string} Short formatted date string
 */
export const formatShortDate = (dateValue) => {
  return formatDisplayDate(dateValue, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Convert a Date object or date string to YYYY-MM-DD format
 *
 * @param {Date|string} date - Date object or date string
 * @returns {string} YYYY-MM-DD formatted string
 */
export const toISODateString = (date) => {
  if (!date) return '';

  try {
    let dateObj;

    if (typeof date === 'string') {
      // If already in YYYY-MM-DD format, return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }

    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error converting to ISO date string:', error);
    return '';
  }
};

/**
 * Check if a date string is in valid YYYY-MM-DD format
 *
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid YYYY-MM-DD format
 */
export const isValidISODateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;

  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(dateString)) return false;

  // Verify it's a real date
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
};
