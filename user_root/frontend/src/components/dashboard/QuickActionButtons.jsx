/**
 * QuickActionButtons.jsx
 * Card-based action buttons for quick booking access
 * Styled to match ExamTypeSelector cards with PrepDoctors fonts
 * Icons: SJ, CS, Mini-mock, Discussion, Work Check
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const QuickActionButtons = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'sj',
      fullLabel: 'Situational Judgment',
      icon: '/assets/SJ-icon.svg',
      href: '/book/exams?type=Situational%20Judgment'
    },
    {
      id: 'cs',
      fullLabel: 'Clinical Skills',
      icon: '/assets/CS-icon.svg',
      href: '/book/exams?type=Clinical%20Skills'
    },
    {
      id: 'mini',
      fullLabel: 'Mini-mock',
      icon: '/assets/minimock-icon.svg',
      href: '/book/exams?type=Mini-mock'
    },
    {
      id: 'discussion',
      fullLabel: 'Mock Discussion',
      icon: '/assets/discussion-icon.svg',
      href: '/book/discussions'
    },
    {
      id: 'workcheck',
      fullLabel: 'Work Check',
      icon: '/assets/workcheck-icon.svg',
      href: '/book/work-check'
    }
  ];

  return (
    <div className="mb-6">
      {/* Section header - left aligned */}
      <div className="mb-4 md:mb-6">
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
              <h3 className="font-subheading text-sm md:text-base font-semibold text-primary-900 dark:text-gray-100 mb-2">
                {action.fullLabel}
              </h3>

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
