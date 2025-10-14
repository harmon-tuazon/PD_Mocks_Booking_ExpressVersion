import { useState, useEffect } from 'react';
import apiService from '../services/api';

/**
 * Module-level cache for credit data
 * Shared across all component instances
 */
let creditCache = null;
let lastFetchTime = null;
let subscribers = new Set();
let ongoingRequest = null;

// Cache duration: 5 minutes
const CACHE_DURATION = 300000; // 5 minutes in milliseconds

/**
 * Custom hook for managing cached credit data across components
 * Implements module-level caching with automatic refresh and subscriber pattern
 *
 * @returns {{
 *   credits: Object | null,
 *   loading: boolean,
 *   fetchCredits: (studentId: string, email: string, force?: boolean) => Promise<void>,
 *   invalidateCache: () => void
 * }}
 */
export function useCachedCredits() {
  const [credits, setCredits] = useState(creditCache);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Register this component as a subscriber
    subscribers.add(setCredits);

    // Update component if cache already exists
    if (creditCache) {
      setCredits(creditCache);
    }

    // Cleanup: unregister on unmount
    return () => {
      subscribers.delete(setCredits);
    };
  }, []);

  /**
   * Fetches credit data for all exam types
   * Uses cache if available and fresh, otherwise fetches from API
   *
   * @param {string} studentId - The student's ID
   * @param {string} email - The student's email
   * @param {boolean} force - Force refresh even if cache is fresh
   * @returns {Promise<void>}
   */
  const fetchCredits = async (studentId, email, force = false) => {
    // Check if cache is fresh and not forced refresh
    if (!force && creditCache && lastFetchTime) {
      const cacheAge = Date.now() - lastFetchTime;
      if (cacheAge < CACHE_DURATION) {
        // Cache is still fresh, use it
        setCredits(creditCache);
        return;
      }
    }

    // If there's an ongoing request, return it to prevent race conditions
    if (ongoingRequest) {
      try {
        await ongoingRequest;
        return;
      } catch (error) {
        // Continue to make a new request if the ongoing one failed
      }
    }

    // Set loading state for all subscribers
    subscribers.forEach(setState => {
      if (setState === setCredits) {
        setLoading(true);
      }
    });

    // Create the request promise
    const requestPromise = (async () => {
      try {
        // Fetch all 3 exam types in parallel
        const [situationalCredits, clinicalCredits, miniMockCredits] = await Promise.all([
          apiService.mockExams.validateCredits(studentId, email, 'Situational Judgment'),
          apiService.mockExams.validateCredits(studentId, email, 'Clinical Skills'),
          apiService.mockExams.validateCredits(studentId, email, 'Mini-mock')
        ]);

        // Structure the cache data
        const newCreditData = {
          'Situational Judgment': situationalCredits.data || situationalCredits,
          'Clinical Skills': clinicalCredits.data || clinicalCredits,
          'Mini-mock': miniMockCredits.data || miniMockCredits
        };

        // Update module-level cache
        creditCache = newCreditData;
        lastFetchTime = Date.now();

        // Update all subscribers
        subscribers.forEach(setState => {
          setState(newCreditData);
        });

        return newCreditData;
      } catch (error) {
        console.error('Error fetching credits:', error);
        // Keep the last successful cache on error
        // Don't update cache or lastFetchTime on error
        throw error;
      } finally {
        // Clear ongoing request
        ongoingRequest = null;

        // Set loading to false for all subscribers
        subscribers.forEach(setState => {
          if (setState === setCredits) {
            setLoading(false);
          }
        });
      }
    })();

    // Store the ongoing request
    ongoingRequest = requestPromise;

    try {
      await requestPromise;
    } catch (error) {
      // Error already logged in the promise
      // Set loading to false for this component
      setLoading(false);
    }
  };

  /**
   * Invalidates the cache, forcing a fresh fetch on next request
   * Also dispatches a custom event to notify other parts of the application
   */
  const invalidateCache = () => {
    // Clear module-level cache
    creditCache = null;
    lastFetchTime = null;
    ongoingRequest = null;

    // Update all subscribers to reflect cache clear
    subscribers.forEach(setState => {
      setState(null);
    });

    // Dispatch custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('creditsInvalidated'));
  };

  return {
    credits,
    loading,
    fetchCredits,
    invalidateCache
  };
}

/**
 * Reset cache for testing purposes
 * @private
 */
export const __resetCache = () => {
  creditCache = null;
  lastFetchTime = null;
  subscribers.clear();
  ongoingRequest = null;
};

export default useCachedCredits;