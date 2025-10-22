/**
 * Custom hook for fetching and managing mock exams data
 */

import { useQuery } from '@tanstack/react-query';
import { mockExamsApi } from '../services/adminApi';

/**
 * Hook to fetch mock exams list with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {Object} options - React Query options
 * @returns {Object} Query result with mock exams data
 */
export function useMockExamsData(params = {}, options = {}) {
  return useQuery({
    queryKey: ['mockExams', params],
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
    queryKey: ['mockExamsMetrics', filters],
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
