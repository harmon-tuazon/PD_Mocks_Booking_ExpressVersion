/**
 * AttendanceControls Component
 * Control panel for attendance marking functionality
 *
 * Features:
 * - Toggle attendance mode button
 * - Selection counter
 * - Select All / Clear buttons
 * - Mark as Attended button
 * - Confirmation dialog integration
 */

import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';

const AttendanceControls = ({
  isAttendanceMode,
  isSubmitting,
  selectedCount,
  selectableCount,
  attendedCount,
  totalCount,
  onToggleMode,
  onSelectAll,
  onClearAll,
  onMarkAttended
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleMarkAttended = () => {
    if (selectedCount === 0) return;
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    onMarkAttended();
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  // If not in attendance mode, show the toggle button
  if (!isAttendanceMode) {
    return (
      <div className="flex items-center gap-4">
        {/* Summary Badge */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{attendedCount} / {totalCount}</span>
          <span>attended</span>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggleMode}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors shadow-sm"
          disabled={totalCount === 0}
        >
          <CheckCircleIcon className="h-5 w-5 mr-2" />
          Mark Attendance
        </button>
      </div>
    );
  }

  // In attendance mode - show full control panel
  return (
    <>
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left side - Selection info and controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Selection Counter */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 text-sm font-semibold">
                {selectedCount} of {selectableCount} selected
              </div>
              {attendedCount > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  ({attendedCount} already attended)
                </div>
              )}
            </div>

            {/* Select All / Clear Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectAll}
                disabled={selectedCount === selectableCount || isSubmitting}
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Select All
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={onClearAll}
                disabled={selectedCount === 0 || isSubmitting}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-3">
            {/* Mark as Attended Button */}
            <button
              onClick={handleMarkAttended}
              disabled={selectedCount === 0 || isSubmitting}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Mark as Attended ({selectedCount})
                </>
              )}
            </button>

            {/* Exit Attendance Mode Button */}
            <button
              onClick={onToggleMode}
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Exit
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Shortcuts:</span> Ctrl+A to select all, Escape to exit
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        selectedCount={selectedCount}
      />
    </>
  );
};

export default AttendanceControls;
