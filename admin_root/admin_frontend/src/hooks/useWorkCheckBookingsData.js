/**
 * React Query hooks for Work Check Bookings data fetching
 */

import { useQuery } from '@tanstack/react-query';
import { workCheckBookingsApi } from '../services/adminApi';

/**
 * Hook to fetch work check booking aggregates
 * @param {Object} params - Query parameters (page, limit, location, date_from, date_to, status, type, instructor_id)
 * @returns {Object} React Query result
 */
export function useWorkCheckBookingAggregates(params = {}) {
  return useQuery({
    queryKey: ['work-check-booking-aggregates', params],
    queryFn: () => workCheckBookingsApi.getAggregates(params),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook to fetch work check bookings (flat list)
 * @param {Object} params - Query parameters (page, limit, filters, etc.)
 * @returns {Object} React Query result
 */
export function useWorkCheckBookingsData(params = {}) {
  return useQuery({
    queryKey: ['work-check-bookings', params],
    queryFn: () => workCheckBookingsApi.list(params),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false
  });
}

/**
 * Hook to fetch a single work check booking
 * @param {string} id - Booking ID
 * @param {Object} options - Additional query options
 * @returns {Object} React Query result
 */
export function useWorkCheckBooking(id, options = {}) {
  return useQuery({
    queryKey: ['work-check-booking', id],
    queryFn: () => workCheckBookingsApi.get(id),
    enabled: !!id,
    staleTime: 30000,
    ...options
  });
}

export default useWorkCheckBookingsData;
