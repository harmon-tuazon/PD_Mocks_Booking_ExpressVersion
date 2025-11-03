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
  attendanceProps = null,
  // Cancellation props
  cancellationProps = null
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');

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

  // Sortable header component
  const SortableHeader = ({ column, children, align = 'left' }) => (
    <th
      scope="col"
      className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''}`}>
        {children}
        {getSortIcon(column)}
      </div>
    </th>
  );

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
  const isAttendanceMode = attendanceProps?.isAttendanceMode || false;
  const attendanceState = attendanceProps || {};

  // Extract cancellation props if provided
  const isCancellationMode = cancellationProps?.isCancellationMode || false;
  const cancellationState = cancellationProps || {};

  // Determine which mode is active (they're mutually exclusive)
  const isSelectionMode = isAttendanceMode || isCancellationMode;

  return (
    <div>
      {/* Attendance Controls (badges and buttons always shown, control panel when in mode) */}
      {attendanceProps && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <AttendanceControls
            isAttendanceMode={attendanceState.isAttendanceMode}
            isSubmitting={attendanceState.isSubmitting}
            selectedCount={attendanceState.selectedCount}
            selectableCount={attendanceState.selectableCount}
            attendedCount={attendanceState.attendedCount}
            noShowCount={attendanceState.noShowCount}
            unmarkedCount={attendanceState.unmarkedCount}
            totalCount={attendanceState.totalCount}
            action={attendanceState.action}
            onToggleMode={attendanceState.onToggleMode}
            onSelectAll={attendanceState.onSelectAll}
            onClearAll={attendanceState.onClearAll}
            onSetAction={attendanceState.onSetAction}
            onApplyAction={attendanceState.onApplyAction}
            onCancelBookings={attendanceState.onCancelBookings}
            isCancellationMode={isCancellationMode}
          />

          {/* Cancellation Controls (shown only when in cancellation mode, below the badges) */}
          {cancellationProps && isCancellationMode && (
            <div className="mt-4">
              <CancellationControls
                isCancellationMode={cancellationState.isCancellationMode}
                isSubmitting={cancellationState.isSubmitting}
                selectedCount={cancellationState.selectedCount}
                cancellableCount={cancellationState.cancellableCount}
                totalCount={cancellationState.totalCount}
                onToggleMode={cancellationState.onToggleMode}
                onSelectAll={cancellationState.onSelectAll}
                onClearAll={cancellationState.onClearAll}
                onOpenModal={cancellationState.onOpenModal}
              />
            </div>
          )}
        </div>
      )}

      {/* Search Bar (hidden in selection modes) */}
      {!isSelectionMode && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
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
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {safeBookings.length === 0 ? (
          /* Empty State */
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
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {/* Checkbox column (selection modes) */}
                  {isSelectionMode && (
                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                      <Checkbox disabled className="opacity-0" />
                    </th>
                  )}

                  <SortableHeader column="name" align="center">Name</SortableHeader>
                  <SortableHeader column="email" align="center">Email</SortableHeader>
                  <SortableHeader column="student_id" align="center">Student ID</SortableHeader>
                  <SortableHeader column="dominant_hand" align="center">Dominant Hand</SortableHeader>

                  {/* Attendance status column - Always visible, moved before booking date */}
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Attendance
                  </th>

                  {/* Attending Location column */}
                  <SortableHeader column="attending_location" align="center">Attending Location</SortableHeader>

                  {/* Token Used column */}
                  <SortableHeader column="token_used" align="center">Token Used</SortableHeader>

                  {/* NDECC Exam Date column */}
                  <SortableHeader column="ndecc_exam_date" align="center">NDECC Exam Date</SortableHeader>

                  <SortableHeader column="created_at" align="center">Booking Date</SortableHeader>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                {safeBookings.map((booking) => {
                  // Determine selection state and handler based on active mode
                  let isSelected = false;
                  let onToggleSelection = null;
                  let isDisabled = false;

                  if (isAttendanceMode) {
                    isSelected = attendanceState.isSelected?.(booking.id) || false;
                    onToggleSelection = attendanceState.onToggleSelection;
                  } else if (isCancellationMode) {
                    isSelected = cancellationState.isSelected?.(booking.id) || false;
                    onToggleSelection = cancellationState.onToggleSelection;
                    // Disable if booking is already cancelled
                    isDisabled = !cancellationState.canCancel?.(booking.id);
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
                    />
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
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
          </>
        )}
      </div>
    </div>
  );
};

export default BookingsTable;