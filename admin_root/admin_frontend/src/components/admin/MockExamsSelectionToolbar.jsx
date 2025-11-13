import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Toolbar component that replaces FilterBar when sessions are selected
 * Shows selection count and controls for managing bulk selections
 */
const MockExamsSelectionToolbar = ({
  selectedCount,
  totalCount,
  onClearAll,
  onExitMode
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-all duration-200">
      <div className="px-4 py-3 flex items-center justify-between" style={{ height: '64px' }}>
        {/* Left side - Selection count and actions */}
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

          {/* Placeholder for future bulk action buttons (Phase 2) */}
          <div className="flex items-center space-x-2">
            {/* Bulk action buttons will be added here in Phase 2 */}
            {/* Examples: Cancel Sessions, Update Status, Export, etc. */}
          </div>
        </div>

        {/* Right side - Exit selection mode */}
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
  );
};

export default MockExamsSelectionToolbar;