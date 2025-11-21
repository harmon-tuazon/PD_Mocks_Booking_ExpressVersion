import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { FiLock } from 'react-icons/fi';
import { formatTimeRange } from '../../services/api';
import { checkPrerequisites } from '../../utils/prerequisiteHelpers';

const CalendarView = ({ exams, onDateSelect, onExamSelect, userBookings = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);

  // Group exams by date
  const examsByDate = useMemo(() => {
    const grouped = {};
    exams.forEach(exam => {
      // Use exam_date directly as it's already in YYYY-MM-DD format
      // Avoid timezone conversion issues by not creating a Date object
      const dateKey = exam.exam_date; // Already in 'yyyy-MM-dd' format
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(exam);
    });
    return grouped;
  }, [exams]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // Add empty cells for the start of the month
    const startDay = start.getDay(); // 0 = Sunday
    const emptyDays = Array(startDay).fill(null);

    return [...emptyDays, ...days];
  }, [currentDate]);

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    // Clear selection when changing months
    setSelectedDate(null);
    setSelectedSessions([]);
  };

  const handleDateClick = (date) => {
    if (!date || isBefore(date, startOfDay(new Date()))) return;

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayExams = examsByDate[dateKey];

    if (dayExams && dayExams.length > 0) {
      setSelectedDate(date);
      setSelectedSessions(dayExams);
      // Still call the parent callback for compatibility
      onDateSelect && onDateSelect(date, dayExams);
    } else {
      // If no sessions on this date, clear selection
      setSelectedDate(null);
      setSelectedSessions([]);
    }
  };

  const handleSessionSelect = (session) => {
    onExamSelect && onExamSelect(session);
  };

  // Check if session has unmet prerequisites
  const hasUnmetPrerequisites = (session) => {
    if (!session.prerequisite_exam_ids || session.prerequisite_exam_ids.length === 0) {
      return false;
    }
    return !checkPrerequisites(session.prerequisite_exam_ids, userBookings);
  };

  const getDayClasses = (date) => {
    if (!date) return 'invisible';

    const dateKey = format(date, 'yyyy-MM-dd');
    const hasExams = examsByDate[dateKey] && examsByDate[dateKey].length > 0;
    const isDateToday = isToday(date);
    const isPast = isBefore(date, startOfDay(new Date()));
    const isSelected = selectedDate && isSameDay(date, selectedDate);

    // Mobile: larger touch targets (h-12 w-12 = 48px), Desktop: standard size (h-10 w-10 = 40px)
    let classes = 'h-12 w-12 md:h-10 md:w-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ';

    if (isPast) {
      classes += 'text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-dark-card/50 ';
    } else if (isSelected) {
      classes += 'bg-primary-600 text-white font-bold shadow-md ring-2 ring-primary-300 dark:ring-primary-700 ';
    } else if (hasExams) {
      classes += 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-800/50 cursor-pointer border-2 border-teal-200 dark:border-teal-700 font-semibold ';
      if (isDateToday) {
        classes += 'ring-2 ring-primary-300 dark:ring-primary-700 ';
      }
    } else {
      classes += 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover ';
      if (isDateToday) {
        classes += 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-2 ring-primary-200 dark:ring-primary-700 ';
      }
    }

    return classes;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Date';
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Icon components
  const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );

  const LocationIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="card-brand dark:bg-dark-card dark:border-dark-border max-w-6xl mx-auto">
      {/* Mobile: stack vertically, Desktop: side by side */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Calendar Side */}
        <div className="flex-1 p-4 md:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-primary-50 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 focus-brand"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h2 className="text-xl font-headline font-semibold text-navy-900 dark:text-gray-100">
              {format(currentDate, 'MMMM yyyy')}
            </h2>

            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-primary-50 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 focus-brand"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 mb-4">
            {weekDays.map(day => (
              <div key={day} className="h-8 md:h-10 flex items-center justify-center text-xs md:text-sm font-subheading font-medium text-gray-600 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, index) => (
              <div key={index} className="flex items-center justify-center py-1">
                <button
                  onClick={() => handleDateClick(date)}
                  className={getDayClasses(date)}
                  disabled={!date || isBefore(date, startOfDay(new Date())) || (!examsByDate[date && format(date, 'yyyy-MM-dd')])}
                >
                  {date && format(date, 'd')}
                </button>
              </div>
            ))}
          </div>

          {/* Legend - Mobile: wrap flex, Desktop: single row */}
          <div className="mt-6 pt-4 border-t border-cool-grey dark:border-dark-border">
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs md:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-teal-100 dark:bg-teal-900/30 border-2 border-teal-200 dark:border-teal-700 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body whitespace-nowrap">Available sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary-600 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body whitespace-nowrap">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 dark:bg-dark-hover rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body whitespace-nowrap">No sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Side - Only show when a date with sessions is selected */}
        {/* Mobile: full width with top border, Desktop: fixed width with left border */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-cool-grey dark:border-dark-border">
          {selectedDate && selectedSessions.length > 0 ? (
            <div className="p-4 md:p-4">
              <h3 className="text-lg font-headline font-semibold text-navy-900 dark:text-gray-100 mb-4">
                Available Sessions
              </h3>
              <p className="text-sm font-body text-gray-700 dark:text-gray-300 mb-4">
                {formatDate(selectedDate)}
              </p>

              {/* Mobile: shorter max height, Desktop: taller */}
              <div className="space-y-3 max-h-64 md:max-h-96 overflow-y-auto">
                {selectedSessions
                  .sort((a, b) => {
                    // Sort by start_time chronologically
                    const timeA = a.start_time || '00:00';
                    const timeB = b.start_time || '00:00';
                    return timeA.localeCompare(timeB);
                  })
                  .map((session) => (
                  <div
                    key={session.mock_exam_id}
                    className={`p-3 border-2 border-cool-grey dark:border-dark-border rounded-lg ${session.available_slots > 0 ? 'hover:shadow-md cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-dark-card' : 'opacity-75 bg-gray-50 dark:bg-dark-bg/50'} transition-all duration-200`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    {/* Mobile: stack vertically, Desktop: side by side */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h4 className="text-sm sm:text-xs font-subheading font-semibold text-navy-800 dark:text-gray-100">
                        {formatTimeRange(session)}
                      </h4>
                      <div className={`px-2 py-1 rounded-full text-xs font-subheading font-medium border self-start sm:self-auto ${
                        session.is_active
                          ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400 border-teal-200 dark:border-teal-700'
                          : 'bg-gray-100 dark:bg-gray-700/30 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                      }`}>
                        {session.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    {/* Prerequisites Badge */}
                    {hasUnmetPrerequisites(session) && (
                      <div className="flex items-center gap-1 mb-2 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        <FiLock className="h-3 w-3" />
                        <span>Prerequisites Required</span>
                      </div>
                    )}

                    <div className="space-y-2 text-sm sm:text-xs font-body text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <LocationIcon />
                        <span className="break-words">{session.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 md:p-6 flex items-center justify-center min-h-[200px] md:h-full">
              <div className="text-center text-gray-600 dark:text-gray-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                <p className="text-base md:text-lg font-subheading font-medium mb-2 text-navy-700 dark:text-gray-200">Select a date</p>
                <p className="text-sm font-body px-4">
                  Choose a date with available sessions to view booking options
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;