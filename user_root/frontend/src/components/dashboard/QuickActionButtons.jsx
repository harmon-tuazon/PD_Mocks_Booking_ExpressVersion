/**
 * QuickActionButtons.jsx
 * Card-based action buttons for quick booking access
 * Styled to match ExamTypeSelector cards with PrepDoctors fonts
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
      description: 'Test your situational decision-making skills.',
      icon: '/assets/SJ-icon.svg',
      href: '/book/exams?type=Situational%20Judgment',
      tokenKey: 'sj_credits',
      duration: '2 hours 30 mins'
    },
    {
      id: 'cs',
      label: 'CS',
      fullLabel: 'Clinical Skills',
      description: 'Demonstrate your practical clinical abilities.',
      icon: '/assets/CS-icon.svg',
      href: '/book/exams?type=Clinical%20Skills',
      tokenKey: 'cs_credits',
      duration: '8 hours 30 mins'
    },
    {
      id: 'mini',
      label: 'Mini',
      fullLabel: 'Mini-mock',
      description: 'Quick practice to prepare for full exams.',
      icon: '/assets/minimock-icon.svg',
      href: '/book/exams?type=Mini-mock',
      tokenKey: 'sjmini_credits',
      duration: '1 hour 30 mins'
    },
    {
      id: 'discussion',
      label: 'Discussion',
      fullLabel: 'Mock Discussion',
      description: 'Interactive discussion session with feedback.',
      icon: '/assets/discussion-icon.svg',
      href: '/book/discussions',
      tokenKey: 'mock_discussion_token',
      duration: '1 hour'
    },
    {
      id: 'workcheck',
      label: 'Work Check',
      fullLabel: 'Work Check',
      description: 'Schedule a work check session.',
      icon: '/assets/workcheck-icon.svg',
      href: '/book/work-check',
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
      {/* Section header */}
      <div className="text-center mb-4 md:mb-6">
        <h2 className="font-headline text-lg md:text-xl font-bold text-primary-900 dark:text-gray-100 mb-1">
          Quick Actions
        </h2>
        <p className="font-body text-xs md:text-sm text-primary-700 dark:text-gray-400">
          Tap any card below to start booking
        </p>
      </div>

      {/* Cards Grid - responsive layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {quickActions.map((action, index) => (
          <div
            key={action.id}
            className="card-hover dark:bg-dark-card dark:border-dark-border dark:hover:border-dark-border animate-slide-up p-3 md:p-4 cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate(action.href)}
          >
            <div className="text-center">
              {/* Icon */}
              <div className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 md:mb-3 flex items-center justify-center">
                <img
                  src={action.icon}
                  alt={`${action.fullLabel} icon`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>

              {/* Title */}
              <h3 className="font-subheading text-sm md:text-base font-semibold text-primary-900 dark:text-gray-100 mb-1">
                {action.fullLabel}
              </h3>

              {/* Description - hidden on mobile */}
              <p className="hidden md:block font-body text-xs text-primary-700 dark:text-gray-400 mb-2 leading-relaxed">
                {action.description}
              </p>

              {/* Duration or Group count */}
              <div className="font-body text-[10px] md:text-xs text-primary-600 dark:text-gray-500 mb-2">
                {action.duration ? (
                  <div className="flex items-center justify-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>{action.duration}</span>
                  </div>
                ) : (
                  <span>{getTokenValue(action)}</span>
                )}
              </div>

              {/* Token badge for exam types */}
              {action.tokenKey && (
                <div className="mb-2">
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] md:text-xs font-medium rounded-full ${
                    (tokens[action.tokenKey] || 0) > 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400'
                  }`}>
                    {tokens[action.tokenKey] || 0} tokens
                  </span>
                </div>
              )}

              {/* Button */}
              <button className="btn-primary w-full text-[10px] md:text-xs py-1.5 md:py-2 dark:bg-primary-600 dark:hover:bg-primary-700">
                Book Now
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickActionButtons;
