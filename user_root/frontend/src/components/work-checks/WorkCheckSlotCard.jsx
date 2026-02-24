/**
 * WorkCheckSlotCard.jsx
 * Individual slot display card
 */
import React from 'react';

const WorkCheckSlotCard = ({
  slot,
  isSelected,
  hasConflict,
  onSelect
}) => {
  const isAvailable = slot.is_available && !hasConflict;

  // Format time for display
  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  return (
    <div
      onClick={isAvailable ? onSelect : undefined}
      className={`
        relative p-4 rounded-lg border transition-all duration-200
        ${isSelected
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500'
          : isAvailable
            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-card hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md cursor-pointer'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-hover opacity-60 cursor-not-allowed'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Time icon */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
            ${isSelected
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-primary-100 dark:bg-primary-900/30'}
          `}>
            <svg className={`w-5 h-5 ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-primary-600 dark:text-primary-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Slot details */}
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {formatTime(slot.slot_time)} - {formatTime(slot.end_time)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {slot.instructor_name}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Group badge */}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                {slot.group_name || slot.group_id}
              </span>
              {/* Location badge */}
              {slot.location && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {slot.location}
                </span>
              )}
              {/* Duration badge */}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {slot.duration_minutes} min
              </span>
            </div>
          </div>
        </div>

        {/* Availability indicator */}
        <div className="text-right flex-shrink-0">
          {hasConflict ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Conflict
            </span>
          ) : slot.is_available ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {slot.available_slots} slot{slot.available_slots !== 1 ? 's' : ''} left
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              Full
            </span>
          )}

          {/* Auto-approve indicator */}
          {slot.auto_approve && isAvailable && (
            <div className="mt-2">
              <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Instant confirm
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkCheckSlotCard;
