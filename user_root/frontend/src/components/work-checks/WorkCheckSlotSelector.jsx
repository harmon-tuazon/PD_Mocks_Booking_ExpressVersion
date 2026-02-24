/**
 * WorkCheckSlotSelector.jsx
 * Component to display and select work check slots
 * Supports group filtering and date grouping
 */
import React, { useMemo } from 'react';
import WorkCheckSlotCard from './WorkCheckSlotCard';

const WorkCheckSlotSelector = ({
  slots = [],
  groups = [],
  selectedSlot,
  selectedGroupFilter,
  existingBookingDates = [],
  loading,
  onSelectSlot,
  onClearSlot,
  onGroupFilterChange,
  onRefresh
}) => {
  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped = {};
    slots.forEach(slot => {
      const date = slot.slot_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    const sortedGrouped = {};
    sortedDates.forEach(date => {
      // Sort slots within each date by time
      grouped[date].sort((a, b) => a.slot_time.localeCompare(b.slot_time));
      sortedGrouped[date] = grouped[date];
    });

    return sortedGrouped;
  }, [slots]);

  // Helper to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return 'Today';
    }
    if (date.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if date has conflict
  const hasConflict = (dateString) => existingBookingDates.includes(dateString);

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Group filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Group:
          </label>
          <select
            value={selectedGroupFilter}
            onChange={(e) => onGroupFilterChange(e.target.value)}
            className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-dark-card dark:text-gray-100 text-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Groups</option>
            {groups.map(group => (
              <option key={group.group_id} value={group.group_id}>
                {group.group_name || group.group_id}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Selected slot indicator */}
      {selectedSlot && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Selected Slot
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {formatDate(selectedSlot.slot_date)} at {selectedSlot.slot_time} - {selectedSlot.end_time}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {selectedSlot.instructor_name} &bull; {selectedSlot.group_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClearSlot}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Slots list */}
      {Object.keys(slotsByDate).length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {Object.entries(slotsByDate).map(([date, dateSlots]) => (
            <div key={date}>
              {/* Date header */}
              <div className={`
                sticky top-0 z-10 px-4 py-2 mb-3 rounded-lg text-sm font-semibold
                ${hasConflict(date)
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                  : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300'}
              `}>
                <div className="flex items-center justify-between">
                  <span>{formatDate(date)}</span>
                  {hasConflict(date) && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Existing booking
                    </span>
                  )}
                </div>
              </div>

              {/* Slots for this date */}
              <div className="space-y-3">
                {dateSlots.map(slot => (
                  <WorkCheckSlotCard
                    key={slot.slot_id}
                    slot={slot}
                    isSelected={selectedSlot?.slot_id === slot.slot_id}
                    hasConflict={hasConflict(slot.slot_date)}
                    onSelect={() => onSelectSlot(slot)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Empty state when no slots available
 */
const EmptyState = () => (
  <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-8 text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full mb-4">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      No Available Slots
    </h3>
    <p className="text-gray-600 dark:text-gray-400">
      There are no work check slots available for your groups at this time.
      Please check back later or contact your administrator.
    </p>
  </div>
);

export default WorkCheckSlotSelector;
