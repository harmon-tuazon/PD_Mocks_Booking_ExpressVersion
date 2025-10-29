/**
 * DeleteControls Component
 * Provides a Delete button with confirmation modal for mock exam deletion
 */

import { useState } from 'react';
import { TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { mockExamsApi } from '../../services/adminApi';

const DeleteControls = ({
  examId,
  examDetails,
  onDeleteSuccess,
  disabled = false,
  className = ''
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
    setError(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      // Call delete API
      const response = await mockExamsApi.delete(examId);

      // Success - close modal and call success callback
      setShowConfirmDialog(false);

      if (onDeleteSuccess) {
        onDeleteSuccess(response);
      }
    } catch (err) {
      // Show error in modal
      const errorMessage = err.message || 'Failed to delete mock exam';
      setError(errorMessage);
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    setError(null);
  };

  // Format exam date for display
  const formattedDate = examDetails?.exam_date
    ? format(new Date(examDetails.exam_date), 'EEEE, MMMM d, yyyy')
    : 'Date not available';

  return (
    <>
      {/* Delete Button */}
      <button
        onClick={handleDeleteClick}
        disabled={disabled}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm transition-colors ${
          disabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
            : 'text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
        } ${className}`}
        aria-label="Delete mock exam"
      >
        <TrashIcon className="h-4 w-4 mr-2" />
        Delete
      </button>

      {/* Confirmation Dialog Modal */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
              onClick={!isDeleting ? handleCancel : undefined}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900 dark:opacity-75"></div>
            </div>

            {/* Center modal */}
            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                {/* Warning Icon */}
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                  <svg
                    className="h-6 w-6 text-red-600 dark:text-red-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>

                {/* Modal Content */}
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-title">
                    Delete Mock Exam?
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this mock exam? This action cannot be undone.
                    </p>

                    {/* Exam Details */}
                    <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-md p-4 text-left">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Exam Details:
                      </h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>
                          <span className="font-medium">Type:</span> {examDetails?.mock_type || 'N/A'}
                        </li>
                        <li>
                          <span className="font-medium">Date:</span> {formattedDate}
                        </li>
                        <li>
                          <span className="font-medium">Location:</span> {examDetails?.location || 'N/A'}
                        </li>
                        {examDetails?.total_bookings > 0 && (
                          <li className="text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ This exam has {examDetails.total_bookings} booking(s)
                          </li>
                        )}
                      </ul>
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
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                {/* Delete Button */}
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className={`w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:col-start-2 sm:text-sm ${
                    isDeleting
                      ? 'bg-red-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                  }`}
                >
                  {isDeleting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      Delete Exam
                    </>
                  )}
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isDeleting}
                  className={`mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 text-base font-medium sm:mt-0 sm:col-start-1 sm:text-sm ${
                    isDeleting
                      ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeleteControls;
