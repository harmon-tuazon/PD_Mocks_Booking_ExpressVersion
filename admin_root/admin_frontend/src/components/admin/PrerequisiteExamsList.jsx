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
    navigate(`/admin/mock-exams/${examId}`);
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
    <div className="space-y-2">
      {exams.map((exam) => (
        <div
          key={exam.id}
          className="group flex flex-col p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
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
          {/* Header with badge */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant={getMockTypeVariant(exam.mock_type)}>
              {exam.mock_type}
            </Badge>
            <span className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              View Details →
            </span>
          </div>

          {/* Exam details */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            {/* Location */}
            <div className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4 text-gray-400" />
              <span>{exam.location || 'N/A'}</span>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              <span>{formatDateLong(exam.exam_date)}</span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4 text-gray-400" />
              <span>
                {formatTime(exam.start_time)} - {formatTime(exam.end_time)}
              </span>
            </div>
          </div>

          {/* Optional capacity info */}
          {exam.capacity && exam.total_bookings !== undefined && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Bookings: {exam.total_bookings}/{exam.capacity}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PrerequisiteExamsList;