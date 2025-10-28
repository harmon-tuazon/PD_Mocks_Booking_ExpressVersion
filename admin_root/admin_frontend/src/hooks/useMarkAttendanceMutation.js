/**
 * useMarkAttendanceMutation Hook
 * Handles API calls for marking attendance in batch
 *
 * Features:
 * - React Query mutation for attendance updates
 * - Optimistic UI updates
 * - Automatic cache invalidation
 * - Toast notifications
 * - Partial failure handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import toast from 'react-hot-toast';

const useMarkAttendanceMutation = (mockExamId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingIds, notes }) => {
      // Transform data to match backend expected format
      const requestBody = {
        bookings: bookingIds.map(id => ({
          bookingId: id,
          attended: true, // We're marking as attended
          notes: notes || ''
        }))
      };

      const response = await adminApi.post(
        `/admin/mock-exams/${mockExamId}/attendance`,
        requestBody
      );

      return response.data;
    },

    onMutate: async ({ bookingIds }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['admin', 'bookings', mockExamId]);

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(['admin', 'bookings', mockExamId]);

      // Optimistically update to the new value
      queryClient.setQueryData(['admin', 'bookings', mockExamId], (old) => {
        if (!old?.data) return old;

        return {
          ...old,
          data: old.data.map(booking => {
            if (bookingIds.includes(booking.id)) {
              return {
                ...booking,
                attendance_status: 'attended',
                attendance_marked_at: new Date().toISOString(),
                booking_status: 'completed'
              };
            }
            return booking;
          })
        };
      });

      // Return a context object with the snapshotted value
      return { previousBookings };
    },

    onSuccess: (data) => {
      const { summary, results } = data;

      // Show success message
      if (summary.updated > 0) {
        toast.success(
          `✓ Successfully marked ${summary.updated} student${summary.updated > 1 ? 's' : ''} as attended`
        );
      }

      // Show warning if some failed
      if (summary.failed > 0) {
        toast.error(
          `⚠ ${summary.failed} booking${summary.failed > 1 ? 's' : ''} failed to update. See console for details.`,
          { duration: 6000 }
        );
        console.error('Failed bookings:', results.failed);
      }

      // Show info if some were skipped
      if (summary.skipped > 0) {
        toast(
          `ℹ ${summary.skipped} booking${summary.skipped > 1 ? 's were' : ' was'} already marked as attended`,
          { duration: 4000 }
        );
      }

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries(['admin', 'bookings', mockExamId]);
      queryClient.invalidateQueries(['admin', 'mock-exam', mockExamId]);
      queryClient.invalidateQueries(['admin', 'metrics']);
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ['admin', 'bookings', mockExamId],
          context.previousBookings
        );
      }

      // Show error toast
      const errorMessage = error?.response?.data?.error?.message || error.message || 'Failed to mark attendance';
      toast.error(`✗ ${errorMessage}`);

      // Log detailed error for debugging
      console.error('Attendance marking error:', error);
    }
  });
};

export default useMarkAttendanceMutation;
