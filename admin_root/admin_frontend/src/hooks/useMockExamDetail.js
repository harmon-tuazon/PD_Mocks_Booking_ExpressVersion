/**
 * useMockExamDetail Hook
 * React Query hook for fetching mock exam details
 */

import { useQuery } from '@tanstack/react-query';
import { mockExamsApi, adminApi } from '../services/adminApi';

export const useMockExamDetail = (id) => {
  return useQuery({
    queryKey: ['mockExam', id],
    queryFn: async () => {
      // Use the existing get endpoint that takes id as a query param
      const response = await adminApi.get('/admin/mock-exams/get', {
        params: { id }
      });
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('Error fetching mock exam details:', error);
    }
  });
};