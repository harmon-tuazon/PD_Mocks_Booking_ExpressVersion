import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ClockIcon } from '@heroicons/react/24/outline';
import SessionRow from './SessionRow';
import { useFetchAggregateSessions } from '../../hooks/useFetchAggregateSessions';
import { formatDateLong } from '../../utils/dateUtils';

/**
 * Determine the aggregate status based on all sessions within the aggregate
 * @param {Array} sessions - Array of session objects
 * @returns {Object|null} Status object with type, label, and color
 */
const determineAggregateStatus = (sessions) => {
  if (!sessions || sessions.length === 0) return null;

  // Collect all unique statuses
  const statuses = new Set(sessions.map(s => s.is_active));

  // If all sessions have the same status
  if (statuses.size === 1) {
    const status = sessions[0].is_active;
    if (status === 'active') {
      return { type: 'all_active', label: 'All Active', color: 'green' };
    } else if (status === 'inactive') {
      return { type: 'all_inactive', label: 'All Inactive', color: 'gray' };
    } else if (status === 'scheduled') {
      return { type: 'all_scheduled', label: 'All Scheduled', color: 'blue' };
    }
  }

  // Mixed statuses
  return { type: 'mixed', label: 'Mixed Status', color: 'yellow' };
};

const AggregateRow = ({
  aggregate,
  onView,
  isSelectionMode = false,
  onToggleSelection,
  isSelected
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if sessions are preloaded in the aggregate data
  const hasPreloadedSessions = Boolean(aggregate.sessions);

  // Only use lazy loading if sessions are not preloaded
  const {
    data: sessionsData,
    isLoading,
    isError,
    error,
    refetch
  } = useFetchAggregateSessions(
    aggregate.aggregate_key,
    {
      enabled: isExpanded && !hasPreloadedSessions // Only fetch if expanded AND no preloaded data
    }
  );

  // Use preloaded sessions if available, otherwise fall back to fetched data
  const sessions = hasPreloadedSessions ? aggregate.sessions : sessionsData?.sessions;

  // Determine loading state (only show loading if we're actually fetching)
  const showLoading = !hasPreloadedSessions && isExpanded && isLoading;

  // Determine error state (only show error if we're fetching and there's an error)
  const showError = !hasPreloadedSessions && isExpanded && isError;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Calculate the aggregate status from sessions
  const aggregateStatus = determineAggregateStatus(sessions);

  return (
    <>
      {/* Aggregate Row - Clickable Header */}
      <tr
        onClick={handleToggle}
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors"
      >
        {/* Type Column */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0" />
            )}
            <span className="font-semibold text-gray-900 dark:text-white">
              {aggregate.mock_type}
            </span>
          </div>
        </td>

        {/* Location Column */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0 text-primary-600 dark:text-primary-400">
              <path fill="currentColor" d="M12 21.325q-.35 0-.7-.125t-.625-.375Q9.05 19.325 7.8 17.9t-2.087-2.762t-1.275-2.575T4 10.2q0-3.75 2.413-5.975T12 2t5.588 2.225T20 10.2q0 1.125-.437 2.363t-1.275 2.575T16.2 17.9t-2.875 2.925q-.275.25-.625.375t-.7.125M12 12q.825 0 1.413-.587T14 10t-.587-1.412T12 8t-1.412.588T10 10t.588 1.413T12 12"/>
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {aggregate.location}
            </span>
          </div>
        </td>

        {/* Status Column */}
        <td className="px-6 py-4">
          {aggregateStatus ? (
            <div className="flex items-center gap-2">
              {/* Status icon based on type */}
              {aggregateStatus.type === 'all_scheduled' ? (
                <ClockIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : aggregateStatus.type === 'all_active' ? (
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0" />
              ) : aggregateStatus.type === 'all_inactive' ? (
                <div className="h-2.5 w-2.5 rounded-full bg-gray-400 flex-shrink-0" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
              )}
              {/* Status label */}
              <span className={`text-xs font-medium ${
                aggregateStatus.color === 'green' ? 'text-green-700 dark:text-green-400' :
                aggregateStatus.color === 'gray' ? 'text-gray-500 dark:text-gray-400' :
                aggregateStatus.color === 'blue' ? 'text-blue-700 dark:text-blue-400' :
                'text-yellow-700 dark:text-yellow-400'
              }`}>
                {aggregateStatus.label}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">--</span>
          )}
        </td>

        {/* Date Column */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="flex-shrink-0 text-primary-600 dark:text-primary-400">
              <path fill="currentColor" d="M12 14q-.425 0-.712-.288T11 13t.288-.712T12 12t.713.288T13 13t-.288.713T12 14m-4 0q-.425 0-.712-.288T7 13t.288-.712T8 12t.713.288T9 13t-.288.713T8 14m8 0q-.425 0-.712-.288T15 13t.288-.712T16 12t.713.288T17 13t-.288.713T16 14m-4 4q-.425 0-.712-.288T11 17t.288-.712T12 16t.713.288T13 17t-.288.713T12 18m-4 0q-.425 0-.712-.288T7 17t.288-.712T8 16t.713.288T9 17t-.288.713T8 18m8 0q-.425 0-.712-.288T15 17t.288-.712T16 16t.713.288T17 17t-.288.713T16 18M5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V2h2v2h8V2h2v2h1q.825 0 1.413.588T21 6v14q0 .825-.587 1.413T19 22zm0-2h14V10H5z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatDateLong(aggregate.exam_date)}
            </span>
          </div>
        </td>

        {/* Sessions Count Column */}
        <td className="px-6 py-4">
          <span className="inline-flex items-center justify-center min-w-[90px] px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
            {aggregate.session_count} {aggregate.session_count === 1 ? 'session' : 'sessions'}
          </span>
        </td>
      </tr>

      {/* Expanded Sessions */}
      {isExpanded && (
        <tr>
          <td colSpan="5" className="p-0">
            <div className="bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
              {showLoading ? (
                <div className="py-8 text-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading sessions...
                  </div>
                </div>
              ) : showError ? (
                <div className="py-8 text-center">
                  <div className="text-red-600 dark:text-red-400 mb-2">
                    Failed to load sessions
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {error?.message || 'An error occurred while loading sessions'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      refetch();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : Array.isArray(sessions) && sessions.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {sessions.map(session => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        nested={true}
                        onView={onView}
                        isSelectionMode={isSelectionMode}
                        onToggleSelection={onToggleSelection}
                        isSelected={isSelected ? isSelected(session.id) : false}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No sessions found for this aggregate
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AggregateRow;