import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiCalendar, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';

/**
 * NDECC Exam Date Edit Modal
 *
 * Allows users to set or update their NDECC exam date
 * - Date picker input
 * - Current date display
 * - Save and Cancel actions
 * - Loading states
 * - Success/error feedback
 */
const NDECCExamDateModal = ({
  isOpen,
  currentDate,
  onSave,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const modalRef = useRef(null);
  const dateInputRef = useRef(null);

  // Initialize date from currentDate when modal opens
  useEffect(() => {
    if (isOpen && currentDate) {
      // If currentDate is a Date object or string, format it to YYYY-MM-DD
      const dateStr = typeof currentDate === 'string'
        ? currentDate.split('T')[0] // Handle ISO string
        : currentDate instanceof Date
          ? currentDate.toISOString().split('T')[0]
          : '';
      setSelectedDate(dateStr);
    } else if (isOpen) {
      setSelectedDate('');
    }

    // Reset states when modal opens/closes
    if (isOpen) {
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, currentDate]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Set focus to date input when modal opens
      setTimeout(() => {
        dateInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isLoading, onClose]);

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

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Handle save
  const handleSave = async () => {
    // Validate date is selected
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    // Validate date is not in the past
    const selected = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected < today) {
      setError('Please select a future date');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(selectedDate);
      setSuccess(true);

      // Close modal after short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to save exam date. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setError(null);
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay with backdrop blur */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-20 dark:bg-opacity-40 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={isLoading ? undefined : onClose}
        ></div>

        {/* This element is to trick the browser into centering the modal contents */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-dark-border"
        >
          {/* Header */}
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <FiCalendar className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3
                  className="text-lg leading-6 font-headline font-semibold text-gray-900 dark:text-gray-100"
                  id="modal-title"
                >
                  Set NDECC Exam Date
                </h3>
                <div className="mt-2">
                  <p className="text-sm font-body text-gray-600 dark:text-gray-400">
                    Enter your scheduled NDECC exam date to help us provide personalized recommendations.
                  </p>
                </div>

                {/* Current Date Display */}
                {currentDate && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Current exam date
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {formatDisplayDate(currentDate)}
                    </p>
                  </div>
                )}

                {/* Date Picker */}
                <div className="mt-4">
                  <label
                    htmlFor="ndecc-exam-date"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {currentDate ? 'New exam date' : 'Select exam date'}
                  </label>
                  <input
                    ref={dateInputRef}
                    type="date"
                    id="ndecc-exam-date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    disabled={isLoading || success}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-dark-bg text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors duration-200"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                    <div className="flex items-start gap-2">
                      <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex items-start gap-2">
                      <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Exam date saved successfully!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Close button (X) */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={isLoading}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-bg px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || success || !selectedDate}
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 dark:bg-primary-500 text-base font-medium text-white hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : success ? (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  Save Date
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

NDECCExamDateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  currentDate: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Date)
  ]),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};

NDECCExamDateModal.defaultProps = {
  currentDate: null
};

export default NDECCExamDateModal;
