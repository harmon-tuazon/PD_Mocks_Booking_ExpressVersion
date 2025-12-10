import { useState } from 'react';
import apiService, { transformLoginCreditsToCache } from '../services/api';

/**
 * Custom hook for fetching credit data
 * No caching - always fetches fresh from API
 *
 * @returns {{
 *   credits: Object | null,
 *   loading: boolean,
 *   fetchCredits: (studentId: string, email: string) => Promise<void>,
 *   invalidateCache: () => void
 * }}
 */
export function useCachedCredits() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fetches credit data for all exam types
   * Always fetches fresh from API - no caching
   *
   * @param {string} studentId - The student's ID
   * @param {string} email - The student's email
   * @returns {Promise<Object>} The fetched credit data
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
      return newCreditData; // Return the data for immediate use
    } catch (error) {
      console.error('Error fetching credits:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Invalidates the cache (no-op now, kept for API compatibility)
   */
  const invalidateCache = () => {
    console.log('🔄 [CREDITS] Cache invalidation called (no cache to invalidate)');
    // Dispatch event for other parts of the app
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
 * Standalone invalidation function for components that don't use the hook
 * Dispatches event to notify components to refetch credits
 *
 * Used by BookingForm and other components to signal credit changes
 *
 * @example
 * import { invalidateCreditsCache } from '../hooks/useCachedCredits';
 * // After booking creation or cancellation
 * invalidateCreditsCache();
 */
export const invalidateCreditsCache = () => {
  console.log('🔄 [CREDITS INVALIDATION] Dispatching creditsInvalidated event');

  // Dispatch global event for components to react
  window.dispatchEvent(new CustomEvent('creditsInvalidated'));

  console.log('✅ [CREDITS] Invalidation event dispatched');
};

export default useCachedCredits;