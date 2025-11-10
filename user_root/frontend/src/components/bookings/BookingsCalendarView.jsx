import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, parseISO, isAfter } from 'date-fns';
import { formatBookingNumber, getBookingStatus, normalizeBooking, formatTimeRange } from '../../services/api';

const BookingsCalendarView = ({ bookings, onCancelBooking, isLoading, error }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const grouped = {};
    if (bookings && bookings.length > 0) {
      bookings.forEach(booking => {
        // Normalize booking to ensure all properties exist
        const normalizedBooking = normalizeBooking(booking);
        // Use exam_date directly as it's already in YYYY-MM-DD format
        const dateKey = normalizedBooking.exam_date;
        if (dateKey && !grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        if (dateKey) {
          grouped[dateKey].push(normalizedBooking);
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
      classes += 'text-gray-400 hover:bg-gray-100 ';
      if (isDateToday) {
        classes += 'bg-primary-50 text-primary-700 ring-2 ring-primary-200 ';
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
    try {
      // Handle ISO timestamp format
      if (timeString.includes('T') || timeString.includes('-')) {
        const date = new Date(timeString);
        const hour = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      }
      // Handle HH:MM format
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  };

  // Format time range for display using the API service function
  // This function properly handles ISO timestamps from HubSpot
  const formatBookingTimeRange = (booking) => {
    return formatTimeRange(booking);
  };

  const getStatusBadge = (booking) => {
    const status = getBookingStatus(booking);
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Scheduled', icon: '📅' },
      completed: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Completed', icon: '✓' },
      cancelled: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Cancelled', icon: '✕' },
      no_show: { color: 'bg-red-100 text-red-800 border-red-200', label: 'No Show', icon: '⚠' }
    };

    const config = statusConfig[status] || statusConfig.scheduled;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        <span className="text-xs">{config.icon}</span>
        {config.label}
      </span>
    );
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

  const ClockIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );

  if (isLoading) {
    return (
      <div className="card-brand max-w-6xl mx-auto animate-pulse">
        <div className="p-6">
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brand max-w-6xl mx-auto">
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-brand max-w-6xl mx-auto">
        <div className="flex gap-6">
          {/* Calendar Side */}
          <div className="flex-1 p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 hover:bg-primary-50 rounded-md transition-colors text-gray-600 hover:text-primary-700 focus-brand"
                aria-label="Previous month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <h2 className="text-xl font-headline font-semibold text-navy-900">
                {format(currentDate, 'MMMM yyyy')}
              </h2>

              <button
                onClick={() => navigateMonth(1)}
                className="p-2 hover:bg-primary-50 rounded-md transition-colors text-gray-600 hover:text-primary-700 focus-brand"
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
                <div key={day} className="h-10 w-10 flex items-center justify-center text-sm font-subheading font-medium text-gray-600">
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
            <div className="mt-6 pt-4 border-t border-cool-grey">
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-teal-100 border-2 border-teal-200 rounded"></div>
                  <span className="text-gray-700 font-body">Dates With Bookings</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary-600 rounded"></div>
                  <span className="text-gray-700 font-body">Current Dates</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span className="text-gray-700 font-body">No Bookings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bookings Side - Only show when a date with bookings is selected */}
          <div className="w-80 border-l border-cool-grey">
            {selectedDate && selectedBookings.length > 0 ? (
              <div className="p-4">
                <h3 className="text-lg font-headline font-semibold text-navy-900 mb-4">
                  Your Bookings
                </h3>
                <p className="text-sm font-body text-gray-700 mb-4">
                  {formatDate(selectedDate)}
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedBookings
                    .sort((a, b) => {
                      // Sort by start_time chronologically
                      const timeA = a.start_time || '00:00';
                      const timeB = b.start_time || '00:00';
                      return timeA.localeCompare(timeB);
                    })
                    .map((booking) => {
                    const now = new Date();
                    const bookingDate = parseISO(booking.exam_date);
                    const status = getBookingStatus(booking);
                    const isPast = status === 'completed' ||
                                   status === 'cancelled' ||
                                   status === 'no_show' ||
                                   isBefore(bookingDate, startOfDay(now));
                    const canCancel = status === 'scheduled' && booking.is_active !== false && isAfter(bookingDate, now);

                    return (
                      <div
                        key={booking.id}
                        className="p-3 border-2 border-cool-grey rounded-lg hover:shadow-md hover:border-primary-300 bg-white transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-subheading font-semibold text-navy-800">
                            {formatBookingNumber(booking)}
                          </h4>
                          {getStatusBadge(booking)}
                        </div>

                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-900">{booking.mock_type || 'Mock Exam'}</p>
                        </div>

                        <div className="space-y-2 text-xs font-body text-gray-700">
                          <div className="flex items-center gap-2">
                            <ClockIcon />
                            <span>{formatBookingTimeRange(booking)}</span>
                          </div>
                          {booking.location && booking.location !== 'Location TBD' && (
                            <div className="flex items-center gap-2">
                              <LocationIcon />
                              <span>{booking.location}</span>
                            </div>
                          )}
                        </div>

                        {canCancel && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelBooking(booking);
                              }}
                              className="w-full text-center text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 py-1.5 rounded-md transition-colors"
                            >
                              Cancel Booking
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 flex items-center justify-center h-full">
                <div className="text-center text-gray-600">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-subheading font-medium mb-2 text-navy-700">Select a date</p>
                  <p className="text-sm font-body">
                    Choose a date with bookings to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BookingsCalendarView;