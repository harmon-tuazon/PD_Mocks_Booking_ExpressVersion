/**
 * MassDeleteModal Component
 * Confirmation modal for mass deletion of mock exam sessions
 *
 * Features:
 * - Shows breakdown of sessions (deletable vs blocked by bookings)
 * - Numeric confirmation input for safety
 * - List preview of first 10 sessions
 * - Loading state during API call
 * - Auto-closes on success
 * - ESC key and backdrop click to close
 * - Accessibility support
 */

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import useMassDelete from '../../hooks/useMassDelete';

const MassDeleteModal = ({
  isOpen,
  onClose,
  selectedSessions,
  onSuccess
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const deleteMutation = useMassDelete();

  // Calculate session breakdown
  const sessionBreakdown = useMemo(() => {
    if (!selectedSessions || selectedSessions.length === 0) {
      return {
        deletable: [],
        blocked: [],
        deletableCount: 0,
        blockedCount: 0,
        total: 0
      };
    }

    // Separate sessions based on booking status
    const blocked = selectedSessions.filter(session =>
      session.total_bookings && parseInt(session.total_bookings) > 0
    );

    const deletable = selectedSessions.filter(session =>
      !session.total_bookings || parseInt(session.total_bookings) === 0
    );

    return {
      deletable,
      blocked,
      deletableCount: deletable.length,
      blockedCount: blocked.length,
      total: selectedSessions.length
    };
  }, [selectedSessions]);

  // Reset confirmation input when modal opens/closes or sessions change
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen, selectedSessions]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !deleteMutation.isPending) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, deleteMutation.isPending, onClose]);

  // Validate confirmation input
  const isConfirmationValid = useMemo(() => {
    const inputNumber = parseInt(confirmationInput);
    return inputNumber === sessionBreakdown.deletableCount;
  }, [confirmationInput, sessionBreakdown.deletableCount]);

  // Handle delete button click
  const handleDelete = async () => {
    if (!isConfirmationValid || deleteMutation.isPending) {
      return;
    }

    // Extract only deletable session IDs
    const sessionIds = sessionBreakdown.deletable.map(session => session.id);

    try {
      await deleteMutation.mutateAsync(sessionIds);

      // Close modal on success
      onClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Delete operation failed:', error);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString || 'N/A';
    }
  };

  // Get preview sessions (first 10)
  const previewSessions = useMemo(() => {
    const allSessions = [...sessionBreakdown.blocked, ...sessionBreakdown.deletable];
    return allSessions.slice(0, 10);
  }, [sessionBreakdown]);

  const remainingCount = sessionBreakdown.total - previewSessions.length;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={deleteMutation.isPending ? () => {} : onClose}
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="sm:flex sm:items-start">
                  {/* Warning Icon */}
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Permanent Deletion
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                      {/* Session count */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        You are about to delete{' '}
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {sessionBreakdown.total} session{sessionBreakdown.total !== 1 ? 's' : ''}
                        </span>
                      </p>

                      {/* Session breakdown */}
                      {sessionBreakdown.total > 0 && (
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                          {sessionBreakdown.blockedCount > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-red-600 dark:text-red-400 mr-2 font-bold">✗</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {sessionBreakdown.blockedCount}
                                </span>{' '}
                                session{sessionBreakdown.blockedCount !== 1 ? 's' : ''} with bookings (cannot delete)
                              </span>
                            </div>
                          )}

                          {sessionBreakdown.deletableCount > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-orange-600 dark:text-orange-400 mr-2 font-bold">•</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">
                                  {sessionBreakdown.deletableCount}
                                </span>{' '}
                                session{sessionBreakdown.deletableCount !== 1 ? 's' : ''} without bookings (will be deleted)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Session list preview */}
                      {previewSessions.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Type
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Date
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Location
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                              {previewSessions.map((session) => {
                                const hasBookings = session.total_bookings && parseInt(session.total_bookings) > 0;
                                return (
                                  <tr
                                    key={session.id}
                                    className={hasBookings ? 'bg-red-50 dark:bg-red-900/20' : ''}
                                  >
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {session.mock_type || 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {formatDate(session.exam_date)}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {session.location || 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                      {hasBookings ? (
                                        <span className="text-red-600 dark:text-red-400 font-medium">
                                          Has bookings
                                        </span>
                                      ) : (
                                        <span className="text-gray-500 dark:text-gray-400">
                                          Can delete
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Remaining count */}
                      {remainingCount > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          ...and {remainingCount} more session{remainingCount !== 1 ? 's' : ''}
                        </p>
                      )}

                      {/* Warning message */}
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 dark:border-red-400 p-3">
                        <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                          ⚠️ This action cannot be undone. All session data will be permanently deleted.
                        </p>
                      </div>

                      {/* Numeric confirmation input */}
                      {sessionBreakdown.deletableCount > 0 && (
                        <div className="space-y-2">
                          <label
                            htmlFor="confirmation-input"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            To confirm, type the number of sessions to delete:{' '}
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {sessionBreakdown.deletableCount}
                            </span>
                          </label>
                          <input
                            id="confirmation-input"
                            type="text"
                            inputMode="numeric"
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            disabled={deleteMutation.isPending}
                            className={`block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm ${
                              confirmationInput && !isConfirmationValid
                                ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                : ''
                            }`}
                            placeholder={`Type ${sessionBreakdown.deletableCount}`}
                            autoComplete="off"
                          />
                          {confirmationInput && !isConfirmationValid && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              Please enter exactly {sessionBreakdown.deletableCount} to confirm
                            </p>
                          )}
                        </div>
                      )}

                      {/* No deletable sessions warning */}
                      {sessionBreakdown.deletableCount === 0 && sessionBreakdown.total > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 dark:border-yellow-400 p-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                            All selected sessions have bookings and cannot be deleted.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 sm:mt-4 sm:flex sm:flex-row-reverse sm:ml-10">
                  {/* Delete Button */}
                  <button
                    type="button"
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      !isConfirmationValid || deleteMutation.isPending || sessionBreakdown.deletableCount === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                    }`}
                    onClick={handleDelete}
                    disabled={!isConfirmationValid || deleteMutation.isPending || sessionBreakdown.deletableCount === 0}
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      `Delete ${sessionBreakdown.deletableCount > 0 ? sessionBreakdown.deletableCount : ''} Session${sessionBreakdown.deletableCount !== 1 ? 's' : ''}`
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto transition-colors"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
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

export default MassDeleteModal;
