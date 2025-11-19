/**
 * useCancelBookingsMutation Hook
 * Handles API calls for batch booking cancellation with optimistic UI updates
 *
 * Features:
 * - React Query mutation for cancelling bookings
 * - Optimistic UI updates (instant feedback)
 * - Error rollback on failure
 * - Minimal cache invalidation (preserves API rate limits)
 * - Toast notifications for success/error/partial results
 * - Detailed error handling
 * - Support for partial failures
 *
 * Performance: Uses optimistic updates with minimal invalidation for instant UI feedback
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mockExamsApi } from '../services/adminApi';
import toast from 'react-hot-toast';

const useCancelBookingsMutation = (mockExamId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookings, refundTokens }) => {
      // Send full booking objects from memory (optimization)
      const requestBody = {
        bookings: bookings.map(b => ({
          id: b.id,
          token_used: b.token_used || '',
          associated_contact_id: b.associated_contact_id || '',
          name: b.name || 'Unknown',
          email: b.email || ''
        })),
        refundTokens: refundTokens !== undefined ? refundTokens : true
      };

      console.log(`🗑️ [CANCEL] Requesting cancellation of ${bookings.length} bookings (refund: ${requestBody.refundTokens})`);

      const response = await mockExamsApi.cancelBookings(mockExamId, requestBody);
      return response;
    },

    onMutate: async ({ bookings }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['bookings', mockExamId]);

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(['bookings', mockExamId]);

      // Extract booking IDs
      const bookingIds = bookings.map(b => b.id);

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

    onSuccess: async (responseData) => {
      const { summary, refundSummary } = responseData.data;

      console.log('✅ [CANCEL] Cancellation successful:', summary);

      // Show cancellation success
      if (summary.cancelled > 0) {
        toast.success(`✓ Cancelled ${summary.cancelled} booking(s)`, { duration: 4000 });
      }

      // Show refund results if enabled
      if (refundSummary?.enabled) {
        if (refundSummary.successful > 0) {
          toast.success(
            `✓ Refunded ${refundSummary.successful} token(s)`,
            { duration: 5000 }
          );
        }
        if (refundSummary.failed > 0) {
          toast.error(
            `⚠️ ${refundSummary.failed} refund(s) failed - check console`,
            { duration: 8000 }
          );
          console.error('❌ [REFUND] Failed refunds:', refundSummary.details?.failed);
        }
        if (refundSummary.skipped > 0) {
          toast.info(
            `ℹ️ ${refundSummary.skipped} booking(s) had no tokens to refund`,
            { duration: 5000 }
          );
        }
      }

      // Only invalidate mock exam detail query to update capacity counts
      // The bookings list was already optimistically updated in onMutate
      // This minimizes API calls while keeping capacity/booking counts accurate
      await queryClient.invalidateQueries(['mockExam', mockExamId]);
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
      console.log('🏁 [CANCEL] Mutation settled');
      // Note: We don't refetch bookings here since onMutate already updated optimistically
      // and onError rolls back on failure. This saves an unnecessary API call.
    }
  });
};

export default useCancelBookingsMutation;