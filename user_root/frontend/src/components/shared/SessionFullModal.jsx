import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiAlertCircle, FiX, FiCalendar } from 'react-icons/fi';

/**
 * Modal displayed when a mock exam session becomes full while user is on the booking page.
 * Used for both background polling detection and pre-submission validation.
 */
const SessionFullModal = ({
  isOpen,
  mockType,
  examDate,
  onSelectAnother
}) => {
  const modalRef = useRef(null);
  const buttonRef = useRef(null);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
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

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onSelectAnother();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      setTimeout(() => {
        buttonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onSelectAnother]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="session-full-modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay with backdrop blur */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-20 dark:bg-opacity-40 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onSelectAnother}
        ></div>

        {/* Centering trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-dark-border"
        >
          {/* Header */}
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-headline font-semibold text-red-800 dark:text-red-400" id="session-full-modal-title">
                  Session No Longer Available
                </h3>
                <div className="mt-2">
                  <p className="text-sm font-body text-gray-700 dark:text-gray-300">
                    This session has just reached full capacity. Another student completed their booking moments ago.
                  </p>
                </div>

                {/* Exam Details Card */}
                {(mockType || examDate) && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-hover rounded-lg border border-gray-200 dark:border-dark-border">
                    <div className="flex items-start gap-2">
                      <FiCalendar className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        {mockType && (
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                            {mockType}
                          </p>
                        )}
                        {examDate && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(examDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestion Box */}
                <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700">
                  <p className="text-sm font-medium text-primary-800 dark:text-primary-300 mb-1">
                    What can I do?
                  </p>
                  <p className="text-sm text-primary-700 dark:text-primary-400">
                    Don't worry! There are other sessions available. Click the button below to browse other dates and times.
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={onSelectAnother}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-bg px-4 py-3 sm:px-6">
            <button
              type="button"
              ref={buttonRef}
              onClick={onSelectAnother}
              className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 dark:bg-primary-500 text-base font-medium text-white hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Select Another Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

SessionFullModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mockType: PropTypes.string,
  examDate: PropTypes.string,
  onSelectAnother: PropTypes.func.isRequired
};

SessionFullModal.defaultProps = {
  mockType: null,
  examDate: null
};

export default SessionFullModal;
