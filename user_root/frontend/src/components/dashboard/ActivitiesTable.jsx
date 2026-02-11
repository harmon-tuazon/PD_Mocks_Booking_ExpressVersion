/**
 * ActivitiesTable.jsx
 * Compact table/list view of upcoming activities (from today, max 15 items)
 * Mobile-first design with date grouping and status badges
 */
import React from 'react';

const ActivitiesTable = ({ activities = [] }) => {

  // Helper function to check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Helper function to format date for display
  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (isToday(dateString)) {
      return 'Today';
    }
    if (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Tomorrow';
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dayNames[date.getDay()]} - ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Helper function to format time
  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeString;
    }
  };

  // Group activities by date
  const groupActivitiesByDate = (activities) => {
    const grouped = {};
    activities.forEach(activity => {
      const dateKey = activity.exam_date || activity.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(activity);
    });

    // Sort dates
    const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    const sortedGrouped = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  const groupedByDate = groupActivitiesByDate(activities);

  // Get status display
  const getStatusDisplay = (activity) => {
    const status = activity.is_active || activity.status || 'Active';
    const isConfirmed = status === 'Active' || status === 'Confirmed' || status === 'confirmed';
    return {
      text: isConfirmed ? 'Confirmed' : 'Pending',
      className: isConfirmed
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    };
  };

  // Get activity type display
  const getActivityDisplay = (activity) => {
    const type = activity.mock_type || activity.type || 'Mock Exam';
    const isWorkCheck = type.toLowerCase().includes('work') || activity.type === 'work_check';

    return {
      label: isWorkCheck ? 'Work Check' : type,
      icon: isWorkCheck ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bgColor: isWorkCheck
        ? 'bg-green-100 dark:bg-green-900/30'
        : 'bg-primary-100 dark:bg-primary-900/30',
      textColor: isWorkCheck
        ? 'text-green-600 dark:text-green-400'
        : 'text-primary-600 dark:text-primary-400'
    };
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <h3 className="font-subheading text-sm font-semibold text-primary-900 dark:text-gray-100">
          Upcoming Activities
        </h3>
      </div>

      {/* Content */}
      {activities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="divide-y dark:divide-dark-border">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className={`
                px-4 py-2 text-xs font-medium uppercase tracking-wide
                ${isToday(date)
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-gray-400'}
              `}>
                {formatShortDate(date)}
              </div>

              {/* Activity rows */}
              {items.map((activity, idx) => {
                const activityDisplay = getActivityDisplay(activity);
                const statusDisplay = getStatusDisplay(activity);

                return (
                  <div
                    key={activity.id || `${date}-${idx}`}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Type indicator */}
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${activityDisplay.bgColor}
                      `}>
                        <span className={activityDisplay.textColor}>
                          {activityDisplay.icon}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {activityDisplay.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(activity.start_time)}
                          {activity.attending_location && ` • ${activity.attending_location}`}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full flex-shrink-0
                      ${statusDisplay.className}
                    `}>
                      {statusDisplay.text}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Empty state component when no activities
 */
const EmptyState = () => (
  <div className="p-6 text-center">
    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-dark-hover rounded-full mb-3">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
      No upcoming activities
    </p>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Book a mock exam or work check to get started
    </p>
  </div>
);

export default ActivitiesTable;
