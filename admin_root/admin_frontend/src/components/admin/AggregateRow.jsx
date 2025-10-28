import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import SessionRow from './SessionRow';
import { useFetchAggregateSessions } from '../../hooks/useFetchAggregateSessions';
import { formatDateLong } from '../../utils/dateUtils';

const AggregateRow = ({ aggregate, onView }) => {
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
            <span className="flex-shrink-0 text-lg">📍</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {aggregate.location}
            </span>
          </div>
        </td>

        {/* Date Column */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-lg">📅</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatDateLong(aggregate.exam_date)}
            </span>
          </div>
        </td>

        {/* Sessions Count Column */}
        <td className="px-6 py-4">
          <span className="inline-flex items-center justify-center min-w-[120px] px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
            {aggregate.session_count} {aggregate.session_count === 1 ? 'session' : 'sessions'}
          </span>
        </td>
      </tr>

      {/* Expanded Sessions */}
      {isExpanded && (
        <tr>
          <td colSpan="4" className="p-0">
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