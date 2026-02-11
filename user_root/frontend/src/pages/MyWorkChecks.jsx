/**
 * MyWorkChecks.jsx
 * Page for displaying and managing user's work check bookings
 * Enhanced with calendar view, sorting, and rebook functionality
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../utils/auth';
import apiService from '../services/api';
import WorkCheckCalendarView from '../components/work-checks/WorkCheckCalendarView';
import WorkCheckRebookModal from '../components/work-checks/WorkCheckRebookModal';

const MyWorkChecks = () => {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // all, upcoming, pending, completed, cancelled
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [userData, setUserData] = useState(null);

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    // Persist view mode preference in localStorage
    return localStorage.getItem('workChecksViewMode') || 'list';
  });

  // Sorting state
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Rebook modal state
  const [rebookModalOpen, setRebookModalOpen] = useState(false);
  const [cancelledBooking, setCancelledBooking] = useState(null);

  // Reschedule modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('workChecksViewMode', viewMode);
  }, [viewMode]);

  // Initialize on mount
  useEffect(() => {
    const session = getUserSession();
    if (!session?.studentId || !session?.email) {
      navigate('/login');
      return;
    }

    setUserData({
      studentId: session.studentId,
      email: session.email,
      studentName: session.studentName || 'Student'
    });

    fetchBookings(session.studentId, session.email, filter, 1);
  }, []);

  // Fetch bookings when filter changes
  useEffect(() => {
    if (userData) {
      fetchBookings(userData.studentId, userData.email, filter, 1);
    }
  }, [filter, userData]);

  // Fetch work check bookings
  const fetchBookings = useCallback(async (studentId, email, filterType, page) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.workChecks.list(studentId, email, {
        filter: filterType === 'all' ? undefined : filterType,
        page,
        limit: 50 // Fetch more for calendar view
      });

      if (response.success) {
        setBookings(response.data.bookings || []);
        setStats(response.data.stats);
        setPagination(response.data.pagination);
        setCurrentPage(page);
      } else {
        throw new Error(response.error?.message || 'Failed to load work checks');
      }
    } catch (err) {
      console.error('Error fetching work checks:', err);
      // Handle error message that could be string or object {code, message}
      const errorMsg = typeof err.message === 'object'
        ? err.message?.message || 'Failed to load work checks'
        : err.message || 'Failed to load your work checks';
      setError(errorMsg);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sorting logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort bookings
  const sortedBookings = useMemo(() => {
    if (!bookings || !Array.isArray(bookings)) return [];
    if (!sortField) return bookings;

    return [...bookings].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'date':
          aValue = a.slot_date || '';
          bValue = b.slot_date || '';
          break;
        case 'time':
          aValue = a.slot_time || '';
          bValue = b.slot_time || '';
          break;
        case 'instructor':
          aValue = (a.instructor_name || '').toLowerCase();
          bValue = (b.instructor_name || '').toLowerCase();
          break;
        case 'group':
          aValue = (a.group_name || a.group_id || '').toLowerCase();
          bValue = (b.group_name || b.group_id || '').toLowerCase();
          break;
        case 'location':
          aValue = (a.location || '').toLowerCase();
          bValue = (b.location || '').toLowerCase();
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [bookings, sortField, sortDirection]);

  // Handle cancellation
  const handleCancelClick = (booking) => {
    setBookingToCancel(booking);
    setCancelModalOpen(true);
    setCancelError('');
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel || !userData) return;

    setIsCancelling(true);
    setCancelError('');

    try {
      const response = await apiService.workChecks.cancel(
        bookingToCancel.id,
        userData.studentId,
        userData.email,
        'User requested cancellation'
      );

      if (response.success) {
        // Store cancelled booking for rebook modal
        setCancelledBooking(bookingToCancel);
        setCancelModalOpen(false);
        setBookingToCancel(null);
        // Refresh bookings
        fetchBookings(userData.studentId, userData.email, filter, currentPage);
        // Show rebook modal
        setRebookModalOpen(true);
      } else {
        throw new Error(response.error?.message || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Error cancelling work check:', err);
      // Handle error message that could be string or object {code, message}
      const errorMsg = typeof err.message === 'object'
        ? err.message?.message || 'Failed to cancel'
        : err.message || 'Failed to cancel. Please try again.';
      setCancelError(errorMsg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCloseCancelModal = () => {
    if (!isCancelling) {
      setCancelModalOpen(false);
      setBookingToCancel(null);
      setCancelError('');
    }
  };

  // Handle reschedule click - show confirmation modal
  const handleReschedule = (booking) => {
    setBookingToReschedule(booking);
    setRescheduleModalOpen(true);
    setRescheduleError('');
  };

  // Handle confirm reschedule (cancel + redirect to booking)
  const handleConfirmReschedule = async () => {
    if (!bookingToReschedule || !userData) return;

    setIsRescheduling(true);
    setRescheduleError('');

    try {
      const response = await apiService.workChecks.cancel(
        bookingToReschedule.id,
        userData.studentId,
        userData.email,
        'User requested reschedule'
      );

      if (response.success) {
        // Close modal and navigate to booking page
        setRescheduleModalOpen(false);
        setBookingToReschedule(null);
        navigate('/book/work-check');
      } else {
        throw new Error(response.error?.message || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Error rescheduling work check:', err);
      // Handle error message that could be string or object {code, message}
      const errorMsg = typeof err.message === 'object'
        ? err.message?.message || 'Failed to reschedule'
        : err.message || 'Failed to reschedule. Please try again.';
      setRescheduleError(errorMsg);
    } finally {
      setIsRescheduling(false);
    }
  };

  // Handle close reschedule modal
  const handleCloseRescheduleModal = () => {
    if (!isRescheduling) {
      setRescheduleModalOpen(false);
      setBookingToReschedule(null);
      setRescheduleError('');
    }
  };

  // Handle rebook (navigate to booking page)
  const handleRebook = () => {
    setRebookModalOpen(false);
    setCancelledBooking(null);
    navigate('/book/work-check');
  };

  const handleCloseRebookModal = () => {
    setRebookModalOpen(false);
    setCancelledBooking(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format date for table (shorter)
  const formatDateShort = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      confirmed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Confirmed', icon: '✓' },
      pending: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: 'Pending', icon: '⏳' },
      cancelled: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Cancelled', icon: '✕' },
      completed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Completed', icon: '✓' },
      no_show: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'No Show', icon: '⚠' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="text-xs">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // Check if booking can be cancelled/rescheduled
  const canCancel = (booking) => {
    return booking.status === 'confirmed' || booking.status === 'pending';
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Loading state
  if (loading && (!bookings || bookings.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Loading your work checks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-900 dark:text-gray-100 mb-2">
                My Work Checks
              </h1>
              <p className="font-body text-base sm:text-lg text-primary-700 dark:text-gray-300">
                View and manage your work check bookings
              </p>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border p-4 mb-6">
          <div className="flex flex-col space-y-4">
            {/* View Toggle and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* View Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
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
                      ? 'bg-primary-600 text-white'
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

              {/* Filters */}
              <div className="flex items-center space-x-2 flex-1 overflow-x-auto">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'completed', label: 'Completed' },
                  { key: 'cancelled', label: 'Cancelled' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 whitespace-nowrap ${
                      filter === tab.key
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600'
                        : 'bg-white dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Sorting Dropdown - Only show in list view */}
            {viewMode === 'list' && (
              <div className="md:hidden">
                <label htmlFor="sort-mobile" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort by
                </label>
                <select
                  id="sort-mobile"
                  value={sortField ? `${sortField}_${sortDirection}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setSortField(null);
                      setSortDirection('asc');
                    } else {
                      const [field, direction] = value.split('_');
                      setSortField(field);
                      setSortDirection(direction || 'asc');
                    }
                  }}
                  className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-hover dark:text-gray-100 rounded-md focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400"
                >
                  <option value="">Default Order</option>
                  <option value="date_asc">Date (Oldest First)</option>
                  <option value="date_desc">Date (Newest First)</option>
                  <option value="time_asc">Time (Early First)</option>
                  <option value="time_desc">Time (Late First)</option>
                  <option value="instructor_asc">Instructor (A-Z)</option>
                  <option value="instructor_desc">Instructor (Z-A)</option>
                  <option value="group_asc">Group (A-Z)</option>
                  <option value="group_desc">Group (Z-A)</option>
                  <option value="location_asc">Location (A-Z)</option>
                  <option value="location_desc">Location (Z-A)</option>
                  <option value="status_asc">Status (A-Z)</option>
                  <option value="status_desc">Status (Z-A)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={() => fetchBookings(userData.studentId, userData.email, filter, currentPage)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' ? (
          <WorkCheckCalendarView
            bookings={bookings}
            onCancelBooking={handleCancelClick}
            onRescheduleBooking={handleReschedule}
            isLoading={loading}
            error={error}
          />
        ) : (
          /* List View */
          <>
            {sortedBookings.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  No {filter === 'all' ? '' : filter} work checks
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {filter === 'upcoming' || filter === 'all'
                    ? "You don't have any upcoming work checks scheduled."
                    : `No ${filter} work checks found.`}
                </p>
                {(filter === 'upcoming' || filter === 'all') && (
                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/book/work-check')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Book a Work Check
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white dark:bg-dark-card border dark:border-dark-border rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-navy-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                        <tr>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('date')}
                          >
                            <div className="flex items-center gap-1">
                              Date
                              {getSortIcon('date')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('time')}
                          >
                            <div className="flex items-center gap-1">
                              Time
                              {getSortIcon('time')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('instructor')}
                          >
                            <div className="flex items-center gap-1">
                              Instructor
                              {getSortIcon('instructor')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('group')}
                          >
                            <div className="flex items-center gap-1">
                              Group
                              {getSortIcon('group')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('location')}
                          >
                            <div className="flex items-center gap-1">
                              Location
                              {getSortIcon('location')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-1">
                              Status
                              {getSortIcon('status')}
                            </div>
                          </th>
                          {filter !== 'cancelled' && filter !== 'completed' && (
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-navy-900 dark:text-gray-100 uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedBookings.map((booking) => (
                          <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-hover">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatDateShort(booking.slot_date)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatTime(booking.slot_time)}
                                {booking.end_time && (
                                  <span> - {formatTime(booking.end_time)}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {booking.instructor_name || 'TBD'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {booking.group_name || booking.group_id || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {booking.location || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {getStatusBadge(booking.status)}
                            </td>
                            {filter !== 'cancelled' && filter !== 'completed' && (
                              <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                                {canCancel(booking) && (
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => handleReschedule(booking)}
                                      disabled={isCancelling && bookingToCancel?.id === booking.id}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      Reschedule
                                    </button>
                                    <button
                                      onClick={() => handleCancelClick(booking)}
                                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1 rounded-md transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {sortedBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                    >
                      <div className="flex flex-col gap-3">
                        {/* Header with status */}
                        <div className="flex items-center justify-between">
                          {getStatusBadge(booking.status)}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {booking.booking_id}
                          </span>
                        </div>

                        {/* Booking details */}
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{formatDate(booking.slot_date)}</span>
                          </div>

                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{formatTime(booking.slot_time)} - {formatTime(booking.end_time)}</span>
                          </div>

                          {booking.instructor_name && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{booking.instructor_name}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{booking.group_name || booking.group_id}</span>
                          </div>

                          {booking.location && (
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{booking.location}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions - hidden for cancelled and completed */}
                        {filter !== 'cancelled' && filter !== 'completed' && canCancel(booking) && (
                          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <button
                              onClick={() => handleReschedule(booking)}
                              disabled={isCancelling && bookingToCancel?.id === booking.id}
                              className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancelClick(booking)}
                              className="flex-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => fetchBookings(userData.studentId, userData.email, filter, currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => fetchBookings(userData.studentId, userData.email, filter, currentPage + 1)}
                  disabled={currentPage === pagination.total_pages || loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay with backdrop blur */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-20 backdrop-blur-sm transition-opacity"
              aria-hidden="true"
              onClick={!isCancelling ? handleCloseCancelModal : undefined}
            />

            {/* Center modal trick */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full">
              {/* Header */}
              <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  {/* Red alert icon */}
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>

                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-headline font-semibold text-navy-900 dark:text-gray-100" id="modal-title">
                      Cancel Work Check
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm font-body text-gray-600 dark:text-gray-400">
                        Are you sure you want to cancel this work check? This action cannot be undone.
                      </p>
                    </div>

                    {/* Booking Details Card */}
                    {bookingToCancel && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-hover rounded-lg border border-gray-200 dark:border-dark-border">
                        <div className="space-y-3">
                          {/* Instructor */}
                          <div>
                            <p className="text-sm font-subheading font-semibold text-navy-800 dark:text-gray-100">{bookingToCancel.instructor_name || 'Instructor TBD'}</p>
                          </div>

                          {/* Date */}
                          <div className="flex items-start gap-2 text-sm font-body text-gray-700 dark:text-gray-400">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{formatDate(bookingToCancel.slot_date)}</span>
                          </div>

                          {/* Time */}
                          <div className="flex items-start gap-2 text-sm font-body text-gray-700 dark:text-gray-400">
                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{formatTime(bookingToCancel.slot_time)} - {formatTime(bookingToCancel.end_time)}</span>
                          </div>

                          {/* Location */}
                          {bookingToCancel.location && (
                            <div className="flex items-start gap-2 text-sm font-body text-gray-700 dark:text-gray-400">
                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{bookingToCancel.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {cancelError && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="ml-3 text-sm font-body text-red-800 dark:text-red-300">{cancelError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Close button */}
                  {!isCancelling && (
                    <button
                      type="button"
                      className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onClick={handleCloseCancelModal}
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-dark-hover px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleConfirmCancel}
                  className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2.5 bg-red-600 text-sm font-subheading font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 transition-colors duration-200"
                >
                  {isCancelling ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Cancelling...
                    </span>
                  ) : (
                    'Yes, Cancel Booking'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCloseCancelModal}
                  className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2.5 bg-white dark:bg-dark-card text-sm font-subheading font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Keep Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Confirmation Modal */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="reschedule-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay with backdrop blur */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-20 backdrop-blur-sm transition-opacity"
              aria-hidden="true"
              onClick={!isRescheduling ? handleCloseRescheduleModal : undefined}
            />

            {/* Center modal trick */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full">
              {/* Header */}
              <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  {/* Blue refresh icon */}
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>

                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-headline font-semibold text-navy-900 dark:text-gray-100" id="reschedule-modal-title">
                      Rebook for a New Time?
                    </h3>
                    <div className="mt-2">
                      {bookingToReschedule && (
                        <p className="text-sm font-body text-gray-600 dark:text-gray-400">
                          You're about to reschedule your <span className="font-subheading font-semibold text-navy-900 dark:text-gray-100">{bookingToReschedule.instructor_name || 'Work Check'}</span> booking for <span className="font-subheading font-semibold text-navy-900 dark:text-gray-100">{formatDate(bookingToReschedule.slot_date)}</span>.
                        </p>
                      )}
                      <p className="text-sm font-body text-gray-600 dark:text-gray-400 mt-2">
                        Would you like to book a new timeslot?
                      </p>
                    </div>

                    {/* Error Message */}
                    {rescheduleError && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="ml-3 text-sm text-red-800 dark:text-red-300">{rescheduleError}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Close button */}
                  {!isRescheduling && (
                    <button
                      type="button"
                      className="hidden sm:block absolute top-3 right-3 bg-white dark:bg-dark-card rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onClick={handleCloseRescheduleModal}
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-dark-hover px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  disabled={isRescheduling}
                  onClick={handleConfirmReschedule}
                  className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2.5 bg-primary-600 text-sm font-subheading font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 transition-colors duration-200"
                >
                  {isRescheduling ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Yes, Find New Time'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isRescheduling}
                  onClick={handleCloseRescheduleModal}
                  className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2.5 bg-white dark:bg-dark-card text-sm font-subheading font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rebook Modal */}
      <WorkCheckRebookModal
        isOpen={rebookModalOpen}
        booking={cancelledBooking}
        onClose={handleCloseRebookModal}
        onRebook={handleRebook}
        isProcessing={false}
      />
    </div>
  );
};

export default MyWorkChecks;
