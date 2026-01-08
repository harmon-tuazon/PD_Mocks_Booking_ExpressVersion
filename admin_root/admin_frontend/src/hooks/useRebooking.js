/**
 * useRebooking Hook
 * Handles fetching available exams and rebooking mutations
 *
 * Data Source: Supabase (no HubSpot fallback for reads)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { traineeApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Fetch available locations for a mock type
 * Used to populate the location dropdown before exams are fetched
 *
 * @param {string} mockType - Filter by mock type (required)
 * @param {boolean} enabled - Whether to enable the query
 * @returns {Object} Query result with locations array
 */
export function useAvailableLocations(mockType, enabled = true) {
  return useQuery({
    queryKey: ['available-locations-rebook', mockType],
    queryFn: () => traineeApi.getAvailableLocationsForRebook(mockType),
    enabled: enabled && !!mockType,
    staleTime: 60 * 1000, // 1 minute cache for locations
    select: (data) => ({
      locations: data?.locations || []
    })
  });
}

/**
 * Fetch available exams for rebooking
 * Reads directly from Supabase - no HubSpot fallback
 *
 * @param {string} mockType - Filter by mock type (required)
 * @param {string} location - Filter by location (required)
 * @param {string} excludeExamId - Exclude current exam from results
 * @param {boolean} enabled - Whether to enable the query
 * @returns {Object} Query result with exams and locations
 */
export function useAvailableExamsForRebook(mockType, location, excludeExamId, enabled = true) {
  return useQuery({
    queryKey: ['available-exams-rebook', mockType, location, excludeExamId],
    queryFn: () => traineeApi.getAvailableExamsForRebook(mockType, location, excludeExamId),
    enabled: enabled && !!mockType && !!location,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => ({
      exams: data?.exams || [],
      locations: data?.locations || [],
      total_count: data?.total_count || 0
    })
  });
}

/**
 * Rebooking mutation hook
 * Writes to Supabase first, then syncs to HubSpot if hubspot_id exists
 *
 * @param {Object} options - Hook options
 * @param {Function} options.onSuccess - Callback on successful rebooking
 * @param {string} options.contactId - Contact ID for cache invalidation
 * @returns {Object} Mutation result
 */
export function useRebookBooking(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, contactId } = options;

  return useMutation({
    mutationFn: ({ bookingId, newMockExamId }) =>
      traineeApi.rebookBooking(bookingId, newMockExamId),

    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['trainee-bookings'] });
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['trainee-bookings', contactId] });
      }
      // Also invalidate available exams cache
      queryClient.invalidateQueries({ queryKey: ['available-exams-rebook'] });

      const syncedMsg = data.hubspot_synced
        ? 'Booking rebooked and synced to HubSpot'
        : 'Booking rebooked (Supabase only)';
      toast.success(syncedMsg);
      onSuccess?.(data, variables);
    },

    onError: (error) => {
      const message = error?.response?.data?.error?.message || 'Failed to rebook booking';
      toast.error(message);
    }
  });
}
