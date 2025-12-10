import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiRefreshCw, FiX } from 'react-icons/fi';

const RebookPromptModal = ({ isOpen, booking, onClose, onRebook, isProcessing}) => {
  const modalRef = useRef(null);
  const yesButtonRef = useRef(null);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Set focus to primary button when modal opens
      setTimeout(() => {
        yesButtonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen || !booking) return null;

  const examType = booking.mock_type || 'Mock Exam';
  const examDate = booking.exam_date || booking.examDate;

  const handleYesClick = () => {
    onRebook(booking.mock_type);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      let date;

      // Handle different date formats that HubSpot might return
      if (typeof dateString === 'string' && dateString.includes('T')) {
        // ISO format like "2025-09-26T00:00:00.000Z"
        date = new Date(dateString);
      } else if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD format - parse as local date to avoid timezone shift
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        // Try direct parsing
        date = new Date(dateString);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return dateString;
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'input:', dateString);
      return dateString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="rebook-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay with backdrop blur */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-20 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center alignment trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full"
        >
          {/* Header */}
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <FiRefreshCw className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="rebook-modal-title">
                  Rebook for a New Time?
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You're about to reschedule your <span className="font-semibold">{examType}</span> booking
                    {examDate && <> for <span className="font-semibold">{formatDate(examDate)}</span></>}.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Would you like to book a new timeslot?
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                onClick={onClose}
                aria-label="Close rebook modal"
                disabled={isProcessing}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-bg px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
            <button
                type="button"
                ref={yesButtonRef}
                onClick={handleYesClick}
                disabled={isProcessing}
                className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:text-sm transition-colors duration-200"
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Yes, Find New Time'
                )}
              </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

RebookPromptModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  booking: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    booking_id: PropTypes.string,
    mock_type: PropTypes.string,
    exam_date: PropTypes.string,
    examDate: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onRebook: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool

};

RebookPromptModal.defaultProps = {
  booking: null,
  isProcessing: false

};

export default RebookPromptModal;
