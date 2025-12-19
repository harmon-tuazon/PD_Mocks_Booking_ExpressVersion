/**
 * BookingsTable Component
 * Displays booking data in a sortable, searchable, paginated table
 *
 * Enhanced with attendance marking:
 * - Attendance controls component
 * - Checkbox column (attendance mode only)
 * - Attendance status column (attendance mode only)
 * - Hide search in attendance mode
 * - Selection highlighting
 */

import { useState, useEffect } from 'react';
import BookingRow from './BookingRow';
import AttendanceControls from './AttendanceControls';
import CancellationControls from './CancellationControls';
import ColumnVisibilityControl from './ColumnVisibilityControl';
import { useColumnVisibility, TRAINEE_ONLY_COLUMNS } from '@/hooks/useColumnVisibility';
import { MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const BookingsTable = ({
  bookings,
  isLoading,
  error,
  searchTerm,
  onSearch,
  sortConfig,
  onSort,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  // Attendance marking props
  attendanceState = null,
  // Cancellation props
  cancellationState = null,
  // Hide search bar prop
  hideSearch = false,
  // Hide trainee info columns (name, email, student_id, dominant_hand)
  hideTraineeInfo = false
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');

  // Import column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    resetDefaults,
    isColumnVisible,
    getCellClasses,
    getHeaderClasses,
    getColumnOrder,
    columnDefinitions,
    fixedColumns
  } = useColumnVisibility();

  // Safeguard: ensure totalPages is a valid positive number
  const safeTotalPages = Math.max(1, Math.floor(totalPages) || 1);

  // Sync local search term with parent
  useEffect(() => {
    setLocalSearchTerm(searchTerm || '');
  }, [searchTerm]);

  // Handle search input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        onSearch(localSearchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchTerm, searchTerm, onSearch]);

  // Get sort icon for column
  const getSortIcon = (column) => {
    if (sortConfig.column !== column) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Get column definition by id
  const getColumnDef = (columnId) => {
    const allColumns = [...fixedColumns, ...columnDefinitions];
    return allColumns.find(col => col.id === columnId);
  };

  // Sortable header component with dynamic sizing
  const SortableHeader = ({ column, children, align = 'left' }) => {
    const headerClasses = getHeaderClasses();
    const baseClasses = `${headerClasses} text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap`;

    // Get column definition for min-width
    const columnDef = getColumnDef(column);
    const minWidth = columnDef?.minWidth || 'auto';

    const headerStyle = {
      minWidth
    };

    return (
      <th
        scope="col"
        className={`${baseClasses} text-${align}`}
        style={headerStyle}
        onClick={() => onSort(column)}
      >
        <div className={`flex items-center ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
          {children}
          {getSortIcon(column)}
        </div>
      </th>
    );
  };

  // Non-sortable header with dynamic sizing
  const NonSortableHeader = ({ column, children, align = 'left' }) => {
    const headerClasses = getHeaderClasses();

    // Get column definition for min-width
    const columnDef = column ? getColumnDef(column) : null;
    const minWidth = columnDef?.minWidth || 'auto';

    return (
      <th
        scope="col"
        className={`${headerClasses} text-${align} text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap`}
        style={{ minWidth }}
      >
        {children}
      </th>
    );
  };

  // Calculate pagination info (20 items per page to match pagination)
  const itemsPerPage = 20;
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {/* Search bar skeleton */}
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md w-full md:w-80"></div>

          {/* Table skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {error.message || 'Failed to load bookings'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Defensive: Ensure bookings is an array
  const safeBookings = Array.isArray(bookings) ? bookings : [];

  // Extract attendance props if provided
  const isAttendanceMode = attendanceState?.isAttendanceMode || false;
  const attendanceData = attendanceState || {};

  // Extract cancellation props if provided
  const isCancellationMode = cancellationState?.isCancellationMode || false;
  const cancellationData = cancellationState || {};

  // Determine which mode is active (they're mutually exclusive)
  const isSelectionMode = isAttendanceMode || isCancellationMode;

  // Get all column IDs for trainee view (show all columns + trainee-only columns)
  const traineeViewColumns = [
    ...TRAINEE_ONLY_COLUMNS.map(col => col.id),
    ...columnDefinitions.map(col => col.id)
  ];

  return (
    <div>
      {/* Attendance Controls (only shown in admin view for mock exam management) */}
      {attendanceState && !hideTraineeInfo && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <AttendanceControls
            isAttendanceMode={attendanceData.isAttendanceMode}
            isSubmitting={attendanceData.isSubmitting}
            selectedCount={attendanceData.selectedCount}
            selectableCount={attendanceData.selectableCount}
            attendedCount={attendanceData.attendedCount}
            noShowCount={attendanceData.noShowCount}
            unmarkedCount={attendanceData.unmarkedCount}
            totalCount={attendanceData.totalCount}
            action={attendanceData.action}
            onToggleMode={attendanceData.onToggleMode}
            onSelectAll={attendanceData.onSelectAll}
            onClearAll={attendanceData.onClearAll}
            onSetAction={attendanceData.onSetAction}
            onApplyAction={attendanceData.onApplyAction}
            onCancelBookings={attendanceData.onCancelBookings}
            isCancellationMode={isCancellationMode}
            onExportCSV={attendanceData.onExportCSV}
            isExporting={attendanceData.isExporting}
            exportDisabled={attendanceData.exportDisabled}
          />

          {/* Cancellation Controls (shown only when in cancellation mode, below the badges) */}
          {cancellationState && isCancellationMode && (
            <div className="mt-4">
              <CancellationControls
                isCancellationMode={cancellationData.isCancellationMode}
                isSubmitting={cancellationData.isSubmitting}
                selectedCount={cancellationData.selectedCount}
                cancellableCount={cancellationData.cancellableCount}
                totalCount={cancellationData.totalCount}
                onToggleMode={cancellationData.onToggleMode}
                onSelectAll={cancellationData.onSelectAll}
                onClearAll={cancellationData.onClearAll}
                onOpenModal={cancellationData.onOpenModal}
              />
            </div>
          )}
        </div>
      )}

      {/* Search Bar and Column Visibility Control */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Search Bar (hidden when hideSearch is true OR in selection modes) */}
          {!hideSearch && !isSelectionMode ? (
            <div className="relative md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                placeholder="Search by name, email, or student ID..."
                className="pl-10"
              />
            </div>
          ) : (
            <div /> // Empty div to maintain flex layout
          )}

          {/* Column Visibility Control (only shown for admin view) */}
          {!hideTraineeInfo && (
            <ColumnVisibilityControl
              columns={columnDefinitions}
              visibleColumns={visibleColumns}
              onToggleColumn={toggleColumn}
              onResetDefaults={resetDefaults}
            />
          )}
        </div>
      </div>

      {/* Empty State */}
      {safeBookings.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No bookings found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search criteria' : 'No bookings have been made for this exam yet'}
          </p>
        </div>
      )}

      {/* Table - with horizontal scroll */}
      {safeBookings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {/* Checkbox column (selection modes) */}
                {isSelectionMode && (
                  <NonSortableHeader align="center">
                    <Checkbox disabled className="opacity-0" />
                  </NonSortableHeader>
                )}

                {/* Admin view: Render fixed columns + visible dynamic columns */}
                {!hideTraineeInfo && getColumnOrder().map(columnId => {
                  const columnDef = getColumnDef(columnId);
                  if (!columnDef) return null;

                  // Skip dynamic columns that aren't visible
                  if (!columnDef.fixed && !isColumnVisible(columnId)) {
                    return null;
                  }

                  // All columns based on ID
                  switch (columnId) {
                    case 'time':
                    case 'attendance':
                    case 'status':
                      // Non-sortable columns
                      return (
                        <NonSortableHeader key={columnId} column={columnId} align="center">
                          {columnDef.label}
                        </NonSortableHeader>
                      );
                    default:
                      // Sortable columns (including name, email, student_id)
                      return (
                        <SortableHeader key={columnId} column={columnId} align="center">
                          {columnDef.label}
                        </SortableHeader>
                      );
                  }
                })}

                {/* Trainee view: Show trainee-only columns + all standard columns */}
                {hideTraineeInfo && [...TRAINEE_ONLY_COLUMNS, ...columnDefinitions].map(columnDef => {
                  // Render based on column type
                  switch (columnDef.id) {
                    case 'time':
                    case 'attendance':
                    case 'status':
                    case 'mock_type':
                    case 'mock_set':
                      // Non-sortable columns
                      return (
                        <NonSortableHeader key={columnDef.id} column={columnDef.id} align="center">
                          {columnDef.label}
                        </NonSortableHeader>
                      );
                    default:
                      return (
                        <SortableHeader key={columnDef.id} column={columnDef.id} align="center">
                          {columnDef.label}
                        </SortableHeader>
                      );
                  }
                })}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
              {safeBookings.map((booking) => {
                // Determine selection state and handler based on active mode
                let isSelected = false;
                let onToggleSelection = null;
                let isDisabled = false;

                if (isAttendanceMode) {
                  isSelected = attendanceData.isSelected?.(booking.id) || false;
                  onToggleSelection = attendanceData.onToggleSelection;
                } else if (isCancellationMode) {
                  isSelected = cancellationData.isSelected?.(booking.id) || false;
                  onToggleSelection = cancellationData.toggleSelection;
                  // Disable if booking is already cancelled
                  isDisabled = !cancellationData.canCancel?.(booking.id);
                }

                return (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    isAttendanceMode={isAttendanceMode}
                    isCancellationMode={isCancellationMode}
                    isSelected={isSelected}
                    onToggleSelection={onToggleSelection}
                    isDisabled={isDisabled}
                    hideTraineeInfo={hideTraineeInfo}
                    visibleColumns={hideTraineeInfo ? traineeViewColumns : visibleColumns}
                    columnOrder={hideTraineeInfo ? traineeViewColumns : getColumnOrder()}
                    sizeClass={getCellClasses()}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls - outside horizontal scroll */}
      {safeBookings.length > 0 && (
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
              disabled={currentPage === safeTotalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span>
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
                {[...Array(Math.min(5, safeTotalPages))].map((_, index) => {
                  let pageNumber;
                  if (safeTotalPages <= 5) {
                    pageNumber = index + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = index + 1;
                  } else if (currentPage >= safeTotalPages - 2) {
                    pageNumber = safeTotalPages - 4 + index;
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
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === safeTotalPages}
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
}

export default BookingsTable;
