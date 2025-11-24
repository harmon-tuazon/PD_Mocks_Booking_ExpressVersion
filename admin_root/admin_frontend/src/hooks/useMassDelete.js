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
     * Success handler - optimistically update cache and show success/warning toasts
     * @param {Object} data - Response data from batch delete API
     */
    onSuccess: (data) => {
      const { summary, deleted, failed, errors } = data;

      console.log('✅ [MASS DELETE] Deletion successful:', summary);
      console.log('✅ [MASS DELETE] Deleted IDs:', deleted);
      console.log('❌ [MASS DELETE] Failed IDs:', failed);
      console.log('❌ [MASS DELETE] Errors:', errors);

      // Show success message
      if (summary.deleted > 0) {
        toast.success(
          `✓ Successfully deleted ${summary.deleted} session${summary.deleted !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      // Show warning for sessions with bookings that couldn't be deleted
      if (summary.withBookings > 0) {
        toast.error(
          `⚠️ ${summary.withBookings} session${summary.withBookings !== 1 ? 's' : ''} could not be deleted (has bookings)`,
          { duration: 8000 }
        );
      }

      // Show warning for sessions not found
      if (summary.notFound > 0) {
        toast.error(
          `⚠️ ${summary.notFound} session${summary.notFound !== 1 ? 's' : ''} not found (may have been already deleted)`,
          { duration: 8000 }
        );
      }

      // Show error for other failed deletions
      if (summary.errors > 0) {
        toast.error(
          `❌ ${summary.errors} session${summary.errors !== 1 ? 's' : ''} failed to delete due to errors`,
          { duration: 8000 }
        );
        console.error('❌ [MASS DELETE] Failed deletions:', errors);
      }

      // Optimistically update the cache by removing deleted sessions
      if (deleted && deleted.length > 0) {
        // Update mock-exams-list cache by removing deleted sessions
        queryClient.setQueriesData(['mock-exams-list'], (oldData) => {
          if (!oldData) return oldData;

          console.log('🔄 [MASS DELETE] Optimistically removing sessions from mock-exams-list cache');

          return {
            ...oldData,
            mockExams: oldData.mockExams.filter(exam => !deleted.includes(exam.id)),
            total: oldData.total - deleted.length
          };
        });

        // Update aggregates cache to reflect removed sessions
        queryClient.setQueriesData(['mock-exam-aggregates'], (oldData) => {
          if (!oldData) return oldData;

          console.log('🔄 [MASS DELETE] Updating aggregates cache');

          return {
            ...oldData,
            totalSessions: Math.max(0, (oldData.totalSessions || 0) - deleted.length)
          };
        });

        // Remove individual exam queries from cache
        deleted.forEach(sessionId => {
          queryClient.removeQueries({ queryKey: ['mockExam', sessionId] });
          queryClient.removeQueries({ queryKey: ['mockExamDetails', sessionId] });
        });

        console.log(`✨ [MASS DELETE] Cache updated - removed ${deleted.length} sessions`);
      }

      // Only invalidate metrics queries (which need server calculation)
      // This is more efficient than invalidating everything
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
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
