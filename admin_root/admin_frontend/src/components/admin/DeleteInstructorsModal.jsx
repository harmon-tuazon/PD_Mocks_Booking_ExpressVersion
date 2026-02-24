/**
 * DeleteInstructorsModal Component
 * Confirmation modal for bulk deletion of instructors
 *
 * Features:
 * - Shows breakdown of instructors (deletable vs blocked by group assignments)
 * - Numeric confirmation input for safety
 * - List preview of first 10 instructors
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
import { instructorsApi } from '../../services/adminApi';

const DeleteInstructorsModal = ({
  isOpen,
  onClose,
  selectedInstructors,
  onSuccess
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const queryClient = useQueryClient();

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (ids) => instructorsApi.bulkDelete(ids),
    onSuccess: (data) => {
      toast.success(`Successfully deleted ${data.data?.deleted || 0} instructor(s)`);
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete instructors');
    }
  });

  // For instructors, we don't have group_count in the list data
  // So we'll show all as potentially deletable and let the backend determine
  // which ones have group assignments
  const instructorBreakdown = useMemo(() => {
    if (!selectedInstructors || selectedInstructors.length === 0) {
      return {
        all: [],
        total: 0
      };
    }

    return {
      all: selectedInstructors,
      total: selectedInstructors.length
    };
  }, [selectedInstructors]);

  // Reset confirmation input when modal opens/closes or instructors change
  useEffect(() => {
    if (!isOpen) {
      setConfirmationInput('');
    }
  }, [isOpen, selectedInstructors]);

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
    return inputNumber === instructorBreakdown.total;
  }, [confirmationInput, instructorBreakdown.total]);

  // Handle delete button click
  const handleDelete = async () => {
    if (!isConfirmationValid || deleteMutation.isPending) {
      return;
    }

    // Extract instructor IDs (use id or instructor_id)
    const instructorIds = instructorBreakdown.all.map(instructor =>
      instructor.id || instructor.instructor_id
    );

    try {
      await deleteMutation.mutateAsync(instructorIds);

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

  // Get preview instructors (first 10)
  const previewInstructors = useMemo(() => {
    return instructorBreakdown.all.slice(0, 10);
  }, [instructorBreakdown]);

  const remainingCount = instructorBreakdown.total - previewInstructors.length;

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
                      {/* Instructor count */}
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        You are about to delete{' '}
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {instructorBreakdown.total} instructor{instructorBreakdown.total !== 1 ? 's' : ''}
                        </span>
                      </p>

                      {/* Info about group assignments */}
                      <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                        <div className="flex items-center text-sm">
                          <span className="text-orange-600 dark:text-orange-400 mr-2 font-bold">!</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            Instructors assigned to active groups will be blocked from deletion
                          </span>
                        </div>
                      </div>

                      {/* Instructor list preview */}
                      {previewInstructors.length > 0 && (
                        <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Name
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Email
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                              {previewInstructors.map((instructor) => (
                                <tr key={instructor.id || instructor.instructor_id}>
                                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                    {instructor.instructor_name || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                    {instructor.email || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 text-xs">
                                    <span className={instructor.is_active
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-gray-500 dark:text-gray-400'
                                    }>
                                      {instructor.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Remaining count */}
                      {remainingCount > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          ...and {remainingCount} more instructor{remainingCount !== 1 ? 's' : ''}
                        </p>
                      )}

                      {/* Warning message */}
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 dark:border-red-400 p-3">
                        <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                          This action cannot be undone. All instructor data will be permanently deleted.
                        </p>
                      </div>

                      {/* Numeric confirmation input */}
                      {instructorBreakdown.total > 0 && (
                        <div className="space-y-2">
                          <input
                            id="confirmation-input"
                            type="text"
                            inputMode="numeric"
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            disabled={deleteMutation.isPending}
                            placeholder={`Type ${instructorBreakdown.total} to confirm`}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            autoComplete="off"
                            aria-label="Confirmation input"
                          />
                          {confirmationInput && !isConfirmationValid && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">
                              Please type {instructorBreakdown.total} to confirm
                            </p>
                          )}
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
                      !isConfirmationValid || deleteMutation.isPending || instructorBreakdown.total === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                    }`}
                    onClick={handleDelete}
                    disabled={!isConfirmationValid || deleteMutation.isPending || instructorBreakdown.total === 0}
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
                      `Delete ${instructorBreakdown.total > 0 ? instructorBreakdown.total : ''} Instructor${instructorBreakdown.total !== 1 ? 's' : ''}`
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

export default DeleteInstructorsModal;
