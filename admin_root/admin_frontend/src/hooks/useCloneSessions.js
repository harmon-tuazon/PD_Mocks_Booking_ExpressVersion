import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Custom hook for cloning mock exam sessions with optimistic UI updates
 *
 * This hook provides a mutation function to clone multiple sessions with modified properties.
 * It handles:
 * - Transforming selected sessions into cloneSources format
 * - Sending clone request to backend with overrides
 * - Showing success/error toasts
 * - Optimistically updating cache with new sessions (no refetch needed)
 * - Only invalidating metrics queries that need server-side calculation
 *
 * Performance: Uses optimistic updates instead of cache invalidation for instant UI feedback
 *
 * Usage:
 * ```javascript
 * const cloneMutation = useCloneSessions();
 *
 * cloneMutation.mutate({
 *   selectedSessions: [...], // Array of session objects with all properties
 *   overrides: {
 *     exam_date: '2025-03-15',
 *     location: 'Calgary'
 *   }
 * });
 * ```
 *
 * @returns {MutationResult} React Query mutation object
 */
const useCloneSessions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    /**
     * Mutation function to clone multiple sessions
     * @param {Object} params - Object containing selectedSessions and overrides
     * @param {Array<Object>} params.selectedSessions - Array of session objects with full properties
     * @param {Object} params.overrides - Property overrides (exam_date is required)
     */
    mutationFn: async ({ selectedSessions, overrides }) => {
      if (!selectedSessions || selectedSessions.length === 0) {
        throw new Error('At least one session must be selected');
      }

      if (!overrides || !overrides.exam_date) {
        throw new Error('New exam date is required for cloning');
      }

      console.log(`📋 [CLONE] Requesting clone of ${selectedSessions.length} sessions`);
      console.log(`📝 [CLONE] Overrides:`, overrides);

      // Transform selected sessions into cloneSources format
      // Frontend provides all source session properties - backend doesn't need to refetch from HubSpot
      const cloneSources = selectedSessions.map(session => ({
        sourceSessionId: session.id,
        sourceProperties: {
          mock_type: session.mock_type || '',
          location: session.location || '',
          exam_date: session.exam_date || '',
          capacity: session.capacity || '0',
          start_time: session.start_time || '',
          end_time: session.end_time || '',
          is_active: session.is_active || 'active',
          scheduled_activation_datetime: session.scheduled_activation_datetime || ''
        }
      }));

      const response = await adminApi.post('/admin/mock-exams/clone', {
        cloneSources,
        overrides
      });

      return response.data;
    },

    /**
     * Success handler - optimistically update cache and show success/warning toasts
     * @param {Object} data - Response data from clone API
     */
    onSuccess: (data) => {
      const { summary, results } = data;

      console.log('✅ [CLONE] Clone successful:', summary);
      console.log('📋 [CLONE] Cloned sessions:', results.successful);

      // Show success toast for cloned sessions
      if (summary.created > 0) {
        toast.success(
          `✓ Successfully cloned ${summary.created} of ${summary.total} session${summary.total !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      // Show warning for failed clones
      if (summary.failed > 0) {
        toast.error(
          `⚠️ ${summary.failed} session${summary.failed !== 1 ? 's' : ''} failed to clone`,
          { duration: 8000 }
        );
      }

      // Optimistically update the cache with new cloned sessions
      if (results.successful && results.successful.length > 0) {
        // Update mock-exams-list cache by adding new sessions
        queryClient.setQueriesData(['mock-exams-list'], (oldData) => {
          if (!oldData) return oldData;

          console.log('🔄 [CLONE] Updating mock-exams-list cache with new sessions');

          // Transform API response to match frontend data structure
          const newSessions = results.successful.map(session => ({
            id: session.id,
            ...session.properties,
            // Ensure all required fields exist
            mock_exam_id: session.properties.mock_exam_id || session.id,
            exam_date: session.properties.exam_date || '',
            location: session.properties.location || '',
            mock_type: session.properties.mock_type || '',
            capacity: session.properties.capacity || '0',
            current_bookings: '0', // New sessions start with 0 bookings
            start_time: session.properties.start_time || '',
            end_time: session.properties.end_time || '',
            is_active: session.properties.is_active || 'active',
            scheduled_activation_datetime: session.properties.scheduled_activation_datetime || ''
          }));

          // Add new sessions to the beginning of the list (most recent first)
          return {
            ...oldData,
            mockExams: [...newSessions, ...oldData.mockExams],
            total: oldData.total + newSessions.length
          };
        });

        // Update aggregates cache to reflect new sessions
        queryClient.setQueriesData(['mock-exam-aggregates'], (oldData) => {
          if (!oldData) return oldData;

          console.log('🔄 [CLONE] Updating aggregates cache');

          return {
            ...oldData,
            totalSessions: (oldData.totalSessions || 0) + results.successful.length
          };
        });

        console.log(`✨ [CLONE] Cache updated with ${results.successful.length} new sessions`);
      }

      // Only invalidate metrics queries (which need server calculation)
      // This is more efficient than invalidating everything
      queryClient.invalidateQueries(['mockExamsMetrics']);
      queryClient.invalidateQueries(['metrics']);
    },

    /**
     * Error handler - show error toast
     * @param {Error} error - Error from clone API
     */
    onError: (error) => {
      console.error('❌ [CLONE] Failed to clone sessions:', error);

      // Extract user-friendly error message
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message ||
        'Failed to clone sessions';

      // Show error notification
      toast.error(`✗ Clone Failed: ${message}`, { duration: 6000 });
    },

    /**
     * Called on settled (success or error)
     */
    onSettled: () => {
      console.log('🏁 [CLONE] Mutation settled');
    }
  });
};

export default useCloneSessions;
