import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import SessionRow from './SessionRow';
import { useFetchAggregateSessions } from '../../hooks/useFetchAggregateSessions';

const AggregateRow = ({ aggregate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Lazy load sessions only when expanded
  const { data: sessionsData, isLoading } = useFetchAggregateSessions(
    aggregate.aggregate_key,
    { enabled: isExpanded }
  );

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      {/* Aggregate Row - Clickable Header */}
      <tr
        onClick={handleToggle}
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors"
      >
        <td colSpan="8" className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-500 transition-transform" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-500 transition-transform" />
              )}

              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {aggregate.mock_type}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  📍 {aggregate.location} · 📅 {formatDate(aggregate.exam_date)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                {aggregate.session_count} {aggregate.session_count === 1 ? 'session' : 'sessions'}
              </span>
              {aggregate.total_capacity && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {aggregate.total_bookings || 0}/{aggregate.total_capacity} booked
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded Sessions */}
      {isExpanded && (
        <tr>
          <td colSpan="8" className="p-0">
            <div className="bg-gray-50 dark:bg-gray-900 border-l-4 border-blue-500">
              {isLoading ? (
                <div className="py-8 text-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading sessions...
                  </div>
                </div>
              ) : sessionsData?.sessions?.length > 0 ? (
                <table className="w-full">
                  <tbody>
                    {sessionsData.sessions.map(session => (
                      <SessionRow key={session.id} session={session} nested={true} />
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