/**
 * WorkCheckBookingAggregatesTable Component
 * Display aggregated bookings with expandable rows
 * Styled to match Mocks Dashboard table
 */

import { ChevronDownIcon, ChevronRightIcon, PencilIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import WorkCheckBookingStatusBadge from './WorkCheckBookingStatusBadge';

/**
 * Pagination component (matches SlotTable)
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
              <ChevronLeftIcon className="h-5 w-5" />
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
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

/**
 * Location pin icon component (exact match from Mocks Dashboard AggregateRow.jsx)
 */
const LocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
       className="flex-shrink-0 text-primary-600 dark:text-primary-400">
    <path fill="currentColor" d="M12 21.325q-.35 0-.7-.125t-.625-.375Q9.05 19.325 7.8 17.9t-2.087-2.762t-1.275-2.575T4 10.2q0-3.75 2.413-5.975T12 2t5.588 2.225T20 10.2q0 1.125-.437 2.363t-1.275 2.575T16.2 17.9t-2.875 2.925q-.275.25-.625.375t-.7.125M12 12q.825 0 1.413-.587T14 10t-.587-1.412T12 8t-1.412.588T10 10t.588 1.413T12 12"/>
  </svg>
);

/**
 * Calendar icon component (exact match from Mocks Dashboard AggregateRow.jsx)
 */
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
       className="flex-shrink-0 text-primary-600 dark:text-primary-400">
    <path fill="currentColor" d="M12 14q-.425 0-.712-.288T11 13t.288-.712T12 12t.713.288T13 13t-.288.713T12 14m-4 0q-.425 0-.712-.288T7 13t.288-.712T8 12t.713.288T9 13t-.288.713T8 14m8 0q-.425 0-.712-.288T15 13t.288-.712T16 12t.713.288T17 13t-.288.713T16 14m-4 4q-.425 0-.712-.288T11 17t.288-.712T12 16t.713.288T13 17t-.288.713T12 18m-4 0q-.425 0-.712-.288T7 17t.288-.712T8 16t.713.288T9 17t-.288.713T8 18m8 0q-.425 0-.712-.288T15 17t.288-.712T16 16t.713.288T17 17t-.288.713T16 18M5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V2h2v2h8V2h2v2h1q.825 0 1.413.588T21 6v14q0 .825-.587 1.413T19 22zm0-2h14V10H5z"/>
  </svg>
);

/**
 * Format date for display (with full weekday)
 */
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time for display
 */
