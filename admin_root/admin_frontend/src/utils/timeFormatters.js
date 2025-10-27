/**
 * Time Formatting Utilities
 * Matches the production implementation from user_root/frontend/src/services/api.js
 *
 * These formatters accept:
 * - Unix timestamps (milliseconds) - normal case from HubSpot
 * - ISO date strings - fallback case
 *
 * JavaScript's Date constructor handles both formats automatically.
 */

/**
 * Format a timestamp or date string to localized time
 * @param {number|string} dateString - Unix timestamp (ms) or ISO string
 * @returns {string} Formatted time like "8:00 AM"
 */
export const formatTime = (dateString) => {
  if (!dateString) return '';

  // Handle UTC timestamps properly
  const date = new Date(dateString);

  // Convert UTC to local time for display
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
    // Use user's local timezone instead of hardcoded Toronto
  });
};

/**
 * Format time range for exam sessions (start_time - end_time)
 * @param {Object} exam - Exam object with start_time and end_time
 * @returns {string} Formatted range like "8:00 AM - 9:00 AM"
 */
export const formatTimeRange = (exam) => {
  if (!exam) return '';

  // If we have start_time and end_time, use them
  if (exam.start_time && exam.end_time) {
    const startTime = formatTime(exam.start_time);
    const endTime = formatTime(exam.end_time);
    return `${startTime} - ${endTime}`;
  }

  // Fallback: if we only have exam_date, create a reasonable time range
  if (exam.exam_date) {
    // For YYYY-MM-DD format, append a time to avoid timezone issues
    const dateStr = exam.exam_date.includes('T') ? exam.exam_date : `${exam.exam_date}T09:00:00`;
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // Add 3 hours

    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);
    return `${startTime} - ${endTime}`;
  }

  return 'Time TBD';
};
