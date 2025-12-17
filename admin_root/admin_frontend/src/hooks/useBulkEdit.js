/**
 * useBulkEdit Hook
 * Handles bulk editing of mock exam sessions with optimistic UI updates
 *
 * Features:
 * - React Query mutation for bulk updates
 * - True optimistic cache updates (instant UI feedback before server response)
 * - Error rollback on failure
 * - Support for partial updates (empty fields not sent)
 * - Detailed success/warning/error handling
 * - Only invalidates metrics queries that need server calculation
 *
 * Performance: Uses optimistic updates instead of cache invalidation for instant UI feedback
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Hook for bulk editing mock exam sessions
 * @returns {Object} Mutation object with mutate, isPending, error, etc.
 */
const useBulkEdit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * Mutation function to bulk update multiple sessions
     * @param {Object} params - Object containing sessionIds and updates
     * @param {Array<string>} params.sessionIds - Array of HubSpot Mock Exam IDs
     * @param {Object} params.updates - Updates to apply to all sessions
     */
    mutationFn: async ({ sessionIds, updates }) => {
      if (!sessionIds || sessionIds.length === 0) {
        throw new Error('Session IDs are required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('At least one field must be updated');
      }

      console.log(`✏️ [BULK EDIT] Requesting update of ${sessionIds.length} sessions`);
      console.log(`📝 [BULK EDIT] Updates:`, updates);

      // Send sessionIds + updates - backend fetches current state from HubSpot
      const response = await adminApi.post('/admin/mock-exams/bulk-update', {
        sessionIds,
        updates
      });

      return response.data;
    },

    /**
     * Optimistic update - instantly update cache before server response
     * @param {Object} variables - The mutation variables (sessionIds and updates)
     */
    onMutate: async ({ sessionIds, updates }) => {
      console.log('🚀 [BULK EDIT] Starting optimistic update for', sessionIds.length, 'sessions');

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['mockExams'] });
      await queryClient.cancelQueries({ queryKey: ['mock-exam-aggregates'] });
      await queryClient.cancelQueries({ queryKey: ['mockExamsInfinite'] });

      // Snapshot the previous values for all affected query caches
      const previousData = {
        mockExams: [],
        aggregates: [],
        infinite: []
      };

      // Get all mockExams queries (they have parameterized keys like ['mockExams', '{"page":1}'])
      const mockExamsQueries = queryClient.getQueriesData({ queryKey: ['mockExams'] });
      previousData.mockExams = mockExamsQueries;

      // Get all aggregate queries
      const aggregateQueries = queryClient.getQueriesData({ queryKey: ['mock-exam-aggregates'] });
      previousData.aggregates = aggregateQueries;

      // Get all infinite scroll queries
      const infiniteQueries = queryClient.getQueriesData({ queryKey: ['mockExamsInfinite'] });
      previousData.infinite = infiniteQueries;

      // Optimistically update mockExams queries (list view)
      mockExamsQueries.forEach(([queryKey, data]) => {
        if (data?.data && Array.isArray(data.data)) {
          queryClient.setQueryData(queryKey, {
            ...data,
            data: data.data.map(exam => {
              if (sessionIds.includes(exam.id) || sessionIds.includes(exam.hubspot_id)) {
                return { ...exam, ...updates };
              }
              return exam;
            })
          });
        }
      });

      // Optimistically update aggregate queries (group view)
      aggregateQueries.forEach(([queryKey, data]) => {
        if (data?.data && Array.isArray(data.data)) {
          queryClient.setQueryData(queryKey, {
            ...data,
            data: data.data.map(aggregate => {
              // Check if this aggregate contains any of the updated sessions
              if (aggregate.sessions && Array.isArray(aggregate.sessions)) {
                const updatedSessions = aggregate.sessions.map(session => {
                  if (sessionIds.includes(session.id) || sessionIds.includes(session.hubspot_id)) {
                    return { ...session, ...updates };
                  }
                  return session;
                });
                return { ...aggregate, sessions: updatedSessions };
              }
              return aggregate;
            })
          });
        }
      });

      // Optimistically update infinite scroll queries
      infiniteQueries.forEach(([queryKey, data]) => {
        if (data?.pages && Array.isArray(data.pages)) {
          queryClient.setQueryData(queryKey, {
            ...data,
            pages: data.pages.map(page => {
              if (page?.data && Array.isArray(page.data)) {
                return {
                  ...page,
                  data: page.data.map(exam => {
                    if (sessionIds.includes(exam.id) || sessionIds.includes(exam.hubspot_id)) {
                      return { ...exam, ...updates };
                    }
                    return exam;
                  })
                };
              }
              return page;
            })
          });
        }
      });

      // Also update individual exam detail queries for the updated sessions
      sessionIds.forEach(sessionId => {
        const detailData = queryClient.getQueryData(['mockExamDetails', sessionId]);
        if (detailData?.data) {
          queryClient.setQueryData(['mockExamDetails', sessionId], {
            ...detailData,
            data: { ...detailData.data, ...updates }
          });
        }
        // Also check mockExam key (used by useMockExamDetail)
        const mockExamData = queryClient.getQueryData(['mockExam', sessionId]);
        if (mockExamData?.data) {
          queryClient.setQueryData(['mockExam', sessionId], {
            ...mockExamData,
            data: { ...mockExamData.data, ...updates }
          });
        }
      });

      console.log('✅ [BULK EDIT] Optimistic update applied');

      // Return context with previous data for rollback
      return { previousData };
    },

    /**
     * Success handler - show success/warning toasts, invalidate metrics only
     * @param {Object} data - Response data from bulk update API
     * @param {Object} variables - The mutation variables (sessionIds and updates)
     */
    onSuccess: (data, variables) => {
      const { summary } = data;

      console.log('✅ [BULK EDIT] Server confirmed update:', summary);

      // Show success message for updated sessions
      if (summary.updated > 0) {
        toast.success(
          `✓ Successfully updated ${summary.updated} session${summary.updated !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      // Show warning for sessions that couldn't be updated (have bookings)
      if (summary.skipped > 0) {
        toast.error(
          `⚠️ ${summary.skipped} session${summary.skipped !== 1 ? 's' : ''} could not be updated (has bookings)`,
          { duration: 8000 }
        );
      }

      // Show error for failed updates
      if (summary.failed > 0) {
        toast.error(
          `❌ ${summary.failed} session${summary.failed !== 1 ? 's' : ''} failed to update`,
          { duration: 8000 }
        );
        console.error('❌ [BULK EDIT] Failed updates:', data.details?.failed);
      }

      // Only invalidate metrics queries - they need server calculation
      // The list/aggregate/detail queries were already optimistically updated
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },

    /**
     * Error handler - rollback optimistic updates and show error toast
     * @param {Error} error - Error from bulk update API
     * @param {Object} variables - The mutation variables
     * @param {Object} context - Context from onMutate with previousData
     */
    onError: (error, variables, context) => {
      console.error('❌ [BULK EDIT] Failed to update sessions:', error);

      // Rollback optimistic updates on error
      if (context?.previousData) {
        console.log('🔄 [BULK EDIT] Rolling back optimistic updates');

        // Restore mockExams queries
        context.previousData.mockExams.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });

        // Restore aggregate queries
        context.previousData.aggregates.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });

        // Restore infinite scroll queries
        context.previousData.infinite.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });

        // Restore individual exam detail queries
        variables.sessionIds.forEach(sessionId => {
          queryClient.invalidateQueries({ queryKey: ['mockExamDetails', sessionId] });
          queryClient.invalidateQueries({ queryKey: ['mockExam', sessionId] });
        });
      }

      // Extract user-friendly error message
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message ||
        'Failed to update sessions';

      // Show error notification
      toast.error(`✗ Bulk Edit Failed: ${message}`, { duration: 6000 });
    },

    /**
     * Called on settled (success or error)
     */
    onSettled: () => {
      console.log('🏁 [BULK EDIT] Mutation settled');
      // Note: We don't refetch list/aggregate queries here since onMutate already updated optimistically
      // and onError rolls back on failure. This saves unnecessary API calls.
    }
  });
};

export default useBulkEdit;
