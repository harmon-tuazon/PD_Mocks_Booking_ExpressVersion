/**
 * WorkCheckBookingSelectionToolbar Component
 * Toolbar that appears when bookings are selected, showing bulk actions
 */

import { XMarkIcon, ArrowPathIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

const WorkCheckBookingSelectionToolbar = ({
  selectedCount,
  totalCount,
  onClearAll,
  onExitMode,
  onChangeStatus,
  onClone,
  onDelete,
  isSubmitting
}) => {
  const handleStatusChange = (value) => {
    if (value && onChangeStatus) {
      onChangeStatus(value);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-all duration-200 mb-6 rounded-lg">
      <div className="px-4 py-3 flex items-center justify-between" style={{ height: '64px' }}>
        {/* Left side - Selection count and clear */}
        <div className="flex items-center space-x-4">
          {/* Selection count */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedCount} of {totalCount} bookings selected
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
          {/* Change Status Dropdown */}
          {selectedCount > 0 && (
            <div className="flex items-center space-x-2">
              <Select
                onValueChange={handleStatusChange}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-[160px]">
                  <div className="flex items-center">
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Change Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              aria-label="Clone selected bookings"
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

          {/* Delete Button */}
          {selectedCount > 0 && (
            <button
              onClick={onDelete}
              disabled={isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border-2 transition-colors ${
                isSubmitting
                  ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500 dark:border-gray-500'
                  : 'text-red-600 bg-white border-red-500 hover:bg-red-50 hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:text-red-400 dark:bg-gray-800 dark:border-red-500 dark:hover:bg-red-900/20 dark:hover:border-red-400 dark:focus:ring-offset-gray-900'
              }`}
              aria-label="Delete selected bookings"
            >
              {isSubmitting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <TrashIcon className="h-4 w-4 mr-2" />
              )}
              Delete
            </button>
          )}

          {/* Exit selection mode button */}
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
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkCheckBookingSelectionToolbar;
