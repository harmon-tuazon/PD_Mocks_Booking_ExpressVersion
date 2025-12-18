/**
 * Prerequisite Validation Helpers
 * Client-side utilities for checking Mock Discussion prerequisite requirements
 */

/**
 * Check if user meets prerequisite requirements for a Mock Discussion
 *
 * Validation Logic (OR relationship):
 * User can book if they have attended AT LEAST ONE prerequisite exam with:
 * - booking.attendance === "Yes"
 * - booking.is_active === "Active" OR "Completed"
 *
 * @param {Array<string>} prerequisiteExamIds - Array of prerequisite exam IDs from mock exam
 * @param {Array<Object>} userBookings - Array of user's bookings with mock_exam_id populated
 * @returns {boolean} - True if user can book, false if prerequisites not met
 */
export const checkPrerequisites = (prerequisiteExamIds, userBookings) => {
  // No prerequisites = always allowed
  if (!prerequisiteExamIds || prerequisiteExamIds.length === 0) {
    return true;
  }

  // No bookings = cannot meet prerequisites
  if (!userBookings || userBookings.length === 0) {
    return false;
  }

  // Check if user has an active booking for ANY of the prerequisite exams
  // Note: Attendance check removed - having an active booking is sufficient
  return prerequisiteExamIds.some(prereqId =>
    userBookings.some(booking =>
      booking.mock_exam_id === prereqId &&
      (booking.is_active === 'Active' || booking.is_active === 'Completed')
    )
  );
};;

/**
 * Get list of prerequisite exams that the user has NOT completed
 *
 * @param {Array<string>} prerequisiteExamIds - Array of prerequisite exam IDs
 * @param {Array<Object>} userBookings - Array of user's bookings
 * @param {Array<Object>} allMockExams - Array of all mock exams to get details
 * @returns {Array<Object>} - Array of prerequisite exams the user hasn't completed
 */
export const getMissingPrerequisites = (prerequisiteExamIds, userBookings, allMockExams) => {
  if (!prerequisiteExamIds || prerequisiteExamIds.length === 0) {
    return [];
  }

  const completedPrereqIds = new Set();

  // Find which prerequisites the user HAS booked (active booking is sufficient)
  // Note: Attendance check removed - having an active booking is sufficient
  if (userBookings && userBookings.length > 0) {
    prerequisiteExamIds.forEach(prereqId => {
      const hasBooked = userBookings.some(booking =>
        booking.mock_exam_id === prereqId &&
        (booking.is_active === 'Active' || booking.is_active === 'Completed')
      );

      if (hasBooked) {
        completedPrereqIds.add(prereqId);
      }
    });
  }

  // Return details of missing prerequisites
  if (!allMockExams) {
    return prerequisiteExamIds
      .filter(id => !completedPrereqIds.has(id))
      .map(id => ({ id, mock_exam_id: id }));
  }

  return prerequisiteExamIds
    .filter(id => !completedPrereqIds.has(id))
    .map(prereqId => {
      const exam = allMockExams.find(e => e.mock_exam_id === prereqId || e.id === prereqId);
      return exam || { id: prereqId, mock_exam_id: prereqId };
    });
};;

/**
 * Format prerequisite exam for display
 *
 * @param {Object} prereqExam - Prerequisite exam object
 * @returns {string} - Formatted string for display
 */
export const formatPrerequisiteDisplay = (prereqExam) => {
  if (!prereqExam) return 'Unknown Exam';

  const type = prereqExam.mock_type || 'Mock Exam';
  const date = prereqExam.exam_date || 'Date TBD';
  const location = prereqExam.location || '';

  if (location) {
    return `${type} - ${date} (${location})`;
  }

  return `${type} - ${date}`;
};
