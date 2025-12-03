/**
 * useBulkEdit Hook
 * Handles bulk editing of mock exam sessions with optimistic UI updates
 *
 * Features:
 * - React Query mutation for bulk updates
 * - Optimistic cache updates (no refetch needed)
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
     * Success handler - optimistically update cache and show success/warning toasts
     * @param {Object} data - Response data from bulk update API
     * @param {Object} variables - The mutation variables (sessionIds and updates)
     */
    onSuccess: (data, variables) => {
      const { summary } = data;
      const { updates } = variables;

      console.log('✅ [BULK EDIT] Update successful:', summary);

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

      // Invalidate all related queries to force refetch with fresh data
      // This ensures both list view and aggregate view show updated data
      if (data.details?.updated && data.details.updated.length > 0) {
        console.log(`✨ [BULK EDIT] ${data.details.updated.length} sessions updated - invalidating caches`);

        // Invalidate mockExams queries (list view) - uses parameterized keys like ['mockExams', '{"page":1}']
        queryClient.invalidateQueries({ queryKey: ['mockExams'] });

        // Invalidate aggregates queries (group view)
        queryClient.invalidateQueries({ queryKey: ['mock-exam-aggregates'] });

        // Invalidate infinite scroll queries if used
        queryClient.invalidateQueries({ queryKey: ['mockExamsInfinite'] });

        // Invalidate individual exam detail queries for updated sessions
        data.details.updated.forEach(sessionId => {
          queryClient.invalidateQueries({ queryKey: ['mockExamDetails', sessionId] });
        });
      }

      // Also invalidate metrics queries
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },

    /**
     * Error handler - show error toast
     * @param {Error} error - Error from bulk update API
     */
    onError: (error) => {
      console.error('❌ [BULK EDIT] Failed to update sessions:', error);

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
    }
  });
};

export default useBulkEdit;