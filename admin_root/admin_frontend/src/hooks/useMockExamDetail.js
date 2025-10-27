/**
 * useMockExamDetail Hook
 * React Query hook for fetching mock exam details
 */

import { useQuery } from '@tanstack/react-query';
import { mockExamsApi, adminApi } from '../services/adminApi';

// Helper function to convert Unix timestamp (milliseconds) to HH:mm format
const convertTimestampToTime = (timestamp) => {
  if (!timestamp) return '';

  try {
    // If it's already in HH:mm format, return as is
    if (typeof timestamp === 'string' && timestamp.includes(':')) {
      return timestamp;
    }

    // HubSpot stores times as Unix timestamps in milliseconds
    // Convert to Date object and extract LOCAL time
    const timestampNum = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;

    // Validate it's a reasonable timestamp
    if (isNaN(timestampNum) || timestampNum <= 0) {
      console.warn('Invalid timestamp:', timestamp);
      return '';
    }

    const date = new Date(timestampNum);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date from timestamp:', timestamp);
      return '';
    }

    // Extract hours and minutes in LOCAL timezone
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    console.log('Time conversion:', {
      input: timestamp,
      timestampNum,
      date: date.toISOString(),
      localTime: `${hours}:${minutes}`
    });

    return `${hours}:${minutes}`;
  } catch (error) {
    console.error('Error converting timestamp to time:', error, 'input:', timestamp);
    return '';
  }
};

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
      // Convert Unix timestamps to HH:mm format for times
      return {
        success: apiData.success,
        data: {
          id: mockExam.id,
          mock_type: properties.mock_type || '',
          exam_date: properties.exam_date || '',
          start_time: convertTimestampToTime(properties.start_time),
          end_time: convertTimestampToTime(properties.end_time),
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