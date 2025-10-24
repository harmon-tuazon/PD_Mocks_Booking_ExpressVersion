import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
      const response = await adminApi.get('/mock-exams/aggregates', {
        params: sortedFilters
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    placeholderData: keepPreviousData, // Keep previous data while fetching new data (replaces keepPreviousData: true)
    ...options
  });
};