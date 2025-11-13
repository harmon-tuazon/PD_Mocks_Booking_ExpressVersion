import React from 'react';
import { XMarkIcon, PowerIcon } from '@heroicons/react/24/outline';

/**
 * Toolbar component that replaces FilterBar when sessions are selected
 * Shows selection count and controls for managing bulk selections
 */
const MockExamsSelectionToolbar = ({
  selectedCount,
  totalCount,
  onClearAll,
  onExitMode,
  onToggleActiveStatus,
  selectedSessions,
  isSubmitting
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-all duration-200">
      <div className="px-4 py-3 flex items-center justify-between" style={{ height: '64px' }}>
        {/* Left side - Selection count and clear */}
        <div className="flex items-center space-x-4">
          {/* Selection count */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedCount} of {totalCount} sessions selected
            </span>
          </div>

          {/* Clear selection button */}
          {selectedCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Toggle Active Status Button */}
          {selectedCount > 0 && (
            <button
              onClick={onToggleActiveStatus}
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600'
                  : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900'
              }`}
              aria-label="Toggle active status for selected sessions"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <PowerIcon className="h-4 w-4 mr-2" />
              )}
              Toggle Active Status
            </button>
          )}

          {/* Exit selection mode button */}
          <button
            onClick={onExitMode}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
                       text-gray-700 bg-white border border-gray-300
                       hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                       dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600
                       dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900
                       transition-colors"
            aria-label="Exit selection mode"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Exit Selection Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default MockExamsSelectionToolbar;