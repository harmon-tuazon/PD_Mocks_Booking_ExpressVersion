/**
 * Custom hooks for instructor portal data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorPortalApi } from '../services/adminApi';

/**
 * Hook for fetching instructor profile
 */
export function useInstructorProfile(options = {}) {
  return useQuery({
    queryKey: ['instructor', 'me'],
    queryFn: () => instructorPortalApi.getMe(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching instructor dashboard stats
 */
export function useInstructorDashboardStats(options = {}) {
  return useQuery({
    queryKey: ['instructor', 'dashboard-stats'],
    queryFn: () => instructorPortalApi.getDashboardStats(),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    ...options
  });
}

/**
 * Hook for fetching instructor's assigned groups
 */
export function useInstructorGroups(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'groups', JSON.stringify(params)],
    queryFn: () => instructorPortalApi.listGroups(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching a specific group's details
 */
export function useInstructorGroupDetail(groupId, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'groups', groupId],
    queryFn: () => instructorPortalApi.getGroup(groupId),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching instructor's upcoming schedule
 */
export function useInstructorSchedule(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'schedule', JSON.stringify(params)],
    queryFn: () => instructorPortalApi.getSchedule(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Mutation hook for marking/unmarking bookings
 */
export function useMarkBookings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingIds, action }) =>
      instructorPortalApi.markBookings(bookingIds, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'schedule'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard-stats'] });
    }
  });
}
