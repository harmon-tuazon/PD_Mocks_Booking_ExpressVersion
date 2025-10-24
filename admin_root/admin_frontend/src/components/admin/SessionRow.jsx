import React from 'react';
import StatusBadge from './StatusBadge';
import { EyeIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

const SessionRow = ({ session, nested = false, onView }) => {
  // Format Unix timestamp to date string
  const formatDate = (timestamp) => {
    if (!timestamp) return '--';
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format Unix timestamp to time string
  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const rowClasses = nested
    ? "border-b border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800"
    : "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800";

  return (
    <tr className={rowClasses}>
      {/* Type Column */}
      <td className={`px-6 py-3 ${nested ? 'pl-12' : ''}`}>
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {session.mock_type}
        </div>
      </td>

      {/* Date Column */}
      <td className="px-6 py-3">
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(session.exam_date)}
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

      {/* Status Column */}
      <td className="px-6 py-3">
        <StatusBadge status={session.status || 'inactive'} />
      </td>

      {/* Actions Column */}
      <td className="px-6 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.(session);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
          title="View session details"
        >
          <EyeIcon className="w-4 h-4" />
          <span>View</span>
        </button>
      </td>
    </tr>
  );
};

export default SessionRow;