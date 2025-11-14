/**
 * useMassDelete Hook
 * Handles mass deletion of mock exam sessions with React Query mutation
 * Includes automatic cache invalidation and error handling
 *
 * Features:
 * - React Query mutation for batch deletion
 * - Automatic cache invalidation
 * - Support for partial failures
 * - Detailed error handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Hook for mass deleting mock exam sessions
 * @returns {Object} Mutation object with deleteMutate, isDeleting, error, etc.
 */
const useMassDelete = () => {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * Mutation function to delete multiple sessions
     * @param {Array<string>} sessionIds - Array of HubSpot Mock Exam IDs to delete
     */
    mutationFn: async (sessionIds) => {
      if (!sessionIds || sessionIds.length === 0) {
        throw new Error('Session IDs are required');
      }

      console.log(`🗑️ [MASS DELETE] Requesting deletion of ${sessionIds.length} sessions`);

      const response = await adminApi.post('/admin/mock-exams/batch-delete', {
        sessionIds
      });

      return response.data;
    },

    /**
     * Success handler - invalidate queries and show success toast
     * @param {Object} data - Response data from batch delete API
     */
    onSuccess: (data) => {
      const { summary } = data;

      console.log('✅ [MASS DELETE] Deletion successful:', summary);

      // Show success message
      if (summary.deleted > 0) {
        toast.success(
          `✓ Successfully deleted ${summary.deleted} session${summary.deleted !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      // Show warning for sessions with bookings that couldn't be deleted
      if (summary.hasBookings > 0) {
        toast.error(
          `⚠️ ${summary.hasBookings} session${summary.hasBookings !== 1 ? 's' : ''} could not be deleted (has bookings)`,
          { duration: 8000 }
        );
      }

      // Show error for failed deletions
      if (summary.failed > 0) {
        toast.error(
          `❌ ${summary.failed} session${summary.failed !== 1 ? 's' : ''} failed to delete`,
          { duration: 8000 }
        );
        console.error('❌ [MASS DELETE] Failed deletions:', data.details?.failed);
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

      // Remove deleted exams from cache
      if (data.details?.deleted) {
        data.details.deleted.forEach(sessionId => {
          queryClient.removeQueries(['mockExam', sessionId]);
        });
      }
    },

    /**
     * Error handler - show error toast
     * @param {Error} error - Error from batch delete API
     */
    onError: (error) => {
      console.error('❌ [MASS DELETE] Failed to delete sessions:', error);

      // Extract user-friendly error message
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message ||
        'Failed to delete sessions';

      // Show error notification
      toast.error(`✗ Mass Deletion Failed: ${message}`, { duration: 6000 });
    },

    /**
     * Called on settled (success or error)
     */
    onSettled: () => {
      console.log('🏁 [MASS DELETE] Mutation settled');
    }
  });
};

export default useMassDelete;
