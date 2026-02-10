/**
 * ThisWeekActivities.jsx
 * Shows upcoming activities for the current week
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ActivityCard from './ActivityCard';

const ThisWeekActivities = ({ activities = [], hasToday }) => {
  const navigate = useNavigate();

  // Group activities by date
  const groupedActivities = useMemo(() => {
    return activities.reduce((groups, activity) => {
      const date = activity.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    }, {});
  }, [activities]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedActivities).sort();
  }, [groupedActivities]);

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 mb-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100">
            This Week's Activities
          </h2>
        </div>
        <button
          onClick={() => navigate('/my-bookings')}
          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline flex items-center gap-1 transition-colors"
        >
          View All
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <EmptyActivities />
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date Header */}
              <div className={`flex items-center gap-2 mb-3 ${
                isToday(date) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                <span className="text-sm font-medium uppercase tracking-wide">
                  {isToday(date) ? 'TODAY - ' : ''}
                  {formatDate(date)}
                </span>
                {isToday(date) && (
                  <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    Today
                  </span>
                )}
              </div>

              {/* Activities for this date */}
              <div className="space-y-3">
                {groupedActivities[date].map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyActivities = () => (
  <div className="text-center py-12">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
      <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
      No activities scheduled this week
    </p>
    <p className="text-sm text-gray-500 dark:text-gray-500">
      Book a mock exam or work check to get started!
    </p>
  </div>
);

export default ThisWeekActivities;
