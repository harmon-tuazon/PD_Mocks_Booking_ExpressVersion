/**
 * EditControls Component
 * Provides Edit/Save/Cancel buttons for exam editing
 */

import { useState } from 'react';
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const EditControls = ({
  isEditing,
  isSaving,
  isDirty,
  onEdit,
  onSave,
  onCancel,
  className = ''
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleEditClick = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const handleSaveClick = async () => {
    if (onSave) {
      await onSave();
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      // Show confirmation dialog for unsaved changes
      setShowConfirmDialog(true);
    } else {
      // No changes, cancel directly
      if (onCancel) {
        onCancel();
      }
    }
  };

  const handleConfirmCancel = () => {
    setShowConfirmDialog(false);
    if (onCancel) {
      onCancel(true); // Force cancel
    }
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  if (!isEditing) {
    // Show Edit button when not editing
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={handleEditClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          aria-label="Edit mock exam"
        >
          <PencilIcon className="h-4 w-4 mr-2" />
          Edit
        </button>
      </div>
    );
  }

  // Show Save and Cancel buttons when editing
  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Save Button */}
        <button
          onClick={handleSaveClick}
          disabled={isSaving || !isDirty}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors ${
            isSaving
              ? 'bg-gray-400 cursor-not-allowed'
              : isDirty
              ? 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          aria-label="Save changes"
        >
          {isSaving ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </button>

        {/* Cancel Button */}
        <button
          onClick={handleCancelClick}
          disabled={isSaving}
          className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${
            isSaving
              ? 'border-gray-300 text-gray-400 bg-white cursor-not-allowed'
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
          aria-label="Cancel editing"
        >
          <XMarkIcon className="h-4 w-4 mr-2" />
          Cancel
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
              onClick={handleContinueEditing}
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
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <svg
                    className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
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
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    Unsaved Changes
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      You have unsaved changes. Are you sure you want to leave without saving?
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleContinueEditing}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditControls;