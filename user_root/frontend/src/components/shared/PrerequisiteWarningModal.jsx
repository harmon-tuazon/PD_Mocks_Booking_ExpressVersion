import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiAlertCircle, FiX, FiLock, FiInfo } from 'react-icons/fi';

const PrerequisiteWarningModal = ({
  isOpen,
  examName,
  examDate,
  prerequisiteExams,
  onClose
}) => {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      // Parse date as local time to avoid timezone conversion issues
      // exam_date is in YYYY-MM-DD format
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed

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
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Set focus to close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
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
          onClick={onClose}
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
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <FiAlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3
                  className="text-lg leading-6 font-headline font-semibold text-yellow-800 dark:text-yellow-400"
                  id="modal-title"
                >
                  Prerequisites Required
                </h3>
                <div className="mt-2">
                  <p className="text-sm font-body text-yellow-700 dark:text-yellow-300">
                    This Mock Discussion session is dedicated to students who have attended the required prerequisite exams.
                    You must complete at least one of the prerequisite exams before booking this discussion.
                  </p>
                </div>

                {/* Exam Info Card */}
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-start gap-2">
                    <FiLock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                        Selected Discussion Session
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        {examName || 'Mock Discussion'}
                      </p>
                      {examDate && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          {formatDate(examDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Prerequisites Info */}
                {prerequisiteExams && prerequisiteExams.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-start gap-2">
                      <FiInfo className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                          Required Prerequisites (attend any one)
                        </p>
                        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                          {prerequisiteExams.map((prereq, index) => (
                            <li key={prereq.id || prereq.mock_exam_id || index}>
                              • {prereq.mock_type || 'Mock Exam'} - {formatDate(prereq.exam_date)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Why Info Box */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-2">
                    <FiInfo className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-300 mb-1">
                        Why this requirement?
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        Mock Discussion sessions build upon skills practiced in prerequisite exams.
                        Attending a prerequisite exam ensures you're prepared for meaningful discussion and maximum learning value.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close button (X) */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={onClose}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-dark-bg px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              className="w-full sm:w-auto inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 dark:bg-primary-500 text-base font-medium text-white hover:bg-primary-700 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Exam Sessions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

PrerequisiteWarningModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  examName: PropTypes.string,
  examDate: PropTypes.string,
  prerequisiteExams: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    mock_exam_id: PropTypes.string,
    mock_type: PropTypes.string,
    exam_date: PropTypes.string
  })),
  onClose: PropTypes.func.isRequired
};

PrerequisiteWarningModal.defaultProps = {
  examName: null,
  examDate: null,
  prerequisiteExams: []
};

export default PrerequisiteWarningModal;
