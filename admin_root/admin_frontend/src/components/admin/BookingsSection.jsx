import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import BookingsTable from './BookingsTable';
import BookingFilters from './BookingFilters';
import useBatchCancellation from '../../hooks/useBatchCancellation';
import CancelBookingsModal from '../shared/CancelBookingsModal';
import { traineeApi } from '../../services/adminApi';

/**
 * LoadingSkeleton Component
 * Shows loading state for bookings table
 */
const LoadingSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
    </div>
  );
};

/**
 * BookingsSection Component
 * Wrapper component for bookings table with summary badges
 * Handles loading, error, and empty states
 */
const BookingsSection = ({ bookings, summary, loading, error, onRefresh }) => {
  // State for active filters
  const [filters, setFilters] = useState({
    locations: [],
    attendance: [],
    mockTypes: [],
    dateFrom: null,
    dateTo: null,
    status: 'All'
  });

  // State for sorting
  const [sortConfig, setSortConfig] = useState({
    column: 'booking_date',
    direction: 'desc'
  });

  // Cancellation functionality
  const cancellationState = useBatchCancellation(bookings || []);

  // Sort handler
  const handleSort = (column) => {
    setSortConfig(prevConfig => ({
      column,
      direction:
        prevConfig.column === column && prevConfig.direction === 'asc'
          ? 'desc'
          : 'asc'
    }));
  };

  // Handle booking cancellation using simplified batch endpoint
  const handleCancelBookings = async () => {
    const selectedBookings = bookings.filter(booking =>
      cancellationState?.isSelected?.(booking.id)
    );

    cancellationState?.startSubmitting?.();

    try {
      // Use authenticated API method
      const result = await traineeApi.batchCancelBookings(
        selectedBookings.map(b => ({
          id: b.id,
          student_id: b.student_id || b.associated_contact_id || b.contact_id,
          email: b.email,
          reason: 'Admin cancelled from trainee dashboard'
        }))
      );

      if (!result.success) {
        throw new Error(result.error || 'Cancellation failed');
      }

      // Show success message
      toast.success(`Successfully cancelled ${result.data.summary.successful} booking(s)`, { duration: 4000 });

      // Show warning if partial failure
      if (result.data.summary.failed > 0) {
        toast.warning(`${result.data.summary.failed} booking(s) could not be cancelled`, { duration: 6000 });
      }

      cancellationState?.closeModal?.();
      cancellationState?.toggleMode?.(); // Exit cancellation mode
      if (onRefresh) {
        onRefresh(); // Refresh booking data
      }
    } catch (error) {
      cancellationState?.returnToSelecting?.();

      const errorMessage = error.message || 'Failed to cancel bookings';
      toast.error(`Cancellation Failed: ${errorMessage}`, { duration: 6000 });
      console.error('Failed to cancel bookings:', error);
    }
  };

  // Client-side filtering and sorting logic
  const processedBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];

    // Step 1: Filter bookings
    const filteredBookings = bookings.filter(booking => {
      // Location filter
      if (filters.locations.length > 0 && !filters.locations.includes(booking.attending_location)) {
        return false;
      }

      // Attendance filter
      if (filters.attendance.length > 0) {
        // Map booking.attendance value to filter values
        let attendanceValue = 'Unmarked';
        if (booking.attendance === 'Yes' || booking.attendance === true) {
          attendanceValue = 'Yes';
        } else if (booking.attendance === 'No' || booking.attendance === false) {
          attendanceValue = 'No';
        }

        if (!filters.attendance.includes(attendanceValue)) {
          return false;
        }
      }

      // Mock type filter
      if (filters.mockTypes.length > 0 && !filters.mockTypes.includes(booking.mock_exam_type)) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom && booking.exam_date) {
        const examDate = new Date(booking.exam_date);
        const fromDate = new Date(filters.dateFrom);
        if (examDate < fromDate) {
          return false;
        }
      }
      if (filters.dateTo && booking.exam_date) {
        const examDate = new Date(booking.exam_date);
        const toDate = new Date(filters.dateTo);
        // Set to end of day for the to date
        toDate.setHours(23, 59, 59, 999);
        if (examDate > toDate) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'All') {
        // Map booking status to filter values
        let bookingStatus = 'Active';
        if (booking.is_active === false || booking.is_cancelled === true) {
          bookingStatus = 'Cancelled';
        } else if (booking.exam_date) {
          // Check if exam date is in the past
          const examDate = new Date(booking.exam_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (examDate < today) {
            bookingStatus = 'Completed';
          }
        }

        if (filters.status !== bookingStatus) {
          return false;
        }
      }

      return true;
    });

    // Step 2: Sort filtered bookings
    const sortedBookings = [...filteredBookings].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.column) {
        case 'mock_exam_type':
          aValue = (a.mock_exam_type || '').toLowerCase();
          bValue = (b.mock_exam_type || '').toLowerCase();
          break;
        case 'exam_date':
          aValue = new Date(a.exam_date || 0);
          bValue = new Date(b.exam_date || 0);
          break;
        case 'attending_location':
          aValue = (a.attending_location || '').toLowerCase();
          bValue = (b.attending_location || '').toLowerCase();
          break;
        case 'dominant_hand':
          aValue = (a.dominant_hand || '').toLowerCase();
          bValue = (b.dominant_hand || '').toLowerCase();
          break;
        case 'token_used':
          aValue = (a.token_used || '').toLowerCase();
          bValue = (b.token_used || '').toLowerCase();
          break;
        case 'booking_date':
        default:
          aValue = new Date(a.booking_date || 0);
          bValue = new Date(b.booking_date || 0);
          break;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sortedBookings;
  }, [bookings, filters, sortConfig]);

  // Calculate counts
  const totalBookings = bookings?.length || 0;
  const filteredCount = processedBookings.length;
  const hasActiveFilters = filters.locations.length > 0 || 
                          filters.attendance.length > 0 || 
                          filters.mockTypes.length > 0 || 
                          filters.dateFrom || 
                          filters.dateTo || 
                          filters.status !== 'All';

  // Calculate pagination values (20 items per page)
  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredCount / itemsPerPage));

  return (
    <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg p-6">
      {/* Header with title */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Booking History {hasActiveFilters ? `(${filteredCount} of ${totalBookings})` : `(${totalBookings})`}
        </h2>
      </div>

      {/* Booking Filters with Cancel Button */}
      {!loading && !error && bookings && bookings.length > 0 && (
        <BookingFilters
          bookings={bookings}
          filters={filters}
          onFiltersChange={setFilters}
          className="mb-6"
          cancelButton={
            <button
              onClick={() => cancellationState?.toggleMode()}
              className={`inline-flex h-9 items-center whitespace-nowrap px-2 py-1.5 text-xs font-medium rounded-md transition-colors shadow-sm ${
                cancellationState?.isCancellationMode
                  ? 'text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                  : 'text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
              }`}
              disabled={processedBookings.length === 0}
            >
              <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {cancellationState?.isCancellationMode ? 'Exit Cancel Mode' : 'Cancel Bookings'}
            </button>
          }
        />
      )}

      {/* Cancellation Selection Banner */}
      {!loading && !error && bookings && bookings.length > 0 && cancellationState?.isCancellationMode && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {cancellationState?.selectedCount || 0} of {processedBookings.length} selected
              </span>
              <button
                onClick={() => cancellationState?.selectAll?.(processedBookings)}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Select All
              </button>
              <button
                onClick={() => cancellationState?.clearAll?.()}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cancellationState?.openModal?.()}
                disabled={cancellationState?.selectedCount === 0}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Cancel Selected ({cancellationState?.selectedCount || 0})
              </button>
              <button
                onClick={() => cancellationState?.toggleMode?.()}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Exit
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Note: Only active bookings can be cancelled. Already cancelled bookings are disabled.
          </p>
        </div>
      )}

      {/* Content Area */}
      {loading && <LoadingSkeleton />}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-sm text-red-800 dark:text-red-300">
            {error.message || 'Failed to load booking history'}
          </p>
        </div>
      )}

      {!loading && !error && bookings && bookings.length === 0 && (
        <div className="flex items-center justify-center py-16 min-h-[300px]">
          <p className="text-gray-500 dark:text-gray-400">
            No bookings found for this trainee
          </p>
        </div>
      )}

      {!loading && !error && bookings && bookings.length > 0 && processedBookings.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-16 min-h-[300px]">
          <p className="text-gray-500 dark:text-gray-400">
            No bookings match the selected filters
          </p>
          <button
            onClick={() => setFilters({
              locations: [],
              attendance: [],
              mockTypes: [],
              dateFrom: null,
              dateTo: null,
              status: 'All'
            })}
            className="mt-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Clear all filters
          </button>
        </div>
      )}

      {!loading && !error && processedBookings.length > 0 && (
        <div>
          <BookingsTable
            bookings={processedBookings}
            totalPages={totalPages}
            totalItems={filteredCount}
            hideTraineeInfo={true}  // Hide trainee columns in trainee dashboard view
            hideSearch={true}  // Hide search bar in trainee dashboard view
            // Pass empty attendance and cancellation states since we're in read-only mode
            attendanceState={{
              isAttendanceMode: false,
              selectedIds: [],
              selectedCount: 0,
              action: '',
              attendedCount: summary?.attended || 0,
              noShowCount: summary?.no_show || 0,
              unmarkedCount: summary?.unmarked || 0
            }}
            cancellationState={cancellationState}
            onSort={handleSort}  // Enable sorting in trainee dashboard view
            sortConfig={sortConfig}
            currentPage={1}
            onPageChange={() => {}} // No pagination in this context (showing all bookings)
          />
        </div>
      )}

      {/* Cancel Bookings Modal */}
      <CancelBookingsModal
        isOpen={cancellationState?.isModalOpen || false}
        onClose={cancellationState?.closeModal}
        onConfirm={handleCancelBookings}
        selectedBookings={bookings.filter(b => cancellationState?.isSelected?.(b.id))}
        isLoading={cancellationState?.isSubmitting || false}
        refundTokens={cancellationState?.refundTokens ?? true}
        onToggleRefund={cancellationState?.toggleRefund}
      />
    </div>
  );
};

export default BookingsSection;