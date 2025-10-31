/**
 * CancellationControls Component
 * Control panel for batch booking cancellation functionality
 *
 * Features:
 * - Toggle cancellation mode button
 * - Selection counter
 * - Select All / Clear buttons
 * - Cancel Selected button
 * - Integration with CancelBookingsModal
 */

import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

const CancellationControls = ({
  isCancellationMode,
  isSubmitting,
  selectedCount,
  cancellableCount,
  totalCount,
  onToggleMode,
  onSelectAll,
  onClearAll,
  onOpenModal
}) => {
  // In cancellation mode - show full control panel
  if (isCancellationMode) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left side - Selection info and controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Selection Counter */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-sm font-semibold">
                {selectedCount} of {cancellableCount} selected
              </div>
            </div>

            {/* Select All / Clear Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectAll}
                disabled={selectedCount === cancellableCount || isSubmitting}
                className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Cancel Selected Button */}
            <button
              onClick={onOpenModal}
              disabled={selectedCount === 0 || isSubmitting}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cancelling...
                </>
              ) : (
                <>
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Cancel Selected ({selectedCount})
                </>
              )}
            </button>

            {/* Exit Cancellation Mode Button */}
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

        {/* Info Message */}
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">Note:</span> Only active bookings can be cancelled. Already cancelled bookings are disabled.
        </div>
      </div>
    );
  }

  // Not in cancellation mode - return null (button is in AttendanceControls)
  return null;
};

export default CancellationControls;