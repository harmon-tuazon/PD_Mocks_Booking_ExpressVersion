/**
 * Time conflict detection utilities for booking system
 * Prevents overlapping bookings across all mock exam types
 */

/**
 * Check if two time ranges overlap
 * @param {string} start1 - ISO 8601 start time of range 1
 * @param {string} end1 - ISO 8601 end time of range 1
 * @param {string} start2 - ISO 8601 start time of range 2
 * @param {string} end2 - ISO 8601 end time of range 2
 * @returns {boolean} - True if ranges overlap
 */
export const checkTimeOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) {
    return false;
  }

  const start1Date = new Date(start1);
  const end1Date = new Date(end1);
  const start2Date = new Date(start2);
  const end2Date = new Date(end2);

  // Check for invalid dates
  if (isNaN(start1Date.getTime()) || isNaN(end1Date.getTime()) ||
      isNaN(start2Date.getTime()) || isNaN(end2Date.getTime())) {
    console.warn('Invalid date(s) provided to checkTimeOverlap:', {
      start1, end1, start2, end2
    });
    return false;
  }

  // Overlap occurs if: (start1 < end2) AND (end1 > start2)
  return start1Date < end2Date && end1Date > start2Date;
};

/**
 * Find conflicting bookings for a new session
 * @param {Array} existingBookings - User's current bookings
 * @param {Object} newSession - New session being booked
 * @returns {Array} - Array of conflicting bookings
 */
export const findConflictingBookings = (existingBookings, newSession) => {
  if (!existingBookings || !Array.isArray(existingBookings) || !newSession) {
    return [];
  }

  // Ensure the new session has the required time fields
  if (!newSession.start_time || !newSession.end_time) {
    console.warn('New session missing start_time or end_time:', newSession);
    return [];
  }

  return existingBookings.filter(booking => {
    // Only check active bookings (exclude cancelled, completed, failed)
    const isActive = booking.is_active;

    // Check various representations of active status
    const isActiveBooking =
      isActive === 'Active' ||
      isActive === 'active' ||
      isActive === 'Scheduled' ||
      isActive === 'scheduled';

    if (!isActiveBooking) {
      return false;
    }

    // Get time fields from booking
    const bookingStartTime = booking.start_time;
    const bookingEndTime = booking.end_time;

    // Check if bookings have required time data
    if (!bookingStartTime || !bookingEndTime) {
      console.warn('Booking missing time data:', {
        id: booking.id,
        booking_id: booking.booking_id,
        has_start: !!bookingStartTime,
        has_end: !!bookingEndTime
      });
      return false;
    }

    // Check for time overlap
    const hasOverlap = checkTimeOverlap(
      newSession.start_time,
      newSession.end_time,
      bookingStartTime,
      bookingEndTime
    );

    if (hasOverlap) {
      console.log('Time conflict detected:', {
        newSession: {
          type: newSession.mock_type,
          start: newSession.start_time,
          end: newSession.end_time
        },
        existingBooking: {
          type: booking.mock_type,
          start: bookingStartTime,
          end: bookingEndTime,
          id: booking.booking_id || booking.id
        }
      });
    }

    return hasOverlap;
  });
};

/**
 * Format conflict details for user display
 * @param {Object} conflictingBooking - The conflicting booking
 * @returns {string} - Formatted conflict message
 */
export const formatConflictMessage = (conflictingBooking) => {
  if (!conflictingBooking) {
    return 'Conflicting booking';
  }

  // Get dates and times from booking
  const examDate = conflictingBooking.exam_date || conflictingBooking.start_time;
  const startTime = conflictingBooking.start_time;
  const endTime = conflictingBooking.end_time;
  const mockType = conflictingBooking.mock_type || 'Mock Exam';
  const location = conflictingBooking.location || 'Mississauga';

  // Format date - FIX: Parse ISO date string as local date to avoid timezone shift
  let dateStr = 'Unknown Date';
  if (examDate) {
    try {
      let date;
      // If examDate is in ISO format (YYYY-MM-DD), parse it as local date
      if (typeof examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
        const [year, month, day] = examDate.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        date = new Date(examDate);
      }

      if (!isNaN(date.getTime())) {
        dateStr = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
  }

  // Format times
  let timeStr = '';
  if (startTime && endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const startTimeStr = start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const endTimeStr = end.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        timeStr = ` at ${startTimeStr} - ${endTimeStr}`;
      }
    } catch (e) {
      console.error('Error formatting time:', e);
    }
  }

  // Build the complete message
  return `${mockType} on ${dateStr}${timeStr} (${location})`;
};;

/**
 * Get a summary message for multiple conflicts
 * @param {Array} conflicts - Array of conflicting bookings
 * @returns {string} - Summary message
 */
export const getConflictSummary = (conflicts) => {
  if (!conflicts || conflicts.length === 0) {
    return '';
  }

  if (conflicts.length === 1) {
    return 'You have 1 conflicting booking at this time.';
  }

  return `You have ${conflicts.length} conflicting bookings at this time.`;
};

/**
 * Check if a booking can be modified (not completed or in the past)
 * @param {Object} booking - The booking to check
 * @returns {boolean} - True if booking can be modified
 */
export const canModifyBooking = (booking) => {
  if (!booking) return false;

  // Check if booking is cancelled or completed
  const status = booking.is_active;
  if (status === 'Cancelled' || status === 'Completed' || status === 'Failed') {
    return false;
  }

  // Check if booking is in the past
  const examDate = booking.exam_date;
  if (examDate) {
    const bookingDate = new Date(examDate);
    const now = new Date();
    if (bookingDate < now) {
      return false;
    }
  }

  return true;
};