/**
 * useBookingsByExam Hook
 * React Query hook for fetching bookings by exam ID with pagination, sorting, and search
 */

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';

export const useBookingsByExam = (examId, params = {}) => {
  const {
    search = '',
    sort_by = 'created_at',
    sort_order = 'desc',
    page = 1,
    limit = 50
  } = params;

  // Build query params
  const queryParams = {
    search,
    sort_by,
    sort_order,
    page,
    limit
  };

  // Remove empty params
  Object.keys(queryParams).forEach(key => {
    if (queryParams[key] === '' || queryParams[key] === null || queryParams[key] === undefined) {
      delete queryParams[key];
    }
  });

  return useQuery({
    queryKey: ['bookings', examId, queryParams],
    queryFn: async () => {
      // Call the bookings endpoint with the exam ID as a path parameter
      const response = await adminApi.get(`/admin/mock-exams/${examId}/bookings`, {
        params: queryParams
      });

      // The API returns: { success: true, data: { bookings: [], pagination: {} } }
      const result = response.data;

      // Extract bookings array and pagination from the nested data structure
      const bookingsData = result?.data?.bookings;
      const paginationData = result?.data?.pagination;

      // Map API pagination fields (snake_case) to frontend format (camelCase)
      const normalizedPagination = paginationData ? {
        page: paginationData.page || page,
        limit: paginationData.limit || limit,
        total: paginationData.total_bookings || 0,
        totalPages: paginationData.total_pages || 0,
        hasNextPage: paginationData.has_next || false,
        hasPrevPage: paginationData.has_prev || false
      } : {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      };

      // Defensive: Ensure we always return properly structured data with arrays
      return {
        data: Array.isArray(bookingsData) ? bookingsData : [],
        pagination: normalizedPagination
      };
    },
    enabled: !!examId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep previous data while fetching new page
    onError: (error) => {
      console.error('Error fetching bookings:', error);
    }
  });
};