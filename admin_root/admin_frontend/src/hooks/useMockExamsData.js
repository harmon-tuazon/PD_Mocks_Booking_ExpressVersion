/**
 * Custom hook for fetching and managing mock exams data
 */

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { mockExamsApi } from '../services/adminApi';

/**
 * Hook to fetch mock exams list with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {Object} options - React Query options
 * @returns {Object} Query result with mock exams data
 */
export function useMockExamsData(params = {}, options = {}) {
  return useQuery({
    queryKey: ['mockExams', JSON.stringify(params)],
    queryFn: () => mockExamsApi.list(params),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    ...options
  });
}

/**
 * Hook to fetch dashboard metrics
 * @param {Object} filters - Date range filters
 * @param {Object} options - React Query options
 * @returns {Object} Query result with metrics data
 */
export function useMockExamsMetrics(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['mockExamsMetrics', JSON.stringify(filters)],
    queryFn: () => mockExamsApi.getMetrics(filters),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    ...options
  });
}

/**
 * Hook to fetch single mock exam details
 * @param {string} id - Mock exam ID
 * @param {Object} options - React Query options
 * @returns {Object} Query result with mock exam details
 */
export function useMockExamDetails(id, options = {}) {
  return useQuery({
    queryKey: ['mockExamDetails', id],
    queryFn: () => mockExamsApi.getById(id),
    enabled: !!id,
    ...options
  });
}

/**
 * Hook to fetch mock exams with infinite scroll
 * @param {Object} params - Query parameters (filters, sort, etc.)
 * @param {Object} options - React Query options
 * @returns {Object} Infinite query result with mock exams data
 */
export function useMockExamsInfinite(params = {}, options = {}) {
  return useInfiniteQuery({
    queryKey: ['mockExamsInfinite', JSON.stringify(params)],
    queryFn: ({ pageParam = 1 }) =>
      mockExamsApi.list({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      if (!pagination) return undefined;

      const hasNextPage = pagination.current_page < pagination.total_pages;
      return hasNextPage ? pagination.current_page + 1 : undefined;
    },
    staleTime: 30000, // 30 seconds
    ...options
  });
}
