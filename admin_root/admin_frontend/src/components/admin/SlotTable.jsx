/**
 * SlotTable Component
 * Table for displaying work check slots with selection, sorting, and pagination
 */

import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Pencil } from 'lucide-react';

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time for display
 */
const formatTime = (timeStr) => {
  if (!timeStr) return '-';
  // Handle both HH:MM:SS and HH:MM formats
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Status badge component
 */
const StatusBadge = ({ isActive, activationStatus }) => {
  if (activationStatus === 'scheduled') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
        Scheduled
      </span>
    );
  }

  return isActive ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
      Inactive
    </span>
  );
};

/**
 * Sort indicator component
 */
const SortIndicator = ({ column, currentSort }) => {
  const isActive = currentSort.sort_by === column;
  const isAsc = currentSort.sort_order === 'asc';

  if (!isActive) {
    // Show up-down arrows for inactive sortable columns
    return (
      <span className="ml-2 flex-none">
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </span>
    );
  }

  return (
    <span className="ml-2 flex-none">
      {isAsc ? (
        <ChevronUpIcon className="h-4 w-4 text-primary-600" />
      ) : (
        <ChevronDownIcon className="h-4 w-4 text-primary-600" />
      )}
    </span>
  );
};

/**
 * Table header cell component
 */
const TableHeader = ({ label, column, sortable, currentSort, onSort }) => {
  if (!sortable) {
    return (
      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </th>
    );
  }

  return (
    <th
      className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center justify-center">
        {label}
        <SortIndicator column={column} currentSort={currentSort} />
      </div>
    </th>
  );
};

/**
 * Loading skeleton row
 */
const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
    <td className="px-6 py-4"><div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
  </tr>
);

/**
 * Pagination component
 */
const Pagination = ({ currentPage, totalPages, totalItems, onPageChange }) => {
  const pages = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="bg-white dark:bg-dark-card px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Page <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span> ({totalItems} total)
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <ChevronUpIcon className="h-5 w-5 rotate-[-90deg]" />
            </button>
            {pages.map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  page === currentPage
                    ? 'z-10 bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'bg-white dark:bg-dark-card border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-card text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <ChevronDownIcon className="h-5 w-5 rotate-[-90deg]" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

/**
 * Main SlotTable component
 */
const SlotTable = ({
  data = [],
  isLoading = false,
  onSort,
  currentSort = { sort_by: 'slot_date', sort_order: 'asc' },
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange,
  onEdit,
  isSelectionMode = false,
  onToggleSelection,
  isSelected
}) => {
  return (
    <div className="bg-white dark:bg-dark-card shadow dark:shadow-gray-900/50 overflow-hidden sm:rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {/* Selection checkbox column - only visible in selection mode */}
              {isSelectionMode && (
                <th className="w-12 px-3 py-3">
                  {/* Checkbox column header - intentionally empty */}
                </th>
              )}
              <TableHeader label="Date" column="slot_date" sortable currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Time" column="slot_time" sortable currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Instructor" column="instructor_name" sortable={false} currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Groups" column="group_id" sortable currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Location" column="location" sortable currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Duration" column="duration" sortable={false} currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Status" column="status" sortable={false} currentSort={currentSort} onSort={onSort} />
              <TableHeader label="Auto-Approve" column="auto_approve" sortable={false} currentSort={currentSort} onSort={onSort} />
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
              <TableHeader label="Created At" column="created_at" sortable currentSort={currentSort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, idx) => <SkeletonRow key={idx} />)
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={isSelectionMode ? 11 : 10} className="px-6 py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No work check slots found</p>
                </td>
              </tr>
            ) : (
              // Data rows
              data.map((slot) => {
                const selected = isSelectionMode && isSelected?.(slot.id);
                return (
                <tr
                  key={slot.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                    selected ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-600 dark:border-primary-400' : ''
                  }`}
                  onClick={() => onToggleSelection?.(slot.id)}
                >
                  {/* Selection checkbox - only visible in selection mode */}
                  {isSelectionMode && (
                    <td className="w-12 px-3 py-4">
                      {selected && (
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(slot.slot_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatTime(slot.slot_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {slot.instructor_name || '-'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {slot.instructor_email || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        {slot.group_id?.length || 0} group(s)
                      </span>
                      {slot.group_id?.length > 0 && (
                        <div className="group relative">
                          <span className="text-xs text-gray-500 dark:text-gray-400 cursor-help">ℹ️</span>
                          <div className="absolute z-10 hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 -top-2 left-6 whitespace-nowrap">
                            {slot.group_id.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {slot.location || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {slot.duration_minutes} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge isActive={slot.is_active} activationStatus={slot.activation_status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {slot.auto_approve !== false ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit?.(slot)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                      title="Edit slot"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {slot.created_at ? formatDate(slot.created_at) : '-'}
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && data.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};

export default SlotTable;
