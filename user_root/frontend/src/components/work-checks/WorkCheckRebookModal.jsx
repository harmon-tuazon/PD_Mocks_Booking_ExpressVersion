/**
 * WorkCheckRebookModal.jsx
 * Modal that prompts user to book another work check after cancellation
 */
import React from 'react';

const WorkCheckRebookModal = ({ isOpen, booking, onClose, onRebook, isProcessing = false }) => {
  if (!isOpen) return null;

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'the scheduled date';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-headline font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
            Work Check Cancelled
          </h3>

          {/* Booking Details */}
          {booking && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-hover rounded-lg text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDate(booking.slot_date)}
              </p>
              {booking.slot_time && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatTime(booking.slot_time)} - {formatTime(booking.end_time)}
                </p>
              )}
              {booking.instructor_name && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  with {booking.instructor_name}
                </p>
              )}
            </div>
          )}

          {/* Message */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6 font-body">
            Would you like to book another work check session?
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Maybe Later
            </button>
            <button
              onClick={onRebook}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  Book Another
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkCheckRebookModal;
