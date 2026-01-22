import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiAlertCircle, FiX } from 'react-icons/fi';

/**
 * Modal displayed when a mock exam session becomes full while user is on the booking page.
 * Used for both background polling detection and pre-submission validation.
 */
const SessionFullModal = ({
  isOpen,
  onSelectAnother
}) => {
  const modalRef = useRef(null);
  const buttonRef = useRef(null);

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

        {/* Modal panel - Yellow/Warning theme */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-yellow-200 dark:border-yellow-700"
        >
          {/* Header */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <FiAlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-headline font-semibold text-yellow-800 dark:text-yellow-400" id="session-full-modal-title">
                  Session No Longer Available
                </h3>
                <div className="mt-2">
                  <p className="text-sm font-body text-yellow-700 dark:text-yellow-300">
                    This session has just reached full capacity. Another student completed their booking moments ago.
                  </p>
                </div>

                {/* Suggestion Box */}
                <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-600">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    What can I do?
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Don't worry! There are other sessions available. Click the button below to browse other dates and times.
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-yellow-500 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                onClick={onSelectAnother}
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-yellow-100 dark:bg-yellow-900/30 px-4 py-3 sm:px-6 space-y-2">
            <button
              type="button"
              ref={buttonRef}
              onClick={onSelectAnother}
              className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 dark:bg-yellow-500 text-base font-medium text-white hover:bg-yellow-700 dark:hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:text-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Select Another Session
            </button>

            {/* Get Help Button */}
            <button
              type="button"
              onClick={() => window.open('https://rve7i.share.hsforms.com/2xIiXXRfGRz-Lmi8eMWjD_g', '_blank', 'noopener,noreferrer')}
              className="w-full inline-flex justify-center items-center rounded-md border border-yellow-300 dark:border-yellow-600 shadow-sm px-4 py-2 bg-white dark:bg-yellow-900/20 text-base font-medium text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:text-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get Help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

SessionFullModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSelectAnother: PropTypes.func.isRequired
};

export default SessionFullModal;
