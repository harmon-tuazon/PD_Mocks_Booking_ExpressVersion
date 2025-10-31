/**
 * AttendanceControls Component
 * Control panel for attendance marking functionality
 * Refactored to match CancellationControls pattern
 *
 * Features:
 * - Attendance badges and buttons always visible at top
 * - Control panel appears below when in attendance mode
 * - Selection counter with attendance breakdown
 * - Select All / Clear buttons
 * - Action dropdown (Mark Yes, Mark No, Unmark)
 * - Apply to Selected button
 * - Confirmation dialog integration
 */

import { CheckCircleIcon, XMarkIcon, XCircleIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import ConfirmationDialog from './ConfirmationDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AttendanceControls = ({
  isAttendanceMode,
  isSubmitting,
  selectedCount,
  selectableCount,
  attendedCount,
  noShowCount,
  unmarkedCount,
  totalCount,
  action,
  onToggleMode,
  onSelectAll,
  onClearAll,
  onSetAction,
  onApplyAction,
  // Cancellation props
  onCancelBookings = null,
  isCancellationMode = false
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleApplyAction = () => {
    if (selectedCount === 0) return;
    setShowConfirmDialog(true);
  };

  const handleConfirm = () => {
    setShowConfirmDialog(false);
    onApplyAction();
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  // Get action label for buttons and dialogs
  const getActionLabel = () => {
    switch (action) {
      case 'mark_yes':
        return 'Mark as Attended';
      case 'mark_no':
        return 'Mark as No Show';
      case 'unmark':
        return 'Unmark Attendance';
      default:
        return 'Apply Action';
    }
  };

  // Get action icon
  const getActionIcon = () => {
    switch (action) {
      case 'mark_yes':
        return <CheckCircleIcon className="h-5 w-5 mr-2" />;
      case 'mark_no':
        return <XCircleIcon className="h-5 w-5 mr-2" />;
      case 'unmark':
        return <ArrowPathIcon className="h-5 w-5 mr-2" />;
      default:
        return <CheckCircleIcon className="h-5 w-5 mr-2" />;
    }
  };

  return (
    <>
      {/* Always show badges and buttons at the top */}
      <div className="flex items-center justify-between mb-4">
        {/* Summary Badges - Attendance breakdown */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
            <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-900 dark:text-green-100">
              {attendedCount} Yes
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
            <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-semibold text-red-900 dark:text-red-100">
              {noShowCount} No
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {unmarkedCount} Unmarked
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total: {totalCount}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Cancel Bookings Button */}
          {onCancelBookings && (
            <button
              onClick={onCancelBookings}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
                isAttendanceMode
                  ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
                  : 'text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
              }`}
              disabled={totalCount === 0 || isCancellationMode || isAttendanceMode}
              title={isAttendanceMode ? 'Exit attendance mode to cancel bookings' : ''}
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              Cancel Bookings
            </button>
          )}

          {/* Mark Attendance Button */}
          <button
            onClick={onToggleMode}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm ${
              isCancellationMode
                ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : isAttendanceMode
                ? 'text-white bg-primary-700 hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                : 'text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
            }`}
            disabled={totalCount === 0 || isCancellationMode}
            title={isCancellationMode ? 'Exit cancellation mode to mark attendance' : ''}
          >
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            {isAttendanceMode ? 'Exit Attendance Mode' : 'Mark Attendance'}
          </button>
        </div>
      </div>

      {/* Show control panel only when in attendance mode */}
      {isAttendanceMode && (
        <>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left side - Selection info and controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Selection Counter */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm font-semibold">
                    {selectedCount} of {totalCount} selected
                  </div>
                </div>

                {/* Select All / Clear Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onSelectAll}
                    disabled={selectedCount === totalCount || isSubmitting}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

              {/* Right side - Action dropdown and buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Action Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Action:
                  </span>
                  <Select
                    value={action}
                    onValueChange={onSetAction}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mark_yes">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                          <span>Mark as Attended</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="mark_no">
                        <div className="flex items-center gap-2">
                          <XCircleIcon className="h-4 w-4 text-red-600" />
                          <span>Mark as Did Not Attend</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="unmark">
                        <div className="flex items-center gap-2">
                          <ArrowPathIcon className="h-4 w-4 text-gray-600" />
                          <span>Clear Attendance</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Apply Button */}
                <button
                  onClick={handleApplyAction}
                  disabled={selectedCount === 0 || isSubmitting}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
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
                      {getActionIcon()}
                      Apply to Selected ({selectedCount})
                    </>
                  )}
                </button>

                {/* Exit Attendance Mode Button */}
                <button
                  onClick={onToggleMode}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            action={action}
            actionLabel={getActionLabel()}
          />
        </>
      )}
    </>
  );
};

export default AttendanceControls;
