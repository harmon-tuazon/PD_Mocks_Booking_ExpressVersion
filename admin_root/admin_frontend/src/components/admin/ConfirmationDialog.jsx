/**
 * ConfirmationDialog Component
 * Modal dialog for confirming attendance marking action
 *
 * Features:
 * - Warning icon
 * - Selected count display
 * - Confirm/Cancel buttons
 * - Escape key to close
 * - Click outside to close
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ConfirmationDialog = ({ isOpen, onClose, onConfirm, selectedCount }) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
        </Transition.Child>

        {/* Full-screen container */}
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Icon */}
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                </div>

                {/* Title */}
                <Dialog.Title
                  as="h3"
                  className="mt-4 text-center text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                >
                  Confirm Attendance
                </Dialog.Title>

                {/* Description */}
                <div className="mt-3">
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                    You are about to mark <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedCount} student{selectedCount > 1 ? 's' : ''}</span> as attended.
                  </p>
                  <p className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">
                    This action will update their attendance status in HubSpot. This action cannot be undone from this interface.
                  </p>
                </div>

                {/* Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="flex-1 inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors shadow-sm"
                    onClick={onConfirm}
                  >
                    Confirm
                  </button>
                </div>

                {/* Keyboard hint */}
                <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
                  Press Escape to cancel
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ConfirmationDialog;
