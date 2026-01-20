/**
 * useMockExamDetail Hook
 * React Query hook for fetching mock exam details
 *
 * Matches production implementation - passes timestamps directly from HubSpot
 * without conversion. Timestamps are Unix milliseconds that get formatted by
 * display components using timeFormatters.js
 */

import { useQuery } from '@tanstack/react-query';
import { mockExamsApi, adminApi } from '../services/adminApi';

export const useMockExamDetail = (id) => {
  return useQuery({
    queryKey: ['mockExam', id],
    queryFn: async () => {
      // Use the getById endpoint which includes prerequisite associations
      const response = await mockExamsApi.getById(id);

      // API returns: { success: true, data: { id, mock_type, ..., prerequisite_exams, prerequisite_exam_ids }, meta: {...} }
      // The response is already in the format we need
      if (!response?.data) {
        throw new Error('Invalid API response: missing data');
      }

      // Return the response as-is since it already matches frontend expectations
      // start_time and end_time are formatted as HH:mm by the backend
      // prerequisite_exams and prerequisite_exam_ids are included for Mock Discussion exams
      return response;
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
