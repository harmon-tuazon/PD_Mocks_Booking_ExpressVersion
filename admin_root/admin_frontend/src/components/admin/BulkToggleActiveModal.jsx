/**
 * BulkToggleActiveModal Component
 * Confirmation modal for bulk toggling active/inactive status of mock exam sessions
 *
 * Features:
 * - Shows breakdown of sessions to be activated/deactivated
 * - Loading state during API call
 * - Auto-closes on success
 * - ESC key and backdrop click to close
 * - Accessibility support
 */

import { Fragment, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PowerIcon } from '@heroicons/react/24/outline';

const BulkToggleActiveModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedSessions,
  isSubmitting
}) => {
  // Calculate session breakdown
  const sessionBreakdown = useMemo(() => {
    if (!selectedSessions || selectedSessions.length === 0) {
      return { toActivate: 0, toDeactivate: 0, total: 0 };
    }

    const toActivate = selectedSessions.filter(session =>
      session.is_active === false || session.is_active === 'false'
    ).length;

    const toDeactivate = selectedSessions.filter(session =>
      session.is_active === true || session.is_active === 'true'
    ).length;

    return {
      toActivate,
      toDeactivate,
      total: selectedSessions.length
    };
  }, [selectedSessions]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isSubmitting, onClose]);

  // Handle confirm button click
  const handleConfirm = async () => {
    if (!isSubmitting && onConfirm) {
      await onConfirm();
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={isSubmitting ? () => {} : onClose}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="sm:flex sm:items-start">
                  {/* Icon */}
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                    <PowerIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Toggle Active Status
                    </Dialog.Title>

                    <div className="mt-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        You are about to toggle the active status for{' '}
                        <span className="font-semibold">{sessionBreakdown.total} session{sessionBreakdown.total !== 1 ? 's' : ''}</span>:
                      </p>

                      {sessionBreakdown.total > 0 && (
                        <div className="mt-3 space-y-2">
                          {sessionBreakdown.toActivate > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-green-600 dark:text-green-400 mr-2">•</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {sessionBreakdown.toActivate} session{sessionBreakdown.toActivate !== 1 ? 's' : ''} will be activated
                              </span>
                            </div>
                          )}

                          {sessionBreakdown.toDeactivate > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-red-600 dark:text-red-400 mr-2">•</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {sessionBreakdown.toDeactivate} session{sessionBreakdown.toDeactivate !== 1 ? 's' : ''} will be deactivated
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        Active sessions will become inactive and vice versa. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 sm:mt-4 sm:flex sm:flex-row-reverse sm:ml-10">
                  <button
                    type="button"
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      isSubmitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
                    onClick={handleConfirm}
                    disabled={isSubmitting || sessionBreakdown.total === 0}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Confirm Toggle'
                    )}
                  </button>

                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto transition-colors"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default BulkToggleActiveModal;