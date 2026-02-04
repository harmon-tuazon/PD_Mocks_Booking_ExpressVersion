/**
 * DeleteGroupsModal Component
 * Confirmation modal for bulk deletion of work check groups
 *
 * Features:
 * - Shows breakdown of groups (deletable vs blocked by students)
 * - Numeric confirmation input for safety
 * - List preview of first 10 groups
 * - Loading state during API call
 * - Auto-closes on success
 * - ESC key and backdrop click to close
 * - Accessibility support
 */

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { groupsApi } from '../../services/adminApi';

const DeleteGroupsModal = ({
  isOpen,
  onClose,
  selectedGroups,
  onSuccess
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (ids) => groupsApi.bulkDelete(ids),
    onSuccess: (data) => {
      toast.success(`Successfully deleted ${data.data?.deleted || 0} group(s)`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete groups');
    }
  });

  // Calculate group breakdown
  const groupBreakdown = useMemo(() => {
    if (!selectedGroups || selectedGroups.length === 0) {
      return {
        deletable: [],
        blocked: [],
        deletableCount: 0,
        blockedCount: 0,
        total: 0
      };
    }

    // Separate groups based on student count
    const blocked = selectedGroups.filter(group =>
      group.student_count && parseInt(group.student_count) > 0
    );

    const deletable = selectedGroups.filter(group =>
      !group.student_count || parseInt(group.student_count) === 0
    );

    return {
      deletable,
      blocked,
      deletableCount: deletable.length,
      blockedCount: blocked.length,
      total: selectedGroups.length
    };
  }, [selectedGroups]);

  // Reset confirmation input when modal opens/closes or groups change
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen, selectedGroups]);

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
    return inputNumber === groupBreakdown.deletableCount;
  }, [confirmationInput, groupBreakdown.deletableCount]);

  // Handle delete button click
  const handleDelete = async () => {
    if (!isConfirmationValid || deleteMutation.isPending) {
      return;
    }

    // Extract only deletable group IDs
    const groupIds = groupBreakdown.deletable.map(group => group.group_id);

    try {
      await deleteMutation.mutateAsync(groupIds);

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

  // Get preview groups (first 10)
  const previewGroups = useMemo(() => {
    const allGroups = [...groupBreakdown.blocked, ...groupBreakdown.deletable];
    return allGroups.slice(0, 10);
  }, [groupBreakdown]);

  const remainingCount = groupBreakdown.total - previewGroups.length;

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
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
                      {/* Group count */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        You are about to delete{' '}
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {groupBreakdown.total} group{groupBreakdown.total !== 1 ? 's' : ''}
                        </span>
                      </p>

                      {/* Group breakdown */}
                      {groupBreakdown.total > 0 && (
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                          {groupBreakdown.blockedCount > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-red-600 dark:text-red-400 mr-2 font-bold">✗</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {groupBreakdown.blockedCount}
                                </span>{' '}
                                group{groupBreakdown.blockedCount !== 1 ? 's' : ''} with students (cannot delete)
                              </span>
                            </div>
                          )}

                          {groupBreakdown.deletableCount > 0 && (
                            <div className="flex items-center text-sm">
                              <span className="text-orange-600 dark:text-orange-400 mr-2 font-bold">•</span>
                              <span className="text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">
                                  {groupBreakdown.deletableCount}
                                </span>{' '}
                                group{groupBreakdown.deletableCount !== 1 ? 's' : ''} without students (will be deleted)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Group list preview */}
                      {previewGroups.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Group ID
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Name
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Students
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                              {previewGroups.map((group) => {
                                const hasStudents = group.student_count && parseInt(group.student_count) > 0;
                                return (
                                  <tr
                                    key={group.id || group.group_id}
                                    className={hasStudents ? 'bg-red-50 dark:bg-red-900/20' : ''}
                                  >
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {group.group_id || 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {group.group_name || 'N/A'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                      {group.student_count || 0}
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                      {hasStudents ? (
                                        <span className="text-red-600 dark:text-red-400 font-medium">
                                          Has students
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
                          ...and {remainingCount} more group{remainingCount !== 1 ? 's' : ''}
                        </p>
                      )}

                      {/* Warning message */}
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 dark:border-red-400 p-3">
                        <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                          ⚠️ This action cannot be undone. All group data will be permanently deleted.
                        </p>
                      </div>

                      {/* Numeric confirmation input */}
                      {groupBreakdown.deletableCount > 0 && (
                        <div className="space-y-2">
                          <input
                            id="confirmation-input"
                            type="text"
                            inputMode="numeric"
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            disabled={deleteMutation.isPending}
                            placeholder={`Type ${groupBreakdown.deletableCount} to confirm`}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            autoComplete="off"
                            aria-label="Confirmation input"
                          />
                          {confirmationInput && !isConfirmationValid && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">
                              Please type {groupBreakdown.deletableCount} to confirm
                            </p>
                          )}
                        </div>
                      )}

                      {/* No deletable groups warning */}
                      {groupBreakdown.deletableCount === 0 && groupBreakdown.total > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 dark:border-yellow-400 p-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                            All selected groups have students and cannot be deleted.
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
                      !isConfirmationValid || deleteMutation.isPending || groupBreakdown.deletableCount === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                    }`}
                    onClick={handleDelete}
                    disabled={!isConfirmationValid || deleteMutation.isPending || groupBreakdown.deletableCount === 0}
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
                      `Delete ${groupBreakdown.deletableCount > 0 ? groupBreakdown.deletableCount : ''} Group${groupBreakdown.deletableCount !== 1 ? 's' : ''}`
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

export default DeleteGroupsModal;
