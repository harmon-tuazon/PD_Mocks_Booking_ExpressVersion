import { useState, useEffect } from 'react';
import apiService, { transformLoginCreditsToCache } from '../services/api';

/**
 * Simplified credit fetching hook - always fetches fresh data
 * No caching layer - components refetch on mount
 * Event-driven updates only for MyBookings (modal-based UI)
 */

/**
 * Custom hook for fetching credit data
 * Always fetches fresh data from API - no caching layer
 *
 * @returns {{
 *   credits: Object | null,
 *   loading: boolean,
 *   fetchCredits: (studentId: string, email: string) => Promise<Object>,
 *   invalidateCache: () => void
 * }}
 */
export function useCachedCredits() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fetches credit data for all exam types
   * Always fetches fresh data from the API (no caching)
   *
   * @param {string} studentId - The student's ID
   * @param {string} email - The student's email
   * @returns {Promise<Object>} - Credit data object
   */
  const fetchCredits = async (studentId, email) => {
    setLoading(true);

    try {
      console.log(`🌐 [CREDITS] Fetching fresh credits from API for ${studentId}`);

      // Use login endpoint for credit fetching
      const loginResponse = await apiService.user.login(studentId, email);

      // Transform the login response to match expected structure
      const newCreditData = transformLoginCreditsToCache(loginResponse.data);

      console.log(`✅ [CREDITS] Fresh credits fetched:`, {
        'Situational Judgment': newCreditData['Situational Judgment']?.credit_breakdown?.specific_credits || 0,
        'Clinical Skills': newCreditData['Clinical Skills']?.credit_breakdown?.specific_credits || 0,
        'Mini-mock': newCreditData['Mini-mock']?.credit_breakdown?.specific_credits || 0,
        'Shared': newCreditData['Situational Judgment']?.credit_breakdown?.shared_credits || 0
      });

      setCredits(newCreditData);
      return newCreditData;
    } catch (error) {
      console.error('Error fetching credits:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Invalidates the cache and dispatches event
   * Kept for backward compatibility with event-driven components (MyBookings)
   */
  const invalidateCache = () => {
    console.log('🔄 [CACHE INVALIDATED] Clearing credits cache');

    // Clear component state
    setCredits(null);

    // Dispatch custom event for MyBookings component
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
 * Standalone event dispatcher for triggering credit updates
 * Dispatches creditsInvalidated event for MyBookings component
 *
 * Used by BookingForm after booking creation to notify MyBookings
 * (MyBookings uses modal UI, stays mounted, needs event notification)
 *
 * @example
 * import { invalidateCreditsCache } from '../hooks/useCachedCredits';
 * // After booking creation
 * invalidateCreditsCache();
 * navigate('/confirmation');
 */
export const invalidateCreditsCache = () => {
  console.log('🔄 [STANDALONE CACHE INVALIDATION] Dispatching creditsInvalidated event');

  // Dispatch global event for MyBookings component to react
  window.dispatchEvent(new CustomEvent('creditsInvalidated'));

  console.log('✅ [STANDALONE CACHE INVALIDATION] Event dispatched');
};

/**
 * Reset cache for testing purposes
 * @private
 */
export const __resetCache = () => {
  // No-op for testing compatibility
  console.log('✅ [RESET CACHE] No cache to reset (using fresh-fetch strategy)');
};

export default useCachedCredits;