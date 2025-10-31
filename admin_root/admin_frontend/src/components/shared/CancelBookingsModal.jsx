/**
 * CancelBookingsModal Component
 * Modal dialog for batch booking cancellation with two-step confirmation
 *
 * Features:
 * - Two-step confirmation process
 * - Step 1: Show summary of bookings to cancel with warning
 * - Step 2: Type numeric confirmation (number of bookings)
 * - Show list of first 5 booking names, then "... and X more"
 * - Loading state during API call
 * - Success/error handling
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TrashIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const CancelBookingsModal = ({
  isOpen,
  onClose,
  onConfirm,
  selectedBookings = [],
  isLoading = false,
  error = null
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const inputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setConfirmationInput('');
      // Auto-focus input when reaching step 2
      if (currentStep === 2) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [isOpen, currentStep]);

  // Check if confirmation input matches the required number
  const isConfirmationValid = confirmationInput === String(selectedBookings.length);

  // Handle proceeding to step 2
  const handleProceedToConfirmation = () => {
    setCurrentStep(2);
    // Focus the input field after a brief delay to ensure it's rendered
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Handle final confirmation
  const handleConfirmCancel = () => {
    if (isConfirmationValid) {
      onConfirm();
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  // Handle escape key
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape' && !isLoading) {
      handleClose();
    }
  };

  // Get display list of bookings (max 5 shown, rest as count)
  const getBookingDisplayList = () => {
    const maxDisplay = 5;
    const displayBookings = selectedBookings.slice(0, maxDisplay);
    const remainingCount = selectedBookings.length - maxDisplay;

    return { displayBookings, remainingCount };
  };

  const { displayBookings, remainingCount } = getBookingDisplayList();

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={handleClose}
        onKeyDown={handleEscapeKey}
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Step 1: Summary and Warning */}
                {currentStep === 1 && (
                  <>
                    {/* Icon */}
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <ExclamationTriangleIcon
                        className="h-6 w-6 text-red-600 dark:text-red-400"
                        aria-hidden="true"
                      />
                    </div>

                    {/* Title */}
                    <Dialog.Title
                      as="h3"
                      className="mt-4 text-center text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                    >
                      Cancel Bookings
                    </Dialog.Title>

                    {/* Description */}
                    <div className="mt-3">
                      <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                        You are about to cancel <span className="font-semibold">{selectedBookings.length}</span> booking{selectedBookings.length !== 1 ? 's' : ''}.
                      </p>

                      {/* Bookings List */}
                      {selectedBookings.length > 0 && (
                        <div className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                          <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                            Bookings to be cancelled:
                          </p>
                          <ul className="text-sm text-red-800 dark:text-red-300 space-y-1">
                            {displayBookings.map((booking, index) => (
                              <li key={booking.id || index} className="flex items-center">
                                <span className="w-1.5 h-1.5 bg-red-400 dark:bg-red-500 rounded-full mr-2"></span>
                                {booking.name || 'Unknown'}
                                {booking.email && (
                                  <span className="text-red-600 dark:text-red-400 ml-1">
                                    ({booking.email})
                                  </span>
                                )}
                              </li>
                            ))}
                            {remainingCount > 0 && (
                              <li className="font-medium text-red-700 dark:text-red-300 italic">
                                ... and {remainingCount} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Warning Message */}
                      <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          <strong>⚠️ Warning:</strong> This action cannot be undone. These bookings will be marked as cancelled.
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        className="flex-1 inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                        onClick={handleClose}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="flex-1 inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm"
                        onClick={handleProceedToConfirmation}
                        disabled={isLoading}
                      >
                        <TrashIcon className="h-4 w-4 mr-2" />
                        Proceed
                      </button>
                    </div>
                  </>
                )}

                {/* Step 2: Typed Confirmation */}
                {currentStep === 2 && (
                  <>
                    {/* Icon */}
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <TrashIcon
                        className="h-6 w-6 text-red-600 dark:text-red-400"
                        aria-hidden="true"
                      />
                    </div>

                    {/* Title */}
                    <Dialog.Title
                      as="h3"
                      className="mt-4 text-center text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                    >
                      Confirm Cancellation
                    </Dialog.Title>

                    {/* Description */}
                    <div className="mt-3">
                      <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4">
                        To confirm cancellation of <span className="font-semibold">{selectedBookings.length}</span> booking{selectedBookings.length !== 1 ? 's' : ''},
                        type <span className="font-mono font-bold text-red-600 dark:text-red-400">{selectedBookings.length}</span> below:
                      </p>

                      {/* Confirmation Input */}
                      <div className="mt-4">
                        <input
                          ref={inputRef}
                          type="text"
                          value={confirmationInput}
                          onChange={(e) => setConfirmationInput(e.target.value)}
                          placeholder={`Type ${selectedBookings.length} to confirm`}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg font-mono bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          disabled={isLoading}
                          autoComplete="off"
                          aria-label="Confirmation input"
                        />
                        {confirmationInput && !isConfirmationValid && (
                          <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">
                            Please type the exact number to confirm
                          </p>
                        )}
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                          <p className="text-sm text-red-800 dark:text-red-300">
                            {error}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        className="flex-1 inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setCurrentStep(1)}
                        disabled={isLoading}
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Back
                      </button>
                      <button
                        type="button"
                        className={`flex-1 inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors ${
                          isConfirmationValid && !isLoading
                            ? 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                            : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                        }`}
                        onClick={handleConfirmCancel}
                        disabled={!isConfirmationValid || isLoading}
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Confirm Cancellation
                          </>
                        )}
                      </button>
                    </div>

                    {/* Keyboard hint */}
                    <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
                      Press Escape to cancel
                    </p>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CancelBookingsModal;