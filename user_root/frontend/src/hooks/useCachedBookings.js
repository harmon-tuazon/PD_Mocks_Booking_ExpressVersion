import { useState, useEffect } from 'react';
import apiService from '../services/api';

/**
 * Module-level cache for bookings data
 * Shared across all component instances
 *
 * This implements a 4-tier caching hierarchy:
 * 1. Frontend module cache (0ms) - this layer
 * 2. Backend Redis cache (10-20ms)
 * 3. Backend Supabase secondary DB (50ms)
 * 4. Backend HubSpot source of truth (500ms)
 */
let bookingsCache = null;
let lastFetchTime = null;
let subscribers = new Set();
let ongoingRequest = null;

// Cache duration: 60 seconds (shorter than credits due to booking volatility)
const CACHE_DURATION = 60000; // 1 minute in milliseconds

/**
 * Custom hook for managing cached bookings data across components
 * Implements module-level caching with automatic refresh and subscriber pattern
 *
 * @returns {{
 *   bookings: Array | null,
 *   loading: boolean,
 *   fetchBookings: (studentId: string, email: string, options?: object) => Promise<void>,
 *   invalidateCache: () => void
 * }}
 */
export function useCachedBookings() {
  const [bookings, setBookings] = useState(bookingsCache);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Register this component as a subscriber
    subscribers.add(setBookings);

    // Update component if cache already exists
    if (bookingsCache) {
      setBookings(bookingsCache);
    }

    // Cleanup: unregister on unmount
    return () => {
      subscribers.delete(setBookings);
    };
  }, []);

  /**
   * Fetches bookings data for a student
   * Uses cache if available and fresh, otherwise fetches from API
   *
   * @param {string} studentId - The student's ID
   * @param {string} email - The student's email
   * @param {object} options - Optional parameters
   * @param {boolean} options.force - Force refresh even if cache is fresh
   * @param {string} options.filter - Filter: 'upcoming', 'past', 'cancelled', or 'all'
   * @param {number} options.limit - Maximum number of bookings to fetch
   * @returns {Promise<Array>}
   */
  const fetchBookings = async (studentId, email, options = {}) => {
    const { force = false, filter = 'upcoming', limit = 50 } = options;

    // STEP 1: Check if cache is fresh and not forced refresh
    if (!force && bookingsCache && lastFetchTime) {
      const cacheAge = Date.now() - lastFetchTime;
      if (cacheAge < CACHE_DURATION) {
        console.log(`✅ [FRONTEND CACHE HIT] Using cached bookings (age: ${cacheAge}ms)`);

        // Apply client-side filtering if cache has all bookings
        const filteredBookings = filterBookings(bookingsCache, filter);
        setBookings(filteredBookings);
        return filteredBookings;
      }
    }

    // If there's an ongoing request, return it to prevent race conditions
    if (ongoingRequest) {
      try {
        await ongoingRequest;
        return bookingsCache;
      } catch (error) {
        // Continue to make a new request if the ongoing one failed
      }
    }

    // Set loading state for all subscribers
    subscribers.forEach(setState => {
      if (setState === setBookings) {
        setLoading(true);
      }
    });

    // Create the request promise
    const requestPromise = (async () => {
      try {
        console.log(`🌐 [API CALL] Fetching bookings from backend (filter: ${filter})`);

        // Backend handles 3-tier caching: Redis → Supabase → HubSpot
        const response = await apiService.bookings.list({
          student_id: studentId,
          email: email,
          filter: filter,
          limit: limit,
          force: force
        });

        if (response.success) {
          const fetchedBookings = response.data.bookings || [];

          // Update module-level cache
          bookingsCache = fetchedBookings;
          lastFetchTime = Date.now();

          console.log(`✅ [CACHE POPULATED] Cached ${fetchedBookings.length} bookings`);

          // Update all subscribers
          subscribers.forEach(setState => {
            setState(fetchedBookings);
          });

          return fetchedBookings;
        } else {
          throw new Error(response.error || 'Failed to fetch bookings');
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
        // Keep the last successful cache on error
        // Don't update cache or lastFetchTime on error
        throw error;
      } finally {
        // Clear ongoing request
        ongoingRequest = null;

        // Set loading to false for all subscribers
        subscribers.forEach(setState => {
          if (setState === setBookings) {
            setLoading(false);
          }
        });
      }
    })();

    // Store the ongoing request
    ongoingRequest = requestPromise;

    try {
      return await requestPromise;
    } catch (error) {
      // Error already logged in the promise
      // Set loading to false for this component
      setLoading(false);
      throw error;
    }
  };

  /**
   * Invalidates the cache, forcing a fresh fetch on next request
   * Should be called after booking creation or cancellation
   */
  const invalidateCache = () => {
    console.log('🔄 [CACHE INVALIDATED] Clearing bookings cache');

    // Clear module-level cache
    bookingsCache = null;
    lastFetchTime = null;
    ongoingRequest = null;

    // Update all subscribers to reflect cache clear
    subscribers.forEach(setState => {
      setState(null);
    });

    // Dispatch custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('bookingsInvalidated'));
  };

  return {
    bookings,
    loading,
    fetchBookings,
    invalidateCache
  };
}

/**
 * Client-side filtering helper
 * Filters cached bookings without making API call
 *
 * @param {Array} bookings - All cached bookings
 * @param {string} filter - Filter type: 'upcoming', 'past', 'cancelled', 'all'
 * @returns {Array} Filtered bookings
 */
function filterBookings(bookings, filter) {
  if (!bookings || filter === 'all') {
    return bookings || [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return bookings.filter(booking => {
    // Handle cancelled bookings
    if (filter === 'cancelled') {
      return booking.is_active === 'Cancelled' ||
             booking.is_active === 'cancelled' ||
             booking.status === 'cancelled';
    }

    // Exclude cancelled bookings for other filters
    const isCancelled = booking.is_active === 'Cancelled' ||
                        booking.is_active === 'cancelled' ||
                        booking.status === 'cancelled';
    if (isCancelled) {
      return false;
    }

    // Filter by date
    if (booking.exam_date) {
      const examDate = new Date(booking.exam_date);
      examDate.setHours(0, 0, 0, 0);

      if (filter === 'upcoming') {
        return examDate >= today;
      } else if (filter === 'past') {
        return examDate < today;
      }
    }

    // Default: include if filter not recognized
    return true;
  });
}

/**
 * Reset cache for testing purposes
 * @private
 */
export const __resetCache = () => {
  bookingsCache = null;
  lastFetchTime = null;
  subscribers.clear();
  ongoingRequest = null;
};

export default useCachedBookings;
