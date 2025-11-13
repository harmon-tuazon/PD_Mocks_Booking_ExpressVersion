import React from 'react';
import { EyeIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';
import { formatDateShort } from '../../utils/dateUtils';
import { formatTorontoDateTime } from '../../utils/dateTimeUtils';

const SessionRow = ({
  session,
  nested = false,
  onView,
  isSelectionMode = false,
  onToggleSelection,
  isSelected = false
}) => {

  // Format ISO timestamp to readable time (e.g., "2:00 PM")
  const formatTime = (timeString) => {
    if (!timeString) return '--';

    try {
      // If it's already formatted (e.g., "2:00 PM"), return as-is
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString;
      }

      // Parse ISO timestamp (e.g., "2025-09-26T16:00:00Z")
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return timeString;

      // Format to readable time
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', timeString, error);
      return timeString;
    }
  };

  // Handle row click for selection
  const handleRowClick = (e) => {
    // Don't toggle if clicking the View button
    if (e.target.closest('button[aria-label="View exam details"]')) {
      e.stopPropagation();
      return;
    }

    // Always allow selection (not gated by isSelectionMode)
    // The hook will handle entering selection mode on first selection
    onToggleSelection?.(session.id);
  };

  // Build row classes with selection styling
  const rowClasses = nested
    ? `border-b border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 cursor-pointer
       ${isSelected ? 'border-2 !border-primary-600 dark:!border-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''}`
    : `border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer
       ${isSelected ? 'border-2 !border-primary-600 dark:!border-primary-400 bg-primary-50 dark:bg-primary-900/20' : ''}`;

  // If nested (inside aggregate), show simplified view
  if (nested) {
    return (
      <tr className={rowClasses} onClick={handleRowClick}>
        {/* Empty column for alignment with aggregate Type column */}
        <td className="px-6 py-3">
          <div className="pl-8">
            {/* Active/Inactive/Scheduled Indicator with Checkbox */}
            <div className="flex items-center gap-3">
              {/* Checkbox - only visible when selected */}
              {isSelected && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // Controlled by row click
                  onClick={(e) => e.stopPropagation()} // Prevent double toggle
                  className="h-4 w-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                />
              )}

              {/* Status indicator - handle three states: active, inactive, scheduled */}
              {session.is_active === 'scheduled' ? (
                <>
                  <ClockIcon className="h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                      Scheduled
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTorontoDateTime(session.scheduled_activation_datetime)}
                    </span>
                  </div>
                </>
              ) : session.is_active === 'true' ? (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    Active
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Inactive
                  </span>
                </>
              )}
            </div>
          </div>
        </td>

        {/* Empty column for alignment with aggregate Location column */}
        <td className="px-6 py-3">
          {/* Time slot */}
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <div className="text-sm text-gray-900 dark:text-white font-medium">
              {formatTime(session.start_time)} - {formatTime(session.end_time)}
            </div>
          </div>
        </td>

        {/* Empty column for alignment with aggregate Date column */}
        <td className="px-6 py-3">
          {/* Capacity */}
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-gray-400" />
            <div className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {session.total_bookings || 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                /{session.capacity || 0}
              </span>
            </div>
          </div>
        </td>

        {/* Sessions Count column becomes Utilization for nested rows */}
        <td className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 mr-4">
              <div className="w-full max-w-[100px] bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${session.utilization_rate >= 80
                      ? 'bg-red-500'
                      : session.utilization_rate >= 50
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                  style={{ width: `${session.utilization_rate || 0}%` }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {session.utilization_rate || 0}%
              </span>
            </div>

            {/* Actions */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView?.(session);
              }}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-md transition-colors"
              aria-label="View exam details"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              View
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Regular list view (not nested)
  return (
    <tr className={rowClasses} onClick={handleRowClick}>
      {/* Type Column */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Checkbox - only visible when selected */}
          {isSelected && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}} // Controlled by row click
              onClick={(e) => e.stopPropagation()} // Prevent double toggle
              className="h-4 w-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
            />
          )}

          {/* Status indicator - handle three states: active, inactive, scheduled */}
          {session.is_active === 'scheduled' ? (
            <ClockIcon className="h-4 w-4 text-blue-500" title={`Scheduled: ${formatTorontoDateTime(session.scheduled_activation_datetime)}`} />
          ) : session.is_active === 'true' ? (
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
          )}

          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {session.mock_type}
            </div>
            {session.is_active === 'scheduled' && session.scheduled_activation_datetime && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Activates: {formatTorontoDateTime(session.scheduled_activation_datetime)}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Date Column */}
      <td className="px-6 py-3">
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDateShort(session.exam_date)}
        </div>
      </td>

      {/* Time Column */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-gray-400" />
          <div className="text-sm text-gray-900 dark:text-white">
            {formatTime(session.start_time)} - {formatTime(session.end_time)}
          </div>
        </div>
      </td>

      {/* Location Column */}
      <td className="px-6 py-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {session.location || '--'}
        </div>
      </td>

      {/* Capacity Column */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="w-4 h-4 text-gray-400" />
          <div className="text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              {session.total_bookings || 0}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              /{session.capacity || 0}
            </span>
          </div>
        </div>
      </td>

      {/* Utilization Column */}
      <td className="px-6 py-3">
        <div className="flex items-center">
          <div className="w-full max-w-[100px] bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${session.utilization_rate >= 80
                  ? 'bg-red-500'
                  : session.utilization_rate >= 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              style={{ width: `${session.utilization_rate || 0}%` }}
            ></div>
          </div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {session.utilization_rate || 0}%
          </span>
        </div>
      </td>

      {/* Actions Column */}
      <td className="px-6 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.(session);
          }}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-md transition-colors"
          aria-label="View exam details"
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </button>
      </td>
    </tr>
  );
};

export default SessionRow;
