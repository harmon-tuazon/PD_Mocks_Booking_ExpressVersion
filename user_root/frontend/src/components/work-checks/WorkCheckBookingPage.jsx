/**
 * WorkCheckBookingPage.jsx
 * Main work check booking page - redesigned to match ExamSessionsList UI
 * Features: Calendar view, List view, sorting, group filtering
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { useWorkCheckBooking } from '../../hooks/useWorkCheckBooking';
import WorkCheckConfirmation from './WorkCheckConfirmation';
import Logo from '../shared/Logo';

const WorkCheckBookingPage = () => {
  const navigate = useNavigate();
  const {
    step,
    loading,
    error,
    userData,
    groups,
    existingBookingDates,
    availableSlots,
    selectedSlot,
    bookingResult,
    selectSlot,
    clearSelectedSlot,
    submitBooking,
    refreshSlots,
    reset,
    clearError
  } = useWorkCheckBooking();

  // View mode state
  const [viewMode, setViewMode] = useState('calendar');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // All available slots (no group filtering - all slots for user's groups are shown)
  const filteredSlots = useMemo(() => {
    if (!availableSlots || !Array.isArray(availableSlots)) return [];
    return availableSlots;
  }, [availableSlots]);

  // Group slots by date for calendar view
  const slotsByDate = useMemo(() => {
    const grouped = {};
    filteredSlots.forEach(slot => {
      const dateKey = slot.slot_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    return grouped;
  }, [filteredSlots]);

  // Sort slots for list view
  const sortedSlots = useMemo(() => {
    const sorted = [...filteredSlots].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'date':
          aValue = new Date(a.slot_date);
          bValue = new Date(b.slot_date);
          break;
        case 'time':
          aValue = a.slot_time;
          bValue = b.slot_time;
          break;
        case 'instructor':
          aValue = (a.instructor_name || '').toLowerCase();
          bValue = (b.instructor_name || '').toLowerCase();
          break;
        case 'group':
          aValue = (a.group_name || a.group_id || '').toLowerCase();
          bValue = (b.group_name || b.group_id || '').toLowerCase();
          break;
        case 'capacity':
          aValue = a.available_slots;
          bValue = b.available_slots;
          break;
        default:
          return 0;
      }

      if (sortConfig.key === 'instructor' || sortConfig.key === 'group') {
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } else {
        if (sortConfig.direction === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
    });
    return sorted;
  }, [filteredSlots, sortConfig]);

  // Calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();
    const emptyDays = Array(startDay).fill(null);
    return [...emptyDays, ...days];
  }, [currentDate]);

  // Selected date sessions
  const selectedSessions = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return slotsByDate[dateKey] || [];
  }, [selectedDate, slotsByDate]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    setSelectedDate(null);
  };

  const handleDateClick = (date) => {
    if (!date || isBefore(date, startOfDay(new Date()))) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySlots = slotsByDate[dateKey];
    if (daySlots && daySlots.length > 0) {
      setSelectedDate(date);
    } else {
      setSelectedDate(null);
    }
  };

  const handleSlotSelect = (slot) => {
    // Check if slot date has existing booking
    if (existingBookingDates.includes(slot.slot_date)) {
      alert('You already have a work check scheduled for this date.');
      return;
    }
    selectSlot(slot);
  };

  const getDayClasses = (date) => {
    if (!date) return 'invisible';

    const dateKey = format(date, 'yyyy-MM-dd');
    const hasSlots = slotsByDate[dateKey] && slotsByDate[dateKey].length > 0;
    const hasConflict = existingBookingDates.includes(dateKey);
    const isDateToday = isToday(date);
    const isPast = isBefore(date, startOfDay(new Date()));
    const isSelected = selectedDate && isSameDay(date, selectedDate);

    let classes = 'h-12 w-12 md:h-10 md:w-10 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center ';

    if (isPast) {
      classes += 'text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-dark-card/50 ';
    } else if (isSelected) {
      classes += 'bg-primary-600 text-white font-bold shadow-md ring-2 ring-primary-300 dark:ring-primary-700 ';
    } else if (hasConflict && hasSlots) {
      classes += 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 cursor-pointer border-2 border-amber-300 dark:border-amber-700 font-semibold ';
    } else if (hasSlots) {
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

  // Format helpers
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateLong = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const formatTimeRange = (slot) => {
    return `${formatTime(slot.slot_time)} - ${formatTime(slot.end_time)}`;
  };

  // Sort icons
  const SortArrowUp = () => (
    <svg className="w-3 h-3 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );

  const SortArrowDown = () => (
    <svg className="w-3 h-3 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Loading state
  if (step === 'loading' || (loading && step !== 'confirming')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
            <p className="mt-4 text-body font-body text-gray-700 dark:text-gray-300">Loading available work check slots...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (initial load failure)
  if (step === 'error' && !userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 dark:bg-red-900/20 rounded-full mb-4 border-2 border-coral-200 dark:border-red-800">
              <svg className="w-8 h-8 text-coral-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-h3 font-headline font-bold text-navy-900 dark:text-gray-100 mb-2">Error Loading Slots</h2>
            <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-6">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn-brand-primary dark:bg-primary-600 dark:hover:bg-primary-700">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation step
  if (step === 'confirmed' && bookingResult) {
    return (
      <WorkCheckConfirmation
        bookingResult={bookingResult}
        onBookAnother={reset}
        onViewBookings={() => navigate('/my-work-checks')}
      />
    );
  }

  // Main booking view
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between mb-2">
            <h1 className="text-h2 font-headline font-bold text-navy-900 dark:text-gray-100">
              Book Work Check
            </h1>
            <Logo
              variant="horizontal"
              size="large"
              className="ml-4"
              aria-label="PrepDoctors Logo"
            />
          </div>
          <p className="text-body font-body text-gray-800 dark:text-gray-300">
            {viewMode === 'calendar'
              ? 'Select a date from the calendar to view available slots'
              : 'Select an available work check slot to book'
            }
          </p>
        </div>

        {/* Groups display */}
        {groups.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400 py-1">My Groups:</span>
              {groups.map(group => (
                <span
                  key={group.group_id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                >
                  {group.group_name || group.group_id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button onClick={clearError} className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing booking warning */}
        {existingBookingDates.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You have existing work checks on {existingBookingDates.length} date(s). Those dates are highlighted in amber.
              </p>
            </div>
          </div>
        )}

        {/* View Toggle and Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-6 gap-4">
          <div className="flex items-end">
            {/* Refresh button */}
            <button
              onClick={refreshSlots}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Slot Count */}
            <p className="text-sm font-body text-gray-600 dark:text-gray-400">
              Found {filteredSlots.length} slot{filteredSlots.length !== 1 ? 's' : ''}
            </p>
            {/* View toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white dark:bg-primary-500'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">List View</span>
                  <span className="sm:hidden">List</span>
                </span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  viewMode === 'calendar'
                    ? 'bg-primary-600 text-white dark:bg-primary-500'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Calendar View</span>
                  <span className="sm:hidden">Calendar</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected slot indicator */}
        {selectedSlot && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    Selected Slot
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {formatDateLong(selectedSlot.slot_date)} at {formatTimeRange(selectedSlot)}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {selectedSlot.instructor_name} &bull; {selectedSlot.group_name || selectedSlot.group_id}
                    {selectedSlot.location && ` &bull; ${selectedSlot.location}`}
                  </p>
                </div>
              </div>
              <button
                onClick={clearSelectedSlot}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={submitBooking}
                disabled={loading}
                className={`
                  w-full flex items-center justify-center gap-2
                  px-6 py-3 rounded-lg font-semibold text-white
                  transition-all duration-200
                  ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'}
                `}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Booking...
                  </>
                ) : (
                  <>
                    Confirm Booking
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Slots content */}
        {filteredSlots.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-2">No available work check slots</p>
            <p className="text-small font-body text-gray-600 dark:text-gray-400">
              There are no work check slots available for your groups at this time.
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <div className="card-brand dark:bg-dark-card dark:border-dark-border p-0 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-navy-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                    <tr>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center">
                          Date
                          {sortConfig.key === 'date' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('time')}
                      >
                        <div className="flex items-center">
                          Time
                          {sortConfig.key === 'time' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('instructor')}
                      >
                        <div className="flex items-center">
                          Instructor
                          {sortConfig.key === 'instructor' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('group')}
                      >
                        <div className="flex items-center">
                          Group
                          {sortConfig.key === 'group' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider">
                        Location
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('capacity')}
                      >
                        <div className="flex items-center">
                          Available
                          {sortConfig.key === 'capacity' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedSlots.map((slot) => {
                      const hasConflict = existingBookingDates.includes(slot.slot_date);
                      const isSelected = selectedSlot?.slot_id === slot.slot_id;
                      return (
                        <tr
                          key={slot.slot_id}
                          className={`${
                            isSelected
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : hasConflict
                              ? 'bg-amber-50 dark:bg-amber-900/10'
                              : slot.available_slots > 0
                              ? 'hover:bg-gray-50 dark:hover:bg-dark-hover'
                              : 'bg-gray-50 dark:bg-dark-bg/50 opacity-75'
                          } transition-colors`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatDate(slot.slot_date)}
                              </span>
                              {hasConflict && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Conflict
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {formatTimeRange(slot)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {slot.instructor_name || 'TBD'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {slot.group_name || slot.group_id}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {slot.location || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              slot.available_slots > 2
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : slot.available_slots > 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {slot.available_slots} / {slot.total_slots}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleSlotSelect(slot)}
                              disabled={slot.available_slots === 0 || hasConflict}
                              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                isSelected
                                  ? 'bg-green-600 text-white'
                                  : slot.available_slots > 0 && !hasConflict
                                  ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {isSelected ? 'Selected' : slot.available_slots === 0 ? 'Full' : hasConflict ? 'Conflict' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4">
              {sortedSlots.map((slot) => {
                const hasConflict = existingBookingDates.includes(slot.slot_date);
                const isSelected = selectedSlot?.slot_id === slot.slot_id;
                return (
                  <div
                    key={slot.slot_id}
                    className={`card-brand dark:bg-dark-card dark:border-dark-border ${
                      isSelected
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                        : hasConflict
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
                        : slot.available_slots > 0
                        ? 'hover:shadow-lg hover:border-primary-300 dark:hover:border-dark-border'
                        : 'opacity-75'
                    } transition-all duration-200`}
                  >
                    <div className="space-y-3">
                      {/* Date and Availability */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-headline font-semibold text-navy-800 dark:text-gray-100">
                            {formatDate(slot.slot_date)}
                          </h3>
                          {hasConflict && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Conflict
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          slot.available_slots > 2
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : slot.available_slots > 0
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {slot.available_slots} / {slot.total_slots}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm font-body text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span>{formatTimeRange(slot)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          <span>{slot.instructor_name || 'TBD'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          <span>{slot.group_name || slot.group_id}</span>
                        </div>
                        {slot.location && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            <span>{slot.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleSlotSelect(slot)}
                        disabled={slot.available_slots === 0 || hasConflict}
                        className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white'
                            : slot.available_slots > 0 && !hasConflict
                            ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? 'Selected' : slot.available_slots === 0 ? 'Slot Full' : hasConflict ? 'Date Conflict' : 'Select Slot'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Sorting Controls */}
            <div className="md:hidden mt-4 p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sort by:</p>
              <div className="grid grid-cols-2 gap-2">
                {['date', 'time', 'instructor', 'group'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
                      sortConfig.key === key
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600'
                        : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                    }`}
                  >
                    {key} {sortConfig.key === key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Calendar View */
          <div className="card-brand dark:bg-dark-card dark:border-dark-border max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Calendar Side */}
              <div className="flex-1 p-4 md:p-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 hover:bg-primary-50 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400"
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
                    className="p-2 hover:bg-primary-50 dark:hover:bg-dark-hover rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Week Days Header */}
                <div className="grid grid-cols-7 mb-4">
                  {weekDays.map(day => (
                    <div key={day} className="h-8 md:h-10 flex items-center justify-center text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((date, index) => {
                    const dateKey = date ? format(date, 'yyyy-MM-dd') : null;
                    const hasSlots = dateKey && slotsByDate[dateKey] && slotsByDate[dateKey].length > 0;
                    return (
                      <div key={index} className="flex items-center justify-center py-1">
                        <button
                          onClick={() => handleDateClick(date)}
                          className={getDayClasses(date)}
                          disabled={!date || isBefore(date, startOfDay(new Date())) || !hasSlots}
                        >
                          {date && format(date, 'd')}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-cool-grey dark:border-dark-border">
                  <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-teal-100 dark:bg-teal-900/30 border-2 border-teal-200 dark:border-teal-700 rounded"></div>
                      <span className="text-gray-700 dark:text-gray-300">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded"></div>
                      <span className="text-gray-700 dark:text-gray-300">Has conflict</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-primary-600 rounded"></div>
                      <span className="text-gray-700 dark:text-gray-300">Selected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sessions Side */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-cool-grey dark:border-dark-border">
                {selectedDate && selectedSessions.length > 0 ? (
                  <div className="p-4">
                    <h3 className="text-lg font-headline font-semibold text-navy-900 dark:text-gray-100 mb-2">
                      Available Slots
                    </h3>
                    <p className="text-sm font-body text-gray-700 dark:text-gray-300 mb-4">
                      {formatDateLong(format(selectedDate, 'yyyy-MM-dd'))}
                    </p>

                    <div className="space-y-3 max-h-64 md:max-h-96 overflow-y-auto">
                      {selectedSessions
                        .filter(slot => slot.available_slots > 0)
                        .sort((a, b) => a.slot_time.localeCompare(b.slot_time))
                        .map((slot) => {
                          const hasConflict = existingBookingDates.includes(slot.slot_date);
                          const isSelected = selectedSlot?.slot_id === slot.slot_id;
                          return (
                            <div
                              key={slot.slot_id}
                              onClick={() => !hasConflict && handleSlotSelect(slot)}
                              className={`p-3 border-2 rounded-lg transition-all duration-200 ${
                                isSelected
                                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                  : hasConflict
                                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 cursor-not-allowed'
                                  : 'border-cool-grey dark:border-dark-border hover:shadow-md cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-dark-card'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-navy-800 dark:text-gray-100">
                                  {formatTimeRange(slot)}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  slot.available_slots > 2
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}>
                                  {slot.available_slots} left
                                </span>
                              </div>
                              {hasConflict && (
                                <div className="flex items-center gap-1 mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span>Existing booking on this date</span>
                                </div>
                              )}
                              <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-2">
                                  <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                  <span>{slot.instructor_name || 'TBD'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                  </svg>
                                  <span>{slot.group_name || slot.group_id}</span>
                                </div>
                                {slot.location && (
                                  <div className="flex items-center gap-2">
                                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    <span>{slot.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex items-center justify-center min-h-[200px] md:h-full">
                    <div className="text-center text-gray-600 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <p className="text-base md:text-lg font-medium mb-2 text-navy-700 dark:text-gray-200">Select a date</p>
                      <p className="text-sm px-4">
                        Choose a date with available slots to view booking options
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkCheckBookingPage;
