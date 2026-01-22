import React from 'react';
import { formatConflictMessage } from '../../utils/timeConflictUtils';

/**
 * Modal component to display time conflict warnings when a user attempts
 * to book a session that overlaps with an existing booking.
 *
 * @param {Array} conflicts - Array of conflicting bookings
 * @param {Function} onViewBookings - Handler to navigate to bookings page
 * @param {Function} onChooseDifferent - Handler to go back and choose different session
 * @param {Function} onClose - Handler to close the modal
 */
const TimeConflictWarning = ({ conflicts, onViewBookings, onChooseDifferent, onClose }) => {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Warning Icon - Orange theme to indicate warning */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
          <svg
            className="w-6 h-6 text-orange-600 dark:text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">
          Time Conflict Detected
        </h3>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
          You already have a booking at this time:
        </p>

        {/* Conflict Details */}
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          {conflicts.map((conflict, index) => (
            <div key={index} className="flex items-start mb-2 last:mb-0">
              <span className="text-orange-600 dark:text-orange-400 mr-2">•</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatConflictMessage(conflict)}
                </p>
                {conflict.location && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Location: {conflict.location}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          You cannot book overlapping sessions. Please cancel your existing booking or choose a different time.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {/* Primary action - View bookings */}
          <button
            onClick={onViewBookings}
            className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-card"
            aria-label="View my bookings"
          >
            View My Bookings
          </button>

          {/* Secondary action - Choose different session */}
          <button
            onClick={onChooseDifferent}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-dark-card"
            aria-label="Choose different session"
          >
            Choose Different Session
          </button>

          {/* Tertiary action - Close modal */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm focus:outline-none"
            aria-label="Close warning"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeConflictWarning;