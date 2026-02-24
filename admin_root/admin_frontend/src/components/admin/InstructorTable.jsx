/**
 * InstructorTable Component
 * Displays instructors in a sortable, paginated table with actions
 */

import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, UserIcon } from '@heroicons/react/24/outline';
import { Pencil } from 'lucide-react';

const InstructorTable = ({
  data,
  isLoading,
  onSort,
  currentSort,
  // Pagination props
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  // Action handlers
  onEdit,
  onToggleStatus,
  isTogglingStatus,
  // Selection props
  isSelectionMode = false,
  onToggleSelection,
  isSelected
}) => {
  const navigate = useNavigate();

  // Calculate pagination display values
  const itemsPerPage = 50;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getSortIcon = (column) => {
    if (currentSort?.sort_by !== column) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return currentSort.sort_order === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const SortableHeader = ({ column, children, align = 'center' }) => (
    <th
      scope="col"
      className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${align === 'left' ? 'text-left' : 'text-center'}`}
      onClick={() => onSort?.(column)}
    >
      <div className={`flex items-center ${align === 'left' ? 'justify-start' : 'justify-center'}`}>
        {children}
        {getSortIcon(column)}
      </div>
    </th>
  );

  const getStatusBadge = (isActive) => {
    const statusStyles = isActive
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles}`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Parse YYYY-MM-DD parts directly to avoid timezone offset shifting the day
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle row click for selection
  const handleRowClick = (e, instructor) => {
    // Don't toggle selection if clicking on Edit button or its children
    const clickedElement = e.target;
    const isButtonClick = clickedElement.closest('button');

    if (isButtonClick) {
      return; // Let the button handle its own click
    }

    // Always allow selection toggle - hook handles auto-enter of selection mode
    if (onToggleSelection) {
      onToggleSelection(instructor.id || instructor.instructor_id);
    }
  };

  // Get row classes based on selection state
  const getRowClasses = (instructor) => {
    const instructorId = instructor.id || instructor.instructor_id;
    const selected = isSelected?.(instructorId);

    const baseClasses = 'transition-colors';
    // Always show cursor-pointer when selection is available
    const hoverClasses = onToggleSelection ? 'cursor-pointer' : '';

    if (selected) {
      return `${baseClasses} ${hoverClasses} border-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20`;
    }

    return `${baseClasses} ${hoverClasses} hover:bg-gray-50 dark:hover:bg-gray-800/50`;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-card shadow overflow-hidden sm:rounded-lg">
        <div className="animate-pulse p-6">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-card shadow overflow-hidden sm:rounded-lg">
        <div className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No instructors found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters or create a new instructor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card shadow overflow-hidden sm:rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {isSelectionMode && (
                <th scope="col" className="w-12 px-3 py-3">
                  {/* Checkbox column header - intentionally empty */}
                </th>
              )}
              <SortableHeader column="instructor_name" align="left">Name</SortableHeader>
              <SortableHeader column="email" align="left">Email</SortableHeader>
              <SortableHeader column="is_active">Status</SortableHeader>
              <SortableHeader column="created_at">Created</SortableHeader>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((instructor) => {
              const instructorId = instructor.id || instructor.instructor_id;
              const selected = isSelectionMode && isSelected?.(instructorId);

              return (
                <tr
                  key={instructorId}
                  className={getRowClasses(instructor)}
                  onClick={(e) => handleRowClick(e, instructor)}
                >
                  {isSelectionMode && (
                    <td className="w-12 px-3 py-4">
                      {selected && (
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {instructor.instructor_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => navigate(`/work-check/instructors/${instructor.id}`)}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:underline"
                        >
                          {instructor.instructor_name}
                        </button>
                        {instructor.instructor_id && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            ID: {instructor.instructor_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {instructor.email || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(instructor.is_active)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(instructor.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center">
                      {/* Edit button */}
                      <button
                        onClick={() => onEdit?.(instructor)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                        title="Edit instructor"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="bg-white dark:bg-dark-card px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span> of{' '}
                <span className="font-medium">{totalItems}</span> instructors
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Page numbers */}
                {[...Array(Math.min(5, totalPages))].map((_, index) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = index + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = index + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + index;
                  } else {
                    pageNumber = currentPage - 2 + index;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => onPageChange(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNumber
                          ? 'z-10 bg-primary-50 dark:bg-primary-900/30 border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorTable;
