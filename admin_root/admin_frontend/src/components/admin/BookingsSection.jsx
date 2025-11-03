import React from 'react';
import BookingsTable from './BookingsTable';

/**
 * AttendanceBadges Component
 * Displays attendance summary badges (internal component)
 */
const AttendanceBadges = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="flex items-center gap-3">
      {/* Attended Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
        <span className="text-sm font-semibold text-green-700 dark:text-green-300">
          {summary.attended || 0} Attended
        </span>
      </div>

      {/* No Show Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
        <span className="text-sm font-semibold text-red-700 dark:text-red-300">
          {summary.no_show || 0} No Show
        </span>
      </div>

      {/* Unmarked Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {summary.unmarked || 0} Unmarked
        </span>
      </div>
    </div>
  );
};

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
const BookingsSection = ({ bookings, summary, loading, error }) => {
  // Calculate total bookings from summary or bookings array
  const totalBookings = summary?.total_bookings || bookings?.length || 0;

  // Calculate pagination values (20 items per page)
  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalBookings / itemsPerPage));

  return (
    <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg p-6">
      {/* Header with title and badges */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Booking History ({totalBookings})
        </h2>
        {summary && <AttendanceBadges summary={summary} />}
      </div>

      {/* Content Area */}
      {loading && <LoadingSkeleton />}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-sm text-red-800 dark:text-red-300">
            {error.message || 'Failed to load booking history'}
          </p>
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            No bookings found for this trainee
          </p>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <div className="overflow-x-auto">
          <BookingsTable
            bookings={bookings}
            totalPages={totalPages}
            totalItems={totalBookings}
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
            cancellationState={{
              isCancellationMode: false,
              selectedIds: [],
              selectedCount: 0
            }}
            onSort={() => {}} // No sorting in trainee dashboard view
            sortConfig={{ column: 'created_at', direction: 'desc' }}
            searchTerm=""
            onSearch={() => {}} // No search in this context
            currentPage={1}
            onPageChange={() => {}} // No pagination in this context (showing all bookings)
          />
        </div>
      )}
    </div>
  );
};

export default BookingsSection;