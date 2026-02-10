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
      email: session.email
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
        setBookings(response.data.bookings);
        setStats(response.data.stats);
        setPagination(response.data.pagination);
        setCurrentPage(page);
      } else {
        throw new Error(response.error?.message || 'Failed to load work checks');
      }
    } catch (err) {
      console.error('Error fetching work checks:', err);
      setError(err.message || 'Failed to load your work checks');
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
      setCancelError(err.message || 'Failed to cancel. Please try again.');
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

  // Handle reschedule (cancel + redirect to booking)
  const handleReschedule = async (booking) => {
    // First cancel the booking
    setBookingToCancel(booking);
    setIsCancelling(true);

    try {
      const response = await apiService.workChecks.cancel(
        booking.id,
        userData.studentId,
        userData.email,
        'User requested reschedule'
      );

      if (response.success) {
        // Navigate to booking page
        navigate('/book/work-check');
      } else {
        throw new Error(response.error?.message || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Error rescheduling work check:', err);
      setError(err.message || 'Failed to reschedule. Please try again.');
    } finally {
      setIsCancelling(false);
      setBookingToCancel(null);
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
  if (loading && bookings.length === 0) {
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
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline font-bold text-gray-900 dark:text-gray-100">
                My Work Checks
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-body">
                View and manage your work check bookings
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${viewMode === 'calendar'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'}
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total || 0}</p>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Upcoming</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.upcoming || 0}</p>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending || 0}</p>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed || 0}</p>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 col-span-2 md:col-span-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">Cancelled</p>
              <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{stats.cancelled || 0}</p>
            </div>
          </div>
        )}

        {/* Filter tabs and Sort (List view only) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
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
                className={`
                  px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  ${filter === tab.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'}
                `}
              >
                {tab.label}
                {stats && tab.key !== 'all' && (
                  <span className="ml-1 text-xs opacity-75">
                    ({stats[tab.key] || 0})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mobile sort dropdown (list view only) */}
          {viewMode === 'list' && (
            <div className="md:hidden">
              <select
                value={sortField || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSort(e.target.value);
                  } else {
                    setSortField(null);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <option value="">Sort by...</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
                <option value="instructor">Instructor</option>
                <option value="group">Group</option>
                <option value="status">Status</option>
              </select>
            </div>
          )}
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
              <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No {filter === 'all' ? '' : filter} work checks
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {filter === 'upcoming' || filter === 'all'
                    ? "You don't have any upcoming work checks scheduled."
                    : `No ${filter} work checks found.`}
                </p>
                {(filter === 'upcoming' || filter === 'all') && (
                  <button
                    onClick={() => navigate('/book/work-check')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Book a Work Check
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-dark-hover">
                        <tr>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('date')}
                          >
                            <div className="flex items-center gap-1">
                              Date
                              {getSortIcon('date')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('time')}
                          >
                            <div className="flex items-center gap-1">
                              Time
                              {getSortIcon('time')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('instructor')}
                          >
                            <div className="flex items-center gap-1">
                              Instructor
                              {getSortIcon('instructor')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('group')}
                          >
                            <div className="flex items-center gap-1">
                              Group
                              {getSortIcon('group')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('location')}
                          >
                            <div className="flex items-center gap-1">
                              Location
                              {getSortIcon('location')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => handleSort('status')}
                          >
                            <div className="flex items-center gap-1">
                              Status
                              {getSortIcon('status')}
                            </div>
                          </th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
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
                                  <span className="text-gray-400 dark:text-gray-500">
                                    {' '}- {formatTime(booking.end_time)}
                                  </span>
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
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              {canCancel(booking) && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleReschedule(booking)}
                                    disabled={isCancelling && bookingToCancel?.id === booking.id}
                                    className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors disabled:opacity-50"
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={() => handleCancelClick(booking)}
                                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </td>
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

                        {/* Actions */}
                        {canCancel(booking) && (
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

        {/* Book another CTA */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/book/work-check')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Book a Work Check
          </button>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={handleCloseCancelModal}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Cancel Work Check?
              </h3>

              {bookingToCancel && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-hover rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(bookingToCancel.slot_date)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTime(bookingToCancel.slot_time)} - {formatTime(bookingToCancel.end_time)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {bookingToCancel.instructor_name}
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to cancel this work check? This action cannot be undone.
              </p>

              {cancelError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{cancelError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseCancelModal}
                  disabled={isCancelling}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCancelling ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Cancelling...
                    </span>
                  ) : (
                    'Yes, Cancel'
                  )}
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
