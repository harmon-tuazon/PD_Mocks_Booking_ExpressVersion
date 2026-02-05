/**
 * WorkCheckBookingAggregatesTable Component
 * Display aggregated bookings with expandable rows
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PencilIcon } from '@heroicons/react/24/outline';
import WorkCheckBookingStatusBadge from './WorkCheckBookingStatusBadge';

/**
 * Format date for display
 */
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
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
            <th scope="col" className="w-10 px-4 py-3"></th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Time
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Location
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Instructors
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Bookings
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          {formatDate(aggregate.slot_date)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          {formatTime(aggregate.slot_time)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          {aggregate.location}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          <span className="group relative cursor-help">
            {aggregate.instructor_names?.length || 0} instructor{(aggregate.instructor_names?.length || 0) !== 1 ? 's' : ''}
            {aggregate.instructor_names?.length > 0 && (
              <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-10 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md py-1 px-2 whitespace-nowrap">
                {aggregate.instructor_names.join(', ')}
              </span>
            )}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {aggregate.total_bookings} booking{aggregate.total_bookings !== 1 ? 's' : ''}
          </span>
          {aggregate.pending_count > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
              ({aggregate.pending_count} pending)
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
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

      {/* Expanded Bookings */}
      {isExpanded && bookings.length > 0 && (
        <>
          {/* Header row for nested bookings */}
          <tr className="bg-gray-100 dark:bg-gray-800/50">
            <td className="px-4 py-2"></td>
            <td colSpan="6" className="px-4 py-2">
              <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <div className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => el && (el.indeterminate = someSelected && !allSelected)}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                <div className="flex-1">Student</div>
                <div className="w-32">Instructor</div>
                <div className="w-24">Status</div>
                <div className="w-24">Type</div>
                <div className="w-20">Actions</div>
              </div>
            </td>
          </tr>

          {/* Individual booking rows */}
          {bookings.map((booking) => (
            <tr
              key={booking.id}
              className="bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-700/50"
            >
              <td className="px-4 py-2"></td>
              <td colSpan="6" className="px-4 py-2">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(booking.id)}
                      onChange={() => onToggleSelection(booking.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {booking.student_name || 'Unknown'}
                    </span>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      ({booking.student_id})
                    </span>
                  </div>
                  <div className="w-32 text-gray-600 dark:text-gray-300 truncate">
                    {booking.instructor_name || '-'}
                  </div>
                  <div className="w-24">
                    <WorkCheckBookingStatusBadge status={booking.status} />
                  </div>
                  <div className="w-24">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      booking.type === 'Work Check'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : booking.type === 'Demo'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {booking.type || 'Work Check'}
                    </span>
                  </div>
                  <div className="w-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBooking(booking);
                      }}
                      className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
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
      )}
    </>
  );
};

export default WorkCheckBookingAggregatesTable;
