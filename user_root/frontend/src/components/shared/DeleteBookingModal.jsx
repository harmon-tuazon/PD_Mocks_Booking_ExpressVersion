import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiAlertCircle, FiX, FiCalendar, FiClock, FiMapPin, FiRefreshCw } from 'react-icons/fi';
import { formatTimeRange } from '../../services/api';

const DeleteBookingModal = ({
  isOpen,
  booking,
  isDeleting,
  error,
  onClose,
  onConfirm
}) => {
  const modalRef = useRef(null);
  const firstButtonRef = useRef(null);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };


  // Get exam date from booking (handle different field names)
  const getExamDate = (booking) => {
    if (!booking) return null;
    return booking.examDate || booking.exam_date || booking.date;
  };


  // Get exam type from booking (handle different field names)
  const getExamType = (booking) => {
    if (!booking) return 'Mock Exam';
    return booking.mockExam?.examType || booking.mock_type || booking.examType || 'Mock Exam';
  };

  // Get location from booking (handle different field names)
  const getLocation = (booking) => {
    if (!booking) return 'Location TBD';
    return booking.mockExam?.campus || booking.location || booking.campus || 'Location TBD';
  };

  // Get tokens to restore (if available)
  const getTokensToRestore = (booking) => {
    if (!booking) return null;
    return booking.creditsUsed || booking.credits_used || booking.credits || null;
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Set focus to first button when modal opens
      setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isDeleting, onClose]);

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

  const examDate = getExamDate(booking);
  const examType = getExamType(booking);
  const location = getLocation(booking);
  const tokensToRestore = getTokensToRestore(booking);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay with backdrop blur */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-20 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={!isDeleting ? onClose : undefined}
        ></div>

        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full"
        >
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <FiAlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  Cancel Booking
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to cancel this booking? This action cannot be undone.
                  </p>
                </div>

                {/* Booking Details Card */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    {/* Exam Type */}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{examType}</p>
                    </div>

                    {/* Date and Time */}
                    {examDate && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <FiCalendar className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <div>{formatDate(examDate)}</div>
                        </div>
                      </div>
                    )}

                    {/* Time Range */}
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <FiClock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>{formatTimeRange(booking)}</div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <FiMapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{location}</span>
                    </div>

                    {/* Tokens to Restore */}
                    {tokensToRestore && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <FiRefreshCw className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          {tokensToRestore} token{tokensToRestore !== 1 ? 's' : ''} will be restored
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <FiAlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Close button */}
              {!isDeleting && (
                <button
                  type="button"
                  className="hidden sm:block absolute top-3 right-3 bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <FiX className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
            <button
              type="button"
              ref={firstButtonRef}
              disabled={isDeleting}
              onClick={async () => {
                if (booking.id || booking.recordId) {
                  await onConfirm(booking.id || booking.recordId);
                }
              }}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:text-sm transition-colors duration-200"
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cancelling...
                </span>
              ) : (
                'Yes, Cancel Booking'
              )}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm transition-colors duration-200"
            >
              Keep Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

DeleteBookingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  booking: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    recordId: PropTypes.string,
    examDate: PropTypes.string,
    exam_date: PropTypes.string,
    date: PropTypes.string,
    examTime: PropTypes.string,
    exam_time: PropTypes.string,
    start_time: PropTypes.string,
    time: PropTypes.string,
    mockExam: PropTypes.shape({
      examType: PropTypes.string,
      campus: PropTypes.string
    }),
    mock_type: PropTypes.string,
    examType: PropTypes.string,
    location: PropTypes.string,
    campus: PropTypes.string,
    creditsUsed: PropTypes.number,
    credits_used: PropTypes.number,
    credits: PropTypes.number
  }),
  isDeleting: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
};

DeleteBookingModal.defaultProps = {
  isDeleting: false,
  error: null,
  booking: null
};

export default DeleteBookingModal;