/**
 * useCancelBookingsMutation Hook
 * Handles API calls for batch booking cancellation
 *
 * Features:
 * - React Query mutation for cancelling bookings
 * - Optimistic UI updates
 * - Automatic cache invalidation
 * - Toast notifications for success/error/partial results
 * - Detailed error handling
 * - Support for partial failures
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import toast from 'react-hot-toast';

const useCancelBookingsMutation = (mockExamId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingIds }) => {
      // Transform data to match backend expected format
      const requestBody = {
        bookingIds: bookingIds
      };

      const response = await adminApi.patch(
        `/admin/mock-exams/${mockExamId}/cancel-bookings`,
        requestBody
      );

      return response.data;
    },

    onMutate: async ({ bookingIds }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['bookings', mockExamId]);

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(['bookings', mockExamId]);

      // Optimistically update to show bookings as cancelled
      queryClient.setQueryData(['bookings', mockExamId], (old) => {
        if (!old?.data || !Array.isArray(old.data)) return old;

        return {
          ...old,
          data: old.data.map(booking => {
            if (bookingIds.includes(booking.id)) {
              return {
                ...booking,
                is_active: 'Cancelled',
                booking_status: 'cancelled'
              };
            }
            return booking;
          })
        };
      });

      // Return a context object with the snapshotted value
      return { previousBookings };
    },

    onSuccess: async (data) => {
      const { summary, results } = data;

      // Show success message
      if (summary.cancelled > 0) {
        toast.success(
          `✓ Successfully cancelled ${summary.cancelled} booking${summary.cancelled !== 1 ? 's' : ''}`,
          { duration: 5000 }
        );
      }

      // Show warning if some failed
      if (summary.failed > 0) {
        toast.error(
          `⚠ ${summary.failed} booking${summary.failed !== 1 ? 's' : ''} failed to cancel. See console for details.`,
          { duration: 8000 }
        );
        console.error('Failed cancellations:', results.failed);
      }

      // Show info if some were skipped
      if (summary.skipped > 0) {
        toast(
          `ℹ ${summary.skipped} booking${summary.skipped !== 1 ? 's were' : ' was'} already cancelled`,
          {
            icon: '📋',
            duration: 4000
          }
        );
      }

      // Immediately refetch bookings to show updated status
      await queryClient.refetchQueries(['bookings', mockExamId], { exact: true });

      // Also invalidate related queries for consistency
      await queryClient.invalidateQueries(['admin', 'mock-exam', mockExamId]);
      await queryClient.invalidateQueries(['admin', 'mock-exam', 'details', mockExamId]);
      await queryClient.invalidateQueries(['admin', 'metrics']);
      await queryClient.invalidateQueries(['admin', 'mock-exams']);

      // Log detailed results for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('Cancellation Results:', {
          summary,
          successful: results.successful,
          failed: results.failed,
          skipped: results.skipped
        });
      }
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ['bookings', mockExamId],
          context.previousBookings
        );
      }

      // Extract error message
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error.message ||
        'Failed to cancel bookings';

      // Show error toast
      toast.error(
        `✗ Cancellation Failed: ${errorMessage}`,
        { duration: 6000 }
      );

      // Log detailed error for debugging
      console.error('Booking cancellation error:', {
        error,
        response: error?.response,
        data: error?.response?.data,
        variables
      });
    },

    onSettled: () => {
      // Always refetch to ensure data consistency
      queryClient.invalidateQueries(['bookings', mockExamId]);
    }
  });
};

export default useCancelBookingsMutation;