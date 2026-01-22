/**
 * PrerequisiteExamsList Component
 * Display associated prerequisites in view mode
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTime } from '../../utils/timeFormatters';

const PrerequisiteExamsList = ({ exams = [] }) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  // Get mock type badge variant
  const getMockTypeVariant = (type) => {
    switch (type) {
      case 'Clinical Skills':
        return 'success';
      case 'Situational Judgment':
        return 'info';
      default:
        return 'default';
    }
  };

  // Handle exam click to navigate to details
  const handleExamClick = (examId) => {
    navigate(`/mock-exams/${examId}`);
  };

  // Empty state
  if (!exams || exams.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm italic">
        No prerequisite exams required
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-t-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Prerequisite Exams
          </span>
          <Badge variant="default" className="text-xs">
            {exams.length}
          </Badge>
        </div>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-1.5">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="group flex flex-col p-1.5 bg-gray-50 dark:bg-gray-800/30 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
              onClick={() => handleExamClick(exam.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleExamClick(exam.id);
                }
              }}
              aria-label={`View details for ${exam.mock_type} exam`}
            >
              {/* Header with badge and hint */}
              <div className="flex items-center justify-between mb-1">
                <Badge variant={getMockTypeVariant(exam.mock_type)} className="text-xs">
                  {exam.mock_type}
                </Badge>
                <span className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details →
                </span>
              </div>

              {/* Exam details - compact layout */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                {/* Location */}
                <div className="flex items-center gap-0.5">
                  <MapPinIcon className="h-3 w-3 text-gray-400" />
                  <span>{exam.location || 'N/A'}</span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-0.5">
                  <CalendarIcon className="h-3 w-3 text-gray-400" />
                  <span>{formatDateLong(exam.exam_date)}</span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-0.5">
                  <ClockIcon className="h-3 w-3 text-gray-400" />
                  <span>
                    {formatTime(exam.start_time)} - {formatTime(exam.end_time)}
                  </span>
                </div>

                {/* Optional capacity info */}
                {exam.capacity && exam.total_bookings !== undefined && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ({exam.total_bookings}/{exam.capacity} bookings)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrerequisiteExamsList;
