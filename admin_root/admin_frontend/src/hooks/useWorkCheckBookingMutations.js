/**
 * React Query mutation hooks for Work Check Bookings
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workCheckBookingsApi } from '../services/adminApi';

/**
 * Hook providing all mutation operations for work check bookings
 * @returns {Object} Mutation functions and states
 */
export function useWorkCheckBookingMutations() {
  const queryClient = useQueryClient();

  // Invalidate bookings queries
  const invalidateBookings = () => {
    queryClient.invalidateQueries(['work-check-bookings']);
    queryClient.invalidateQueries(['work-check-booking-aggregates']);
  };

  // Create booking mutation
  const createBooking = useMutation({
    mutationFn: (data) => workCheckBookingsApi.create(data),
    onSuccess: (data) => {
      const message = data.message || 'Booking created successfully';
      toast.success(message);
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to create booking';
      toast.error(message);
    }
  });

  // Update booking mutation
  const updateBooking = useMutation({
    mutationFn: ({ id, data }) => workCheckBookingsApi.update(id, data),
    onSuccess: (data) => {
      toast.success('Booking updated successfully');
      invalidateBookings();
      queryClient.invalidateQueries(['work-check-booking']);
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to update booking';
      toast.error(message);
    }
  });

  // Delete booking mutation
  const deleteBooking = useMutation({
    mutationFn: (id) => workCheckBookingsApi.delete(id),
    onSuccess: () => {
      toast.success('Booking deleted successfully');
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete booking';
      toast.error(message);
    }
  });

  // Bulk toggle status mutation
  const bulkToggle = useMutation({
    mutationFn: ({ ids, targetStatus }) => workCheckBookingsApi.bulkToggle(ids, targetStatus),
    onSuccess: (data) => {
      const { updated, target_status } = data.data || {};
      toast.success(`Updated ${updated} booking(s) to ${target_status}`);
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to update bookings';
      toast.error(message);
    }
  });

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: (ids) => workCheckBookingsApi.bulkDelete(ids),
    onSuccess: (data) => {
      const { deleted } = data.data || {};
      toast.success(`Deleted ${deleted} booking(s)`);
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete bookings';
      toast.error(message);
    }
  });

  // Clone mutation
  const cloneBookings = useMutation({
    mutationFn: (data) => workCheckBookingsApi.clone(data),
    onSuccess: (data) => {
      const { created } = data.data || {};
      toast.success(`Successfully cloned ${created} booking(s)`);
      invalidateBookings();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to clone bookings';
      toast.error(message);
    }
  });

  return {
    createBooking,
    updateBooking,
    deleteBooking,
    bulkToggle,
    bulkDelete,
    cloneBookings
  };
}

export default useWorkCheckBookingMutations;
