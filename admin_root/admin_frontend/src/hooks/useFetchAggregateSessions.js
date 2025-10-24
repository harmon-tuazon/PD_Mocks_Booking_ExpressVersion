import { useQuery } from '@tanstack/react-query';
import adminApi from '../services/adminApi';

export const useFetchAggregateSessions = (aggregateKey, options = {}) => {
  return useQuery({
    queryKey: ['aggregate-sessions', aggregateKey],
    queryFn: async () => {
      if (!aggregateKey) return null;

      const response = await adminApi.get(`/mock-exams/aggregates/${aggregateKey}/sessions`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    ...options
  });
};