/**
 * Custom hooks for instructor data management
 * Uses TanStack Query for data fetching and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorsApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Hook to fetch instructors list with pagination and filtering
 * @param {Object} params - Query parameters (page, limit, sort_by, sort_order, search, filter_status)
 * @param {Object} options - React Query options
 * @returns {Object} Query result with instructors data
 */
export function useInstructorsData(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructors', JSON.stringify(params)],
    queryFn: () => instructorsApi.list(params),
    staleTime: 5000, // 5 seconds - balance between freshness and API efficiency
    refetchOnWindowFocus: false, // Prevent refetch on tab focus to reduce API calls
    ...options
  });
}

/**
 * Hook to fetch single instructor details
 * @param {string} id - Instructor ID (UUID or instructor_id)
 * @param {Object} options - React Query options
 * @returns {Object} Query result with instructor details
 */
export function useInstructorDetails(id, options = {}) {
  return useQuery({
    queryKey: ['instructor', id],
    queryFn: () => instructorsApi.getById(id),
    enabled: !!id,
    ...options
  });
}

/**
 * Hook to fetch instructors for dropdown (active only, minimal fields)
 * Cached longer since dropdown data doesn't change frequently
 * @param {Object} options - React Query options
 * @returns {Object} Query result with instructor dropdown data
 */
export function useInstructorsDropdown(options = {}) {
  return useQuery({
    queryKey: ['instructorsDropdown'],
    queryFn: () => instructorsApi.getDropdown(),
    staleTime: 60000, // Cache for 1 minute
    ...options
  });
}

/**
 * Hook for instructor mutations (create, update, delete)
 * @returns {Object} Mutation objects for create, update, delete operations
 */
export function useInstructorMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: instructorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      toast.success('Instructor created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to create instructor');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => instructorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      queryClient.invalidateQueries({ queryKey: ['instructor'] });
      toast.success('Instructor updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to update instructor');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: instructorsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      toast.success('Instructor deactivated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to deactivate instructor');
    }
  });

  return {
    createInstructor: createMutation,
    updateInstructor: updateMutation,
    deleteInstructor: deleteMutation
  };
}
