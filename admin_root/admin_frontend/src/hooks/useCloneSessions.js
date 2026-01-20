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

      // Invalidate all related queries to force refetch with fresh data
      // This ensures both list view and aggregate view show updated data
      if (results.successful && results.successful.length > 0) {
        console.log(`✨ [CLONE] ${results.successful.length} sessions cloned - invalidating caches`);

        // Invalidate mockExams queries (list view) - uses parameterized keys like ['mockExams', '{"page":1}']
        queryClient.invalidateQueries({ queryKey: ['mockExams'] });

        // Invalidate aggregates queries (group view)
        queryClient.invalidateQueries({ queryKey: ['mock-exam-aggregates'] });

        // Invalidate infinite scroll queries if used
        queryClient.invalidateQueries({ queryKey: ['mockExamsInfinite'] });
      }

      // Also invalidate metrics queries
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
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
