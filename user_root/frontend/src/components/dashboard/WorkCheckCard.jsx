/**
 * WorkCheckCard.jsx
 * Card for booking work checks with group display
 */
import React from 'react';

const WorkCheckCard = ({ groups = [], hasActiveGroups, onBook }) => {
  const activeGroups = groups.filter(g => g.status === 'active');

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
          <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100">
          Work Checks
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Schedule time with your instructor for work check sessions.
      </p>

      {hasActiveGroups ? (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Your Groups
            </p>
            <div className="flex flex-wrap gap-2">
              {activeGroups.slice(0, 3).map(group => (
                <span
                  key={group.group_id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                >
                  {group.group_id}
                </span>
              ))}
              {activeGroups.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                  +{activeGroups.length - 3} more
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onBook}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-dark-card"
          >
            Book Work Check
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-2 font-medium">
            You are not currently enrolled in any groups.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Contact support if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkCheckCard;
