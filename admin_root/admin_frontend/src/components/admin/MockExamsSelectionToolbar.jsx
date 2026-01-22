import React from 'react';
import { XMarkIcon, PowerIcon, TrashIcon, PencilSquareIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

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
  onBulkEdit,
  onClone,
  onDeleteSessions,
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
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
                  : 'text-gray-700 bg-white border-gray-500 hover:bg-gray-50 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-300 dark:focus:ring-offset-gray-900'
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

          {/* Bulk Edit Button */}
          {selectedCount > 0 && (
            <button
              onClick={onBulkEdit}
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
                  : 'text-gray-700 bg-white border-gray-500 hover:bg-gray-50 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-300 dark:focus:ring-offset-gray-900'
              }`}
              aria-label="Bulk edit selected sessions"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <PencilSquareIcon className="h-4 w-4 mr-2" />
              )}
              Bulk Edit
            </button>
          )}

          {/* Clone Button */}
          {selectedCount > 0 && (
            <button
              onClick={onClone}
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
                  : 'text-gray-700 bg-white border-gray-500 hover:bg-gray-50 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-300 dark:focus:ring-offset-gray-900'
              }`}
              aria-label="Clone selected sessions"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
              )}
              Clone
            </button>
          )}

          {/* Delete Sessions Button */}
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSessions}
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
                  : 'text-red-700 bg-white border-red-500 hover:bg-red-50 hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:text-red-400 dark:bg-gray-800 dark:border-red-500 dark:hover:bg-gray-700 dark:hover:border-red-400 dark:focus:ring-offset-gray-900'
              }`}
              aria-label="Delete selected sessions"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <TrashIcon className="h-4 w-4 mr-2" />
              )}
              Delete Sessions
            </button>
          )}

          {/* Exit selection mode button - Icon only with tooltip */}
          <div className="group relative">
            <button
              onClick={onExitMode}
              className="inline-flex items-center justify-center p-2 text-sm font-medium rounded-md
                         text-gray-700 bg-white border-2 border-gray-500
                         hover:bg-gray-50 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
                         dark:text-gray-200 dark:bg-gray-800 dark:border-gray-400
                         dark:hover:bg-gray-700 dark:hover:border-gray-300 dark:focus:ring-offset-gray-900
                         transition-colors"
              aria-label="Exit selection mode"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block">
              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1.5 px-3 shadow-lg whitespace-nowrap">
                Exit Selection Mode
                {/* Tooltip arrow */}
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockExamsSelectionToolbar;