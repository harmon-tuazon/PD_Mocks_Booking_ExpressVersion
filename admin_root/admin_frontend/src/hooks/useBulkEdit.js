/**
 * useBulkEdit Hook
 * Handles bulk editing of mock exam sessions with React Query mutation
 * Includes automatic cache invalidation and error handling
 *
 * Features:
 * - React Query mutation for bulk updates
 * - Automatic cache invalidation for all related queries
 * - Support for partial updates (empty fields not sent)
 * - Detailed success/warning/error handling
 * - Refetch active queries to refresh dashboard
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
     * @param {Array<string>} params.sessionIds - Array of HubSpot Mock Exam IDs to update
     * @param {Object} params.updates - Object with fields to update (empty values are ignored)
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

      const response = await adminApi.post('/admin/mock-exams/bulk-update', {
        sessionIds,
        updates
      });

      return response.data;
    },

    /**
     * Success handler - invalidate queries and show success/warning toasts
     * @param {Object} data - Response data from bulk update API
     */
    onSuccess: (data) => {
      const { summary } = data;

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

      // Invalidate all related queries to trigger refetch
      // This ensures the dashboard and all lists are updated
      queryClient.invalidateQueries(['mockExams']);
      queryClient.invalidateQueries(['mock-exams']);
      queryClient.invalidateQueries(['mock-exams-list']);
      queryClient.invalidateQueries(['mockExamsMetrics']);
      queryClient.invalidateQueries(['mock-exam-aggregates']);
      queryClient.invalidateQueries(['aggregates']);
      queryClient.invalidateQueries(['metrics']);
      queryClient.invalidateQueries(['bookings']);

      // Invalidate specific exam queries for updated sessions
      if (data.details?.updated) {
        data.details.updated.forEach(sessionId => {
          queryClient.invalidateQueries(['mockExam', sessionId]);
        });
      }

      // Refetch all active queries to immediately update the UI
      queryClient.refetchQueries({ active: true });
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