const formatTime = (timeString) => {
  if (!timeString) return '-';
  // Handle both HH:MM:SS and HH:MM formats
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const WorkCheckBookingAggregatesTable = ({
  aggregates,
  expandedKeys,
  onToggleExpand,
  selectedIds,
  onToggleSelection,
  onSelectAllInAggregate,
  onEditBooking,
  isLoading,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange
}) => {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-card shadow rounded-lg p-8">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading bookings...</span>
        </div>
      </div>
    );
  }

  if (!aggregates || aggregates.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-card shadow rounded-lg p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No bookings found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="w-10 px-4 py-4"></th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Time
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Location
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Instructors
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Bookings
            </th>
            <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Groups
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
          {aggregates.map((aggregate) => {
            const isExpanded = expandedKeys.has(aggregate.aggregate_key);
            const bookings = aggregate.bookings || [];
            const allSelected = bookings.length > 0 && bookings.every(b => selectedIds.has(b.id));
            const someSelected = bookings.some(b => selectedIds.has(b.id));

            return (
              <AggregateRowWithBookings
                key={aggregate.aggregate_key}
                aggregate={aggregate}
                isExpanded={isExpanded}
                onToggleExpand={() => onToggleExpand(aggregate.aggregate_key)}
                bookings={bookings}
                selectedIds={selectedIds}
                onToggleSelection={onToggleSelection}
                onSelectAllInAggregate={onSelectAllInAggregate}
                onEditBooking={onEditBooking}
                allSelected={allSelected}
                someSelected={someSelected}
              />
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
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

/**
 * Aggregate row with nested bookings
 */
const AggregateRowWithBookings = ({
  aggregate,
  isExpanded,
  onToggleExpand,
  bookings,
  selectedIds,
  onToggleSelection,
  onSelectAllInAggregate,
  onEditBooking,
  allSelected,
  someSelected
}) => {
  const handleSelectAll = (e) => {
    e.stopPropagation();
    const bookingIds = bookings.map(b => b.id);
    onSelectAllInAggregate(bookingIds, !allSelected);
  };

  return (
    <>
      {/* Aggregate Summary Row */}
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-4">
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <CalendarIcon />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatDate(aggregate.slot_date)}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatTime(aggregate.slot_time)}
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <LocationIcon />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {aggregate.location || '-'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">
          <span className="group relative cursor-help">
            {aggregate.instructor_names?.length || 0} instructor{(aggregate.instructor_names?.length || 0) !== 1 ? 's' : ''}
            {aggregate.instructor_names?.length > 0 && (
              <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap">
                {aggregate.instructor_names.join(', ')}
              </span>
            )}
          </span>
        </td>
        <td className="px-6 py-4 text-center">
          <span className="inline-flex items-center justify-center min-w-[90px] px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
            {aggregate.total_bookings} booking{aggregate.total_bookings !== 1 ? 's' : ''}
          </span>
        </td>
        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-300">
          <span className="group relative cursor-help">
            {aggregate.groups?.length || 0} group{(aggregate.groups?.length || 0) !== 1 ? 's' : ''}
            {aggregate.groups?.length > 0 && (
              <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap max-w-xs">
                {aggregate.groups.slice(0, 5).join(', ')}{aggregate.groups.length > 5 ? '...' : ''}
              </span>
            )}
          </span>
        </td>
      </tr>

      {/* Expanded Bookings - Only show pending, confirmed, marked, completed */}
      {isExpanded && bookings.length > 0 && (() => {
        // Filter to only show pending, confirmed, marked, and completed bookings
        const visibleBookings = bookings.filter(b =>
          ['pending', 'confirmed', 'marked', 'completed'].includes(b.status?.toLowerCase())
        );

        if (visibleBookings.length === 0) return null;

        const visibleAllSelected = visibleBookings.every(b => selectedIds.has(b.id));
        const visibleSomeSelected = visibleBookings.some(b => selectedIds.has(b.id));

        return (
          <>
            {/* Header row for nested bookings */}
            <tr className="bg-gray-100 dark:bg-gray-800/50">
              <td className="px-4 py-3"></td>
              <td colSpan="6" className="px-6 py-3">
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  <div className="col-span-1 flex items-center justify-center">
                    {visibleSomeSelected && (
                      <input
                        type="checkbox"
                        checked={visibleAllSelected}
                        ref={(el) => el && (el.indeterminate = visibleSomeSelected && !visibleAllSelected)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const visibleIds = visibleBookings.map(b => b.id);
                          onSelectAllInAggregate(visibleIds, !visibleAllSelected);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    )}
                  </div>
                  <div className="col-span-1">Name</div>
                  <div className="col-span-1">Student ID</div>
                  <div className="col-span-1">Instructor</div>
                  <div className="col-span-1">Lab</div>
                  <div className="col-span-1">Seat</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Actions</div>
                </div>
              </td>
            </tr>

            {/* Individual booking rows */}
            {visibleBookings.map((booking) => {
              const isSelected = selectedIds.has(booking.id);
              return (
                <tr
                  key={booking.id}
                  className={`bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                  onClick={() => onToggleSelection(booking.id)}
                >
                  <td className="px-4 py-3"></td>
                  <td colSpan="6" className="px-6 py-3">
                    <div className="grid grid-cols-12 gap-3 items-center text-sm text-center">
                      <div className="col-span-1 flex justify-center">
                        {isSelected && (
                          <input
                            type="checkbox"
                            checked={true}
                            readOnly
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        )}
                      </div>
                      <div className="col-span-1 font-medium text-gray-900 dark:text-gray-100 truncate">
                        {booking.student_name || 'Unknown'}
                      </div>
                      <div className="col-span-1 text-gray-600 dark:text-gray-400 truncate">
                        {booking.student_id || '-'}
                      </div>
                      <div className="col-span-1 text-gray-600 dark:text-gray-300 truncate">
                        {booking.instructor_name || '-'}
                      </div>
                      <div className="col-span-1 text-gray-600 dark:text-gray-400">
                        {booking.lab || '-'}
                      </div>
                      <div className="col-span-1 text-gray-600 dark:text-gray-400">
                        {booking.seat || '-'}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <WorkCheckBookingStatusBadge status={booking.status} />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          booking.type === 'Work Check'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : booking.type === 'Demo'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                        }`}>
                          {booking.type || 'Work Check'}
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditBooking({
                              ...booking,
                              slot: {
                                slot_date: aggregate.slot_date,
                                slot_time: aggregate.slot_time,
                                location: aggregate.location,
                                instructor_name: aggregate.instructor_names?.[0] || null
                              }
                            });
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                          title="Edit booking"
                        >
                          <PencilIcon className="h-4 w-4 mr-1" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </>
        );
      })()}
    </>
  );
};

export default WorkCheckBookingAggregatesTable;
