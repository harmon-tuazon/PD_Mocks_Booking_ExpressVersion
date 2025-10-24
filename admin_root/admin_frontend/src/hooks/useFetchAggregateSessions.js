import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import adminApi from '../services/adminApi';

export const useFetchAggregateSessions = (aggregateKey, options = {}) => {
  // Extract enabled from options with default value
  const { enabled = true, ...restOptions } = options;

  const queryResult = useQuery({
    queryKey: ['aggregate-sessions', aggregateKey],
    queryFn: async () => {
      if (!aggregateKey) {
        throw new Error('Aggregate key is required');
      }

      console.log(`📊 Fetching sessions for aggregate: ${aggregateKey}`);
      const response = await adminApi.get(`/admin/mock-exams/aggregates/${aggregateKey}/sessions`);
      // Extract the sessions array from the response object
      return {
        sessions: response.data.sessions || [],
        aggregate_info: response.data.aggregate_info
      };
    },
    // Only enable if aggregateKey exists AND enabled is true
    enabled: Boolean(aggregateKey) && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  });

  // Force refetch when enabled changes from false to true
  useEffect(() => {
    if (enabled && aggregateKey && queryResult.isStale && !queryResult.isFetching) {
      queryResult.refetch();
    }
  }, [enabled, aggregateKey]);

  return queryResult;
};;;