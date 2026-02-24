/**
 * DeleteSlotsModal Component
 * Modal for bulk deleting work check slots with type-in confirmation
 */

import { Fragment, useState, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useWorkCheckSlotMutations } from '../../hooks/useWorkCheckSlotMutations';

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time for display
 */
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const DeleteSlotsModal = ({
  isOpen,
  onClose,
  selectedSlots = [],
  onSuccess
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { bulkDelete } = useWorkCheckSlotMutations();

  // Calculate deletable count (all slots in this case)
  const deletableCount = selectedSlots.length;

  // Check if confirmation matches
  const isConfirmed = confirmInput === deletableCount.toString();

  // Reset state when modal closes
  const handleClose = () => {
    setConfirmInput('');
    onClose();
  };

  // Handle delete
  const handleDelete = async () => {
    if (!isConfirmed || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const ids = selectedSlots.map(slot => slot.id);
      const result = await bulkDelete.mutateAsync(ids);

      const { deleted, blocked } = result.data || {};

      if (blocked > 0) {
        toast.success(`Deleted ${deleted} slot(s). ${blocked} slot(s) blocked due to active bookings.`);
      } else {
        toast.success(`Successfully deleted ${deleted} slot(s)`);
      }

      setConfirmInput('');
      onSuccess?.();
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete slots';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-dark-card p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                    Delete Work Check Slots
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You are about to delete <span className="font-bold text-red-600">{deletableCount}</span> work check slot(s).
                    This action cannot be undone.
                  </p>

                  {/* Slots preview */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Slots to be deleted:
                    </p>
                    <ul className="space-y-1">
                      {selectedSlots.slice(0, 5).map((slot) => (
                        <li key={slot.id} className="text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(slot.slot_date)} at {formatTime(slot.slot_time)} - {slot.instructor_name || 'Unknown'}
                        </li>
                      ))}
                      {selectedSlots.length > 5 && (
                        <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                          ...and {selectedSlots.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Type-in confirmation */}
                  <div className="mb-4">
                    <label htmlFor="confirm-delete" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type <span className="font-bold text-red-600">{deletableCount}</span> to confirm deletion:
                    </label>
                    <input
                      type="text"
                      id="confirm-delete"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder={`Type ${deletableCount} to confirm`}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      autoComplete="off"
                    />
                  </div>

                  {/* Warning note */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-4">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <strong>Note:</strong> Slots with active bookings cannot be deleted. They will be skipped.
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!isConfirmed || isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Deleting...' : `Delete ${deletableCount} Slot(s)`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DeleteSlotsModal;
