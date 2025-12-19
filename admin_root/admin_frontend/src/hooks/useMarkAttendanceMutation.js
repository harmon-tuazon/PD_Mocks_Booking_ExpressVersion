/**
 * useMarkAttendanceMutation Hook
 * Handles API calls for marking attendance in batch
 *
 * Features:
 * - React Query mutation for attendance updates
 * - Multi-action support (mark_yes, mark_no, unmark)
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
    // Now accepts selectedBookings array with { id, hubspot_id } objects
    mutationFn: async ({ bookingIds, selectedBookings, action, notes }) => {
      // Map action to attended value
      let attended;
      switch (action) {
        case 'mark_yes':
          attended = true;
          break;
        case 'mark_no':
          attended = false;
          break;
        case 'unmark':
          attended = null;
          break;
        default:
          attended = true; // Default to mark as attended for backward compatibility
      }

      // Transform data to match backend expected format
      // Send both id (Supabase UUID) and hubspot_id for cascading lookup
      const requestBody = {
        bookings: (selectedBookings || []).map((booking, index) => ({
          // Use hubspot_id if available, otherwise use id (Supabase UUID)
          // Backend will use cascading lookup to resolve the HubSpot ID
          bookingId: booking.hubspot_id || booking.id,
          id: booking.id, // Supabase UUID for fallback
          hubspot_id: booking.hubspot_id, // May be null for Supabase-only bookings
          attended: attended,
          notes: notes || ''
        }))
      };

      const response = await adminApi.post(
        `/admin/mock-exams/${mockExamId}/attendance`,
        requestBody
      );

      return response.data;
    },

    onMutate: async ({ bookingIds, action }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['bookings', mockExamId]);

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(['bookings', mockExamId]);

      // Map action to attendance value for optimistic update
      let newAttendanceValue;
      switch (action) {
        case 'mark_yes':
          newAttendanceValue = 'Yes';
          break;
        case 'mark_no':
          newAttendanceValue = 'No';
          break;
        case 'unmark':
          newAttendanceValue = '';
          break;
        default:
          newAttendanceValue = 'Yes';
      }

      // Optimistically update to the new value
      queryClient.setQueryData(['bookings', mockExamId], (old) => {
        if (!Array.isArray(old)) return old;

        return old.map(booking => {
          if (bookingIds.includes(booking.id)) {
            return {
              ...booking,
              attendance: newAttendanceValue
            };
          }
          return booking;
        });
      });

      // Return a context object with the snapshotted value
      return { previousBookings };
    },

    onSuccess: async (data, variables) => {
      const { summary, results } = data;
      const { action } = variables;

      // Get action-specific messaging
      const getActionMessage = () => {
        switch (action) {
          case 'mark_yes':
            return {
              success: 'marked as attended',
              skipped: 'already marked as attended'
            };
          case 'mark_no':
            return {
              success: 'marked as no show',
              skipped: 'already marked as no show'
            };
          case 'unmark':
            return {
              success: 'unmarked',
              skipped: 'already unmarked'
            };
          default:
            return {
              success: 'updated',
              skipped: 'already updated'
            };
        }
      };

      const messages = getActionMessage();

      // Show success message
      if (summary.updated > 0) {
        toast.success(
          `✓ Successfully ${messages.success} ${summary.updated} student${summary.updated > 1 ? 's' : ''}`
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
          `ℹ ${summary.skipped} booking${summary.skipped > 1 ? 's were' : ' was'} ${messages.skipped}`,
          { duration: 4000 }
        );
      }

      // Immediately refetch bookings to show updated attendance status
      await queryClient.refetchQueries(['bookings', mockExamId], { exact: true });

      // Also invalidate related queries for consistency
      await queryClient.invalidateQueries(['admin', 'mock-exam', mockExamId]);
      await queryClient.invalidateQueries(['admin', 'metrics']);
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ['bookings', mockExamId],
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
