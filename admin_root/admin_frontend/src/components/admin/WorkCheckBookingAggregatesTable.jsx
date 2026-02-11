/**
 * WorkCheckBookingAggregatesTable Component
 * Display aggregated bookings with expandable rows
 * Styled to match Mocks Dashboard table
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PencilIcon } from '@heroicons/react/24/outline';
import WorkCheckBookingStatusBadge from './WorkCheckBookingStatusBadge';

/**
 * Location pin icon component (matches Mocks Dashboard)
 */
const LocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       className="flex-shrink-0 text-primary-600 dark:text-primary-400">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

/**
 * Calendar icon component (matches Mocks Dashboard)
 */
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
       className="flex-shrink-0 text-primary-600 dark:text-primary-400">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
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
  isLoading
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
            <th scope="col" className="w-12 px-6 py-4"></th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Time
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Location
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Instructors
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Bookings
            </th>
            <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
        <td className="px-6 py-4">
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarIcon />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatDate(aggregate.slot_date)}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatTime(aggregate.slot_time)}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <LocationIcon />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {aggregate.location || '-'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
          <span className="group relative cursor-help">
            {aggregate.instructor_names?.length || 0} instructor{(aggregate.instructor_names?.length || 0) !== 1 ? 's' : ''}
            {aggregate.instructor_names?.length > 0 && (
              <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-10 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap">
                {aggregate.instructor_names.join(', ')}
              </span>
            )}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex items-center justify-center min-w-[90px] px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
            {aggregate.total_bookings} booking{aggregate.total_bookings !== 1 ? 's' : ''}
          </span>
          {aggregate.pending_count > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium">
              {aggregate.pending_count} pending
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
          <span className="group relative cursor-help">
            {aggregate.groups?.length || 0} group{(aggregate.groups?.length || 0) !== 1 ? 's' : ''}
            {aggregate.groups?.length > 0 && (
              <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-10 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap max-w-xs">
                {aggregate.groups.slice(0, 5).join(', ')}{aggregate.groups.length > 5 ? '...' : ''}
              </span>
            )}
          </span>
        </td>
      </tr>

      {/* Expanded Bookings - Only show pending, confirmed, completed */}
      {isExpanded && bookings.length > 0 && (() => {
        // Filter to only show pending, confirmed, and completed bookings
        const visibleBookings = bookings.filter(b =>
          ['pending', 'confirmed', 'completed'].includes(b.status?.toLowerCase())
        );

        if (visibleBookings.length === 0) return null;

        const visibleAllSelected = visibleBookings.every(b => selectedIds.has(b.id));
        const visibleSomeSelected = visibleBookings.some(b => selectedIds.has(b.id));

        return (
          <>
            {/* Header row for nested bookings */}
            <tr className="bg-gray-100 dark:bg-gray-800/50">
              <td className="px-6 py-3"></td>
              <td colSpan="6" className="px-6 py-3">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="col-span-1 flex items-center">
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
                  </div>
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">Student ID</div>
                  <div className="col-span-2">Instructor</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-1">Actions</div>
                </div>
              </td>
            </tr>

            {/* Individual booking rows */}
            {visibleBookings.map((booking) => (
              <tr
                key={booking.id}
                className="bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-6 py-3"></td>
                <td colSpan="6" className="px-6 py-3">
                  <div className="grid grid-cols-12 gap-4 items-center text-sm">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(booking.id)}
                        onChange={() => onToggleSelection(booking.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>
                    <div className="col-span-3 font-medium text-gray-900 dark:text-gray-100 truncate">
                      {booking.student_name || 'Unknown'}
                    </div>
                    <div className="col-span-2 text-gray-600 dark:text-gray-400">
                      {booking.student_id || '-'}
                    </div>
                    <div className="col-span-2 text-gray-600 dark:text-gray-300 truncate">
                      {booking.instructor_name || '-'}
                    </div>
                    <div className="col-span-1">
                      <WorkCheckBookingStatusBadge status={booking.status} />
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        booking.type === 'Work Check'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : booking.type === 'Demo'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                      }`}>
                        {booking.type || 'Work Check'}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditBooking(booking);
                        }}
                        className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Edit booking"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </>
        );
      })()}
    </>
  );
};

export default WorkCheckBookingAggregatesTable;
