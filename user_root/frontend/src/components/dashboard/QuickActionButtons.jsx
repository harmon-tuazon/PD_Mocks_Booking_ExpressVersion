/**
 * QuickActionButtons.jsx
 * Horizontal scrollable action buttons for quick booking access
 * Mobile-first design with responsive grid on larger screens
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const QuickActionButtons = ({ tokens = {}, groupCount = 0 }) => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'sj',
      label: 'SJ',
      fullLabel: 'Situational Judgment',
      description: 'Book SJ Mock',
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: '/book/exams?type=Situational%20Judgment',
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
      textColor: 'text-primary-700 dark:text-primary-300',
      hoverBg: 'hover:bg-primary-200 dark:hover:bg-primary-900/50',
      tokenKey: 'sj_credits'
    },
    {
      id: 'cs',
      label: 'CS',
      fullLabel: 'Clinical Skills',
      description: 'Book CS Mock',
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      href: '/book/exams?type=Clinical%20Skills',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      textColor: 'text-teal-700 dark:text-teal-300',
      hoverBg: 'hover:bg-teal-200 dark:hover:bg-teal-900/50',
      tokenKey: 'cs_credits'
    },
    {
      id: 'mini',
      label: 'Mini',
      fullLabel: 'Mini-mock',
      description: 'Book Mini-mock',
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      href: '/book/exams?type=Mini-mock',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      textColor: 'text-amber-700 dark:text-amber-300',
      hoverBg: 'hover:bg-amber-200 dark:hover:bg-amber-900/50',
      tokenKey: 'sjmini_credits'
    },
    {
      id: 'workcheck',
      label: 'Work Check',
      fullLabel: 'Work Check',
      description: 'Book Work Check',
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      href: '/book/work-check',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-300',
      hoverBg: 'hover:bg-green-200 dark:hover:bg-green-900/50',
      showGroupCount: true
    }
  ];

  const getTokenValue = (action) => {
    if (action.showGroupCount) {
      return `${groupCount} group${groupCount !== 1 ? 's' : ''}`;
    }
    const value = tokens[action.tokenKey] || 0;
    return `${value} token${value !== 1 ? 's' : ''}`;
  };

  return (
    <div className="mb-6">
      {/* Section header with helpful copywriting */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Quick Actions
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          Tap to book
        </span>
      </div>

      {/* Mobile: Horizontal scroll */}
      <div className="md:hidden overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 pb-2">
          {quickActions.map(action => (
            <button
              key={action.id}
              onClick={() => navigate(action.href)}
              className={`
                flex-shrink-0 w-24 py-4 px-2
                ${action.bgColor} ${action.hoverBg}
                rounded-xl
                flex flex-col items-center justify-center
                gap-1.5
                shadow-sm
                active:scale-95
                transition-all duration-150
              `}
            >
              <span className={action.textColor}>{action.icon}</span>
              <span className={`text-xs font-semibold ${action.textColor}`}>
                {action.label}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {getTokenValue(action)}
              </span>
            </button>
          ))}
        </div>
        {/* Mobile scroll indicator */}
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-1">
          Swipe to see more
        </p>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden md:grid grid-cols-4 gap-4">
        {quickActions.map(action => (
          <button
            key={action.id}
            onClick={() => navigate(action.href)}
            className={`
              ${action.bgColor} ${action.hoverBg}
              rounded-xl p-4
              flex flex-col items-center justify-center
              gap-2
              shadow-sm hover:shadow-md
              transition-all duration-200
              group
            `}
          >
            <span className={`${action.textColor} group-hover:scale-110 transition-transform`}>
              {action.icon}
            </span>
            <span className={`text-sm font-semibold ${action.textColor}`}>
              {action.fullLabel}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getTokenValue(action)}
            </span>
            {/* Click hint on hover */}
            <span className="text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to book →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionButtons;
