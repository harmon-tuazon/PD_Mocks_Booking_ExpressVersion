/**
 * WorkCheckCalendarView.jsx
 * Calendar view component for work check bookings
 * Displays monthly calendar grid with booking indicators and date selection
 */
import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, parseISO, isAfter } from 'date-fns';

const WorkCheckCalendarView = ({ bookings, onCancelBooking, onRescheduleBooking, isLoading, error }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped = {};
    if (bookings && bookings.length > 0) {
      bookings.forEach(booking => {
        const dateKey = booking.slot_date;
        if (dateKey && !grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        if (dateKey) {
          grouped[dateKey].push(booking);
        }
      });
    }
    return grouped;
  }, [bookings]);

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
    setSelectedBookings([]);
  };

  const handleDateClick = (date) => {
    if (!date) return;

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayBookings = bookingsByDate[dateKey];

    if (dayBookings && dayBookings.length > 0) {
      setSelectedDate(date);
      setSelectedBookings(dayBookings);
    } else {
      // If no bookings on this date, clear selection
      setSelectedDate(null);
      setSelectedBookings([]);
    }
  };

  const getDayClasses = (date) => {
    if (!date) return 'invisible';

    const dateKey = format(date, 'yyyy-MM-dd');
    const hasBookings = bookingsByDate[dateKey] && bookingsByDate[dateKey].length > 0;
    const isDateToday = isToday(date);
    const isSelected = selectedDate && isSameDay(date, selectedDate);

    let classes = 'h-10 w-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ';

    if (isSelected) {
      classes += 'bg-primary-600 text-white font-bold shadow-md ring-2 ring-primary-300 ';
    } else if (hasBookings) {
      classes += 'bg-teal-100 text-teal-800 hover:bg-teal-200 cursor-pointer border-2 border-teal-200 font-semibold ';
      if (isDateToday) {
        classes += 'ring-2 ring-primary-300 ';
      }
    } else {
      classes += 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover ';
      if (isDateToday) {
        classes += 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-200 dark:ring-primary-700 ';
      }
    }

    return classes;
  };

  const formatDate = (date) => {
    try {
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Date';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const getStatusBadge = (booking) => {
    const status = booking.status;
    const statusConfig = {
      confirmed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700', label: 'Confirmed', icon: '✓' },
      pending: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700', label: 'Pending', icon: '⏳' },
      cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600', label: 'Cancelled', icon: '✕' },
      completed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700', label: 'Completed', icon: '✓' },
      no_show: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700', label: 'No Show', icon: '⚠' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        <span className="text-xs">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Check if booking can be cancelled/rescheduled
  const canModify = (booking) => {
    if (booking.status !== 'confirmed' && booking.status !== 'pending') return false;
    const bookingDate = parseISO(booking.slot_date);
    return isAfter(bookingDate, startOfDay(new Date()));
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Icon components
  const CalendarIcon = () => (
    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );

  const ClockIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );

  const LocationIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );

  const InstructorIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );

  const GroupIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border max-w-6xl mx-auto animate-pulse">
        <div className="p-6">
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border max-w-6xl mx-auto">
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row">
        {/* Calendar Side */}
        <div className="flex-1 p-4 lg:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h2 className="text-xl font-headline font-semibold text-gray-900 dark:text-gray-100">
              {format(currentDate, 'MMMM yyyy')}
            </h2>

            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekDays.map(day => (
              <div key={day} className="h-10 w-10 flex items-center justify-center text-sm font-subheading font-medium text-gray-600 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                className={getDayClasses(date)}
                disabled={!date}
              >
                {date && format(date, 'd')}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-teal-100 border-2 border-teal-200 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body">Has Bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary-600 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300 font-body">Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings Side Panel */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
          {selectedDate && selectedBookings.length > 0 ? (
            <div className="p-4">
              <h3 className="text-lg font-headline font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Work Checks
              </h3>
              <p className="text-sm font-body text-gray-600 dark:text-gray-400 mb-4">
                {formatDate(selectedDate)}
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {selectedBookings
                  .sort((a, b) => {
                    const timeA = a.slot_time || '00:00';
                    const timeB = b.slot_time || '00:00';
                    return timeA.localeCompare(timeB);
                  })
                  .map((booking) => (
                    <div
                      key={booking.booking_id}
                      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-dark-card transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        {getStatusBadge(booking)}
                      </div>

                      <div className="space-y-2 text-xs font-body text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <ClockIcon />
                          <span>{formatTime(booking.slot_time)} - {formatTime(booking.end_time)}</span>
                        </div>
                        {booking.instructor_name && (
                          <div className="flex items-center gap-2">
                            <InstructorIcon />
                            <span>{booking.instructor_name}</span>
                          </div>
                        )}
                        {booking.group_name && (
                          <div className="flex items-center gap-2">
                            <GroupIcon />
                            <span>{booking.group_name}</span>
                          </div>
                        )}
                        {booking.location && (
                          <div className="flex items-center gap-2">
                            <LocationIcon />
                            <span>{booking.location}</span>
                          </div>
                        )}
                      </div>

                      {canModify(booking) && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRescheduleBooking(booking);
                            }}
                            className="w-full text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 py-1.5 rounded-md transition-colors"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelBooking(booking);
                            }}
                            className="w-full text-center text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 py-1.5 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="p-6 flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center text-gray-600 dark:text-gray-400">
                <CalendarIcon />
                <p className="text-lg font-subheading font-medium mb-2 text-gray-700 dark:text-gray-300">Select a date</p>
                <p className="text-sm font-body">
                  Choose a date with work checks to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkCheckCalendarView;
