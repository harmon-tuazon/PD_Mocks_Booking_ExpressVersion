/**
 * React Query hooks for Work Check Slots data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { workCheckSlotsApi } from '../services/adminApi';

/**
 * Hook to fetch work check slots with pagination and filtering
 * @param {Object} params - Query parameters (page, limit, filters, etc.)
 * @returns {Object} React Query result
 */
export function useWorkCheckSlotsData(params = {}) {
  return useQuery({
    queryKey: ['work-check-slots', params],
    queryFn: () => workCheckSlotsApi.list(params),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  });
}

/**
 * Hook to fetch a single work check slot
 * @param {string} id - Slot ID
 * @param {Object} options - Additional query options
 * @returns {Object} React Query result
 */
export function useWorkCheckSlot(id, options = {}) {
  return useQuery({
    queryKey: ['work-check-slot', id],
    queryFn: () => workCheckSlotsApi.get(id),
    enabled: !!id,
    staleTime: 30000,
    ...options
  });
}

export default useWorkCheckSlotsData;
