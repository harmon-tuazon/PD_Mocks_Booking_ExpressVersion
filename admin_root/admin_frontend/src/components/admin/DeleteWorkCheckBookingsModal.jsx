/**
 * DeleteWorkCheckBookingsModal Component
 * Confirmation modal for deleting work check bookings
 */

import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const DeleteWorkCheckBookingsModal = ({
  isOpen,
  onClose,
  selectedBookings,
  onConfirm,
  isDeleting
}) => {
  const [confirmText, setConfirmText] = useState('');

  const bookingCount = selectedBookings?.length || 0;
  const confirmWord = 'DELETE';
  const isConfirmed = confirmText === confirmWord;

  const handleConfirm = () => {
    if (isConfirmed && onConfirm) {
      onConfirm(selectedBookings.map(b => b.id || b));
    }
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={handleClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-dark-card shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Delete Bookings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You are about to delete{' '}
              <span className="font-semibold text-red-600 dark:text-red-400">
                {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
              </span>
              . This will permanently remove the selected bookings from the system.
            </p>

            {/* Preview list */}
            {selectedBookings && selectedBookings.length > 0 && selectedBookings.length <= 5 && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md max-h-40 overflow-y-auto">
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  {selectedBookings.map((booking, index) => (
                    <li key={booking.id || index} className="flex items-center">
                      <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                      {booking.student_name || booking.student_id || `Booking ${index + 1}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedBookings && selectedBookings.length > 5 && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {selectedBookings.length} bookings selected for deletion
                </p>
              </div>
            )}

            {/* Confirmation input */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type <span className="font-bold text-red-600">{confirmWord}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmWord}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isConfirmed || isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </span>
              ) : (
                'Delete Bookings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteWorkCheckBookingsModal;
