import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCachedBookings } from '../../hooks/useCachedBookings';

const ExistingBookingsCard = ({
  studentId,
  email,
  maxItems = 3,
  onViewAll,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [totalBookings, setTotalBookings] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const lastFetchRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0); // Force component refresh

  // Use the cached bookings hook (4-tier caching: Frontend → Redis → Supabase → HubSpot)
  const { bookings: cachedBookings, loading, fetchBookings: fetchFromCache, invalidateCache } = useCachedBookings();

  // Local bookings state for filtering
  const [bookings, setBookings] = useState([]);

  // Wrapper to fetch bookings with options
  const fetchBookings = useCallback(async (force = false) => {
    if (!studentId || !email) {
      return;
    }

    // Prevent duplicate fetches within 1 second unless forced
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 1000) {
      return;
    }
    lastFetchRef.current = now;

    setError(null);

    try {
      await fetchFromCache(studentId, email, {
        force: force,
        filter: 'upcoming',
        limit: 50
      });
    } catch (err) {
      console.error('[ExistingBookingsCard] Error fetching bookings:', err.message);
      setError('Unable to load bookings');
    }
  }, [studentId, email, fetchFromCache]);

  // Update local state when cached bookings change
  useEffect(() => {
    if (cachedBookings) {
      // Filter to only show bookings where is_active === "Active"
      const activeBookings = cachedBookings.filter(booking => {
        const isActive = booking.is_active || booking.mock_exam?.is_active;
        return isActive === 'Active' || isActive === 'active';
      });

      setBookings(activeBookings);
      setUpcomingCount(activeBookings.length);
      setTotalBookings(activeBookings.length);
    } else {
      setBookings([]);
      setUpcomingCount(0);
      setTotalBookings(0);
    }
  }, [cachedBookings]);

  // Fetch bookings on mount and when dependencies change
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings, refreshKey]);

  // Refetch bookings when navigating back to this page or when explicitly requested
  useEffect(() => {
    const shouldRefresh = location.state?.refreshBookings;

    if (shouldRefresh) {
      // Add a delay to ensure HubSpot has updated
      setTimeout(() => {
        fetchBookings(true);
      }, 2000);
    } else {
      fetchBookings(true);
    }

    // Clear the refresh flag from location state to prevent unnecessary refetches
    if (shouldRefresh && window.history.replaceState) {
      window.history.replaceState({}, document.title);
    }
  }, [location.pathname, location.state?.refreshBookings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when page becomes visible (user switches tabs back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBookings(true);
      }
    };

    const handleFocus = () => {
      fetchBookings(true);
    };

    // Listen for visibility changes and window focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchBookings]);

  // Listen for localStorage-based refresh signals
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Handle both bookingCreated and bookingCancelled events
      if ((e.key === 'bookingCreated' || e.key === 'bookingCancelled') && e.newValue) {
        // Parse the value to check if it's for our user
        try {
          const bookingInfo = JSON.parse(e.newValue);
          if (bookingInfo.studentId === studentId) {
            // Invalidate cache first
            invalidateCache();

            // Add delay for HubSpot sync, then force refresh
            setTimeout(() => {
              setRefreshKey(prev => prev + 1);
              fetchBookings(true);
            }, 2500);

            // Clear the signal
            localStorage.removeItem(e.key);
          }
        } catch (err) {
          console.error('Error parsing booking signal:', err);
        }
      }
    };

    // Check for pending refresh signals on mount
    const checkPendingRefresh = (key) => {
      const pendingRefresh = localStorage.getItem(key);
      if (pendingRefresh) {
        try {
          const bookingInfo = JSON.parse(pendingRefresh);
          if (bookingInfo.studentId === studentId) {
            // Invalidate cache first
            invalidateCache();

            setTimeout(() => {
              setRefreshKey(prev => prev + 1);
              fetchBookings(true);
            }, 1500);
            localStorage.removeItem(key);
          }
        } catch (err) {
          console.error(`Error handling pending ${key} refresh:`, err);
        }
      }
    };

    // Check both types of pending refresh
    checkPendingRefresh('bookingCreated');
    checkPendingRefresh('bookingCancelled');

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [studentId, fetchBookings, invalidateCache]);

  // Listen for custom events as backup mechanism
  useEffect(() => {
    const handleBookingUpdate = (e) => {
      // Check if the event is for the current user
      if (e.detail && e.detail.studentId === studentId) {
        // Add delay for HubSpot sync
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
          fetchBookings(true);
        }, 2500);
      }
    };

    // Listen for custom events
    window.addEventListener('bookingUpdated', handleBookingUpdate);
    window.addEventListener('bookingCreated', handleBookingUpdate);
    window.addEventListener('bookingCancelled', handleBookingUpdate);

    return () => {
      window.removeEventListener('bookingUpdated', handleBookingUpdate);
      window.removeEventListener('bookingCreated', handleBookingUpdate);
      window.removeEventListener('bookingCancelled', handleBookingUpdate);
    };
  }, [studentId, fetchBookings]);

  // Periodic polling for updates (every 30 seconds when visible)
  useEffect(() => {
    let intervalId;

    if (document.visibilityState === 'visible') {
      // Start polling
      intervalId = setInterval(() => {
        fetchBookings(true);
      }, 30000); // 30 seconds
    }

    const handleVisibilityForPolling = () => {
      if (document.visibilityState === 'visible' && !intervalId) {
        // Resume polling when page becomes visible
        intervalId = setInterval(() => {
          fetchBookings(true);
        }, 30000);
      } else if (document.visibilityState === 'hidden' && intervalId) {
        // Stop polling when page is hidden
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityForPolling);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityForPolling);
    };
  }, [fetchBookings]);

  // Format short date (e.g., "Jan 25")
  const formatShortDate = (dateString) => {
    if (!dateString) return 'TBD';

    try {
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }

      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Get exam type abbreviation
  const getExamTypeAbbr = (mockType) => {
    switch (mockType) {
      case 'Situational Judgment':
        return 'SJ';
      case 'Clinical Skills':
        return 'CS';
      case 'Mini-mock':
        return 'MM';
      default:
        return mockType?.substring(0, 2).toUpperCase() || '??';
    }
  };

  // Get abbreviated location
  const getAbbreviatedLocation = (location) => {
    if (!location) return '';

    // If location is already short, return as is
    if (location.length <= 15) return location;

    // Try to extract key part (e.g., "Room 101" from "Building A, Room 101")
    const parts = location.split(',');
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }

    // Otherwise truncate with ellipsis
    return location.substring(0, 12) + '...';
  };

  // Get status color class
  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'status-scheduled';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      case 'no_show':
        return 'status-no-show';
      default:
        return 'status-default';
    }
  };

  // Handle view all click
  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      navigate('/my-bookings');
    }
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-gray-200 dark:bg-dark-hover rounded w-24"></div>
          <div className="h-5 bg-gray-200 dark:bg-dark-hover rounded-full w-6"></div>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-dark-card rounded w-32 mt-1"></div>
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-8 bg-gray-200 dark:bg-dark-hover rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-dark-hover rounded w-16"></div>
              <div className="h-4 bg-gray-100 dark:bg-dark-card rounded w-20"></div>
            </div>
            <div className="h-2 w-2 bg-gray-200 dark:bg-dark-hover rounded-full"></div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
        <div className="h-4 bg-gray-200 dark:bg-dark-hover rounded w-28 mx-auto"></div>
      </div>
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="p-8 text-center">
      <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No upcoming bookings</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No upcoming exams scheduled
      </p>
    </div>
  );

  // Error state
  const ErrorState = () => (
    <div className="p-6 text-center">
      <svg className="mx-auto h-10 w-10 text-error-400 dark:text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Unable to load bookings</p>
      <button
        onClick={() => fetchBookings(true)}
        className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
      >
        Try again
      </button>
    </div>
  );

  // Main render
  return (
    <div className={`bg-white dark:bg-dark-card border dark:border-dark-border rounded-md overflow-hidden shadow-sm existing-bookings-card ${className}`}>
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState />
      ) : (
        <>
          {/* Card Header */}
          <div className="px-4 py-3 border-b dark:border-dark-border">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">My Upcoming Mocks</h3>
                {/* Refresh button - subtle, only shown when not loading */}
                {!loading && (
                  <button
                    onClick={() => fetchBookings(true)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors duration-200"
                    title="Refresh bookings"
                    aria-label="Refresh bookings"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
              {upcomingCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-primary-600 dark:bg-primary-500 rounded-full">
                  {upcomingCount}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your upcoming mock exams</p>
          </div>

          {/* Card Body */}
          {bookings.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="p-4">
                <div className="space-y-3">
                  {bookings.slice(0, maxItems).map((booking) => (
                    <div
                      key={booking.id}
                      className="booking-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer transition-colors duration-200"
                      onClick={() => navigate('/my-bookings')}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Exam Type Badge */}
                        <span className="exam-badge inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-primary-600 dark:bg-primary-500 rounded">
                          {getExamTypeAbbr(booking.mock_exam?.mock_type || booking.mock_type)}
                        </span>

                        {/* Date */}
                        <span className="booking-date text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {formatShortDate(booking.mock_exam?.exam_date || booking.exam_date)}
                        </span>

                        {/* Location */}
                        <span className="booking-location text-sm text-gray-500 dark:text-gray-400 truncate">
                          {getAbbreviatedLocation(booking.mock_exam?.location || booking.location)}
                        </span>
                      </div>

                      {/* Status Indicator */}
                      <span
                        className={`status-dot w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(booking.status)}`}
                        title={booking.status}
                      />
                    </div>
                  ))}
                </div>

                {/* Show remaining count if there are more bookings */}
                {bookings.length > maxItems && (
                  <div className="mt-3 pt-3 border-t dark:border-dark-border">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      +{bookings.length - maxItems} more booking{bookings.length - maxItems > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-dark-bg border-t dark:border-dark-border">
                <button
                  onClick={handleViewAll}
                  className="w-full text-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors duration-200"
                >
                  View All Bookings {totalBookings > 0 && `(${totalBookings})`} →
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

ExistingBookingsCard.propTypes = {
  studentId: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  maxItems: PropTypes.number,
  onViewAll: PropTypes.func,
  className: PropTypes.string
};

export default ExistingBookingsCard;