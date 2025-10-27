import { useQuery } from '@tanstack/react-query';
import adminApi from '../services/adminApi';

export const useFetchAggregates = (filters = {}, options = {}) => {
  // Create a stable query key by sorting filter keys
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((result, key) => {
      if (filters[key] !== undefined && filters[key] !== '') {
        result[key] = filters[key];
      }
      return result;
    }, {});

  return useQuery({
    queryKey: ['mock-exam-aggregates', sortedFilters],
    queryFn: async () => {
      const response = await adminApi.get('/admin/mock-exams/aggregates', {
        params: sortedFilters
      });
      // Extract and validate the data array from the response object
      const extractedData = response.data?.data || response.data || [];

      // Defensive check: Ensure we ALWAYS return an array, never an object
      return Array.isArray(extractedData) ? extractedData : [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Keep previous data while fetching new data
    ...options
  });
};