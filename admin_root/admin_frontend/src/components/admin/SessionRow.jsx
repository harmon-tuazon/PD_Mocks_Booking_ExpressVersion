import React from 'react';
import StatusBadge from './StatusBadge';
import { PencilIcon, TrashIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

const SessionRow = ({ session, nested = false, onEdit, onDelete }) => {
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
      <td className={`px-6 py-3 ${nested ? 'pl-12' : ''}`}>
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {session.mock_type}
        </div>
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-gray-400" />
          <div className="text-sm text-gray-900 dark:text-white">
            {formatTime(session.start_time)} - {formatTime(session.end_time)}
          </div>
        </div>
      </td>
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
      <td className="px-6 py-3">
        <StatusBadge status={session.status || 'inactive'} />
      </td>
      {!nested && (
        <td className="px-6 py-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {session.location}
          </div>
        </td>
      )}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(session);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
            title="Edit session"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(session);
            }}
            className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
            title="Delete session"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default SessionRow;