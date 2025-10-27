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

      // API returns: { success: true, mockExam: { id, properties: {...}, bookings: [], metadata: {} } }
      // Transform to match frontend expectations: { success: true, data: { id, ...properties, created_at, updated_at } }
      const apiData = response.data;

      if (!apiData?.mockExam) {
        throw new Error('Invalid API response: missing mockExam data');
      }

      const mockExam = apiData.mockExam;
      const properties = mockExam.properties || {};
      const metadata = mockExam.metadata || {};

      // Flatten the structure for easier use in the frontend
      return {
        success: apiData.success,
        data: {
          id: mockExam.id,
          mock_type: properties.mock_type || '',
          exam_date: properties.exam_date || '',
          start_time: properties.start_time || '',
          end_time: properties.end_time || '',
          capacity: properties.capacity || 0,
          total_bookings: properties.total_bookings || 0,
          location: properties.location || '',
          is_active: properties.is_active === true || properties.is_active === 'true',
          created_at: metadata.created_at || '',
          updated_at: metadata.updated_at || ''
        }
      };
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