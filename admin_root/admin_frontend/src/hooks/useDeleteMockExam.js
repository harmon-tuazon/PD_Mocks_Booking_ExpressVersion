/**
 * useDeleteMockExam Hook
 * Handles mock exam deletion with React Query mutation
 * Includes automatic cache invalidation and toast notifications
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mockExamsApi } from '../services/adminApi';

/**
 * Hook for deleting a mock exam
 * @returns {Object} Mutation object with mutate, isLoading, error, etc.
 */
export function useDeleteMockExam() {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * Mutation function to delete exam
     * @param {string} examId - HubSpot Mock Exam ID
     */
    mutationFn: async (examId) => {
      if (!examId) {
        throw new Error('Exam ID is required');
      }
      return await mockExamsApi.delete(examId);
    },

    /**
     * Success handler - invalidate queries and show success toast
     * @param {Object} data - Response data from delete API
     * @param {string} examId - The deleted exam ID
     */
    onSuccess: (data, examId) => {
      console.log('✅ Mock exam deleted successfully:', examId);

      // Invalidate all related queries to trigger refetch
      // This ensures the dashboard and all lists are updated
      queryClient.invalidateQueries(['mockExams']);
      queryClient.invalidateQueries(['mockExamsMetrics']);
      queryClient.invalidateQueries(['mock-exam-aggregates']);

      // Remove the specific exam from cache since it no longer exists
      queryClient.removeQueries(['mockExam', examId]);

      // Show success notification
      toast.success(data?.message || 'Mock exam deleted successfully');
    },

    /**
     * Error handler - show error toast
     * @param {Error} error - Error from delete API
     */
    onError: (error) => {
      console.error('❌ Failed to delete mock exam:', error);

      // Extract user-friendly error message
      const message = error.message || 'Failed to delete mock exam';

      // Show error notification
      toast.error(message);
    },

    /**
     * Optional: Called on settled (success or error)
     */
    onSettled: () => {
      console.log('🏁 Delete mutation settled');
    }
  });
}

export default useDeleteMockExam;
