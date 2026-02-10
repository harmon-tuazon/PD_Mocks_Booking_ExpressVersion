/**
 * QuickActionButtons.jsx
 * Card-based action buttons for quick booking access
 * Styled to match ExamTypeSelector cards with PrepDoctors fonts
 * Icons: SJ, CS, Mini-mock, Discussion, Work Check
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

// Inline SVG components for icons that may not load from files
const DiscussionIcon = () => (
  <svg viewBox="0 0 76.87 71.95" className="w-full h-full">
    <path
      fill="none"
      stroke="#0660b2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      d="M28.59,60.6a9.85,9.85,0,0,1,9.85,9.85V16.28a9.85,9.85,0,0,0-9.85-9.85H1.5V60.6Z"
    />
    <path
      fill="none"
      stroke="#0660b2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      d="M65.52,6.43h9.85V60.6H48.29a9.85,9.85,0,0,0-9.85,9.85"
    />
    <path
      fill="none"
      stroke="#0660b2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      d="M38.44,16.28a9.85,9.85,0,0,1,9.85-9.85h2.46"
    />
    <polygon
      fill="none"
      stroke="#0660b2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      points="65.52 28.59 58.14 23.66 50.75 28.59 50.75 1.5 65.52 1.5 65.52 28.59"
    />
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="11.35" y1="18.74" x2="28.59" y2="18.74"/>
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="11.35" y1="28.59" x2="28.59" y2="28.59"/>
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="11.35" y1="38.44" x2="28.59" y2="38.44"/>
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="11.35" y1="48.29" x2="28.59" y2="48.29"/>
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="48.29" y1="38.44" x2="65.52" y2="38.44"/>
    <line fill="none" stroke="#0660b2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="48.29" y1="48.29" x2="65.52" y2="48.29"/>
  </svg>
);

const WorkCheckIcon = () => (
  <svg viewBox="0 0 69.72 54.9" className="w-full h-full">
    <path fill="#0660b2" d="M66.72,0H3A3,3,0,0,0,0,3V51.9a3,3,0,0,0,3,3H66.72a3,3,0,0,0,3-3V3A3,3,0,0,0,66.72,0Zm0,51.9H3V3H66.72Z"/>
    <path fill="#0660b2" d="M12.69,37.87a4.82,4.82,0,0,0,4.81-4.81,4.74,4.74,0,0,0-.18-1.23l5.81-3c2.14,14.64,5.19,16.48,7.38,16.48A3.17,3.17,0,0,0,33,44.26a3.68,3.68,0,0,0,.58-3.17c-.76-3.93-.88-8.7.37-10.22a1.23,1.23,0,0,1,1.91,0c1.25,1.51,1.13,6.29.37,10.22a3.68,3.68,0,0,0,.58,3.17,3.18,3.18,0,0,0,2.45,1.09c2.43,0,5.91-2.25,8-21.66.06-.55.1-1.07.13-1.57L54,16.63a4.76,4.76,0,0,0,3,1.06,4.82,4.82,0,1,0-4.81-4.82,4.75,4.75,0,0,0,.56,2.21l-5.38,4.43a7.75,7.75,0,0,0-1.65-4.74c-1.52-1.69-3.91-2.08-7.45-1.15a12.63,12.63,0,0,1-3.42.52,12.61,12.61,0,0,1-3.42-.52c-3.54-.94-5.93-.55-7.45,1.15s-2,4.59-1.53,8.9c.12,1.08.24,2.11.37,3.09L16.41,30a4.8,4.8,0,1,0-3.72,7.83Zm41.5-25A2.81,2.81,0,1,1,57,15.7a2.78,2.78,0,0,1-1.38-.38l2-1.67a1,1,0,0,0-1.27-1.54l-2,1.66A2.79,2.79,0,0,1,54.19,12.88ZM24.46,23.46c-.4-3.67-.06-6.14,1-7.35s2.75-1.27,5.44-.55a14.65,14.65,0,0,0,3.93.59,14.66,14.66,0,0,0,3.93-.59c2.69-.72,4.46-.55,5.44.55.83.93,1.23,2.62,1.18,5l-3.78,3.11a2.3,2.3,0,1,0,1.27,1.54l2.3-1.9c-2.08,18.5-5.36,19.45-6,19.45a1.24,1.24,0,0,1-.9-.36,2,2,0,0,1-.16-1.52c.29-1.48,1.59-9-.79-11.87a3.23,3.23,0,0,0-5,0C30,32.49,31.29,40,31.58,41.47A2,2,0,0,1,31.41,43a1.24,1.24,0,0,1-.9.36c-.59,0-3.42-.81-5.49-15.44l8.49-4.32a2.26,2.26,0,1,0-.91-1.81v0l-7.86,4C24.64,25.06,24.55,24.28,24.46,23.46ZM12.69,30.24a2.79,2.79,0,0,1,1.88.74l-2.33,1.19a1,1,0,0,0,.91,1.78l2.33-1.19a2.92,2.92,0,0,1,0,.29,2.81,2.81,0,1,1-2.81-2.81Z"/>
    <path fill="#0660b2" d="M8.88,10.76H19.64a1,1,0,0,0,0-2H8.88a1,1,0,0,0,0,2Z"/>
    <path fill="#0660b2" d="M8.88,15.53h7.21a1,1,0,0,0,0-2H8.88a1,1,0,0,0,0,2Z"/>
    <path fill="#0660b2" d="M61.34,45.13H54.13a1,1,0,0,0,0,2h7.21a1,1,0,0,0,0-2Z"/>
    <path fill="#0660b2" d="M57,40.45a1,1,0,0,0,0,2h4.34a1,1,0,0,0,0-2Z"/>
    <path fill="#0660b2" d="M53.54,41.45a1,1,0,0,0-1-1H51.2a1,1,0,0,0,0,2h1.34A1,1,0,0,0,53.54,41.45Z"/>
  </svg>
);

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
      icon: null, // Using inline SVG
      IconComponent: DiscussionIcon,
      href: '/book/discussions'
    },
    {
      id: 'workcheck',
      fullLabel: 'Work Check',
      icon: null, // Using inline SVG
      IconComponent: WorkCheckIcon,
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

      {/* Cards - horizontal scroll on mobile, grid on desktop */}
      <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 scrollbar-hide">
        {quickActions.map((action, index) => (
          <div
            key={action.id}
            className="card-hover dark:bg-dark-card dark:border-dark-border dark:hover:border-dark-border animate-slide-up p-3 md:p-4 cursor-pointer flex-shrink-0 w-32 md:w-auto"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => navigate(action.href)}
          >
            <div className="text-center">
              {/* Icon */}
              <div className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 md:mb-3 flex items-center justify-center">
                {action.IconComponent ? (
                  <action.IconComponent />
                ) : (
                  <img
                    src={action.icon}
                    alt={`${action.fullLabel} icon`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>

              {/* Title */}
              <h3 className="font-subheading text-sm md:text-base font-semibold text-primary-900 dark:text-gray-100 mb-2">
                {action.fullLabel}
              </h3>

              {/* Button */}
              <button className="btn-primary w-full text-[9px] md:text-[10px] py-1 md:py-1.5 dark:bg-primary-600 dark:hover:bg-primary-700">
                Book Now
                <svg className="w-2.5 h-2.5 md:w-3 md:h-3 ml-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
