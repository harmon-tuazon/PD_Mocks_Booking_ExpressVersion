/**
 * React Query mutation hooks for Work Check Slots
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workCheckSlotsApi } from '../services/adminApi';

/**
 * Hook providing all mutation operations for work check slots
 * @returns {Object} Mutation functions and states
 */
export function useWorkCheckSlotMutations() {
  const queryClient = useQueryClient();

  // Invalidate slots queries
  const invalidateSlots = () => {
    queryClient.invalidateQueries(['work-check-slots']);
  };

  // Create slot mutation
  const createSlot = useMutation({
    mutationFn: (data) => workCheckSlotsApi.create(data),
    onSuccess: (data) => {
      toast.success('Work check slot created successfully');
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to create slot';
      toast.error(message);
    }
  });

  // Update slot mutation
  const updateSlot = useMutation({
    mutationFn: ({ id, data }) => workCheckSlotsApi.update(id, data),
    onSuccess: (data) => {
      toast.success('Work check slot updated successfully');
      invalidateSlots();
      queryClient.invalidateQueries(['work-check-slot']);
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to update slot';
      toast.error(message);
    }
  });

  // Delete slot mutation
  const deleteSlot = useMutation({
    mutationFn: (id) => workCheckSlotsApi.delete(id),
    onSuccess: () => {
      toast.success('Work check slot deleted successfully');
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete slot';
      toast.error(message);
    }
  });

  // Bulk toggle mutation
  const bulkToggle = useMutation({
    mutationFn: ({ ids, action }) => workCheckSlotsApi.bulkToggle(ids, action),
    onSuccess: (data) => {
      const { activated, deactivated } = data.data || {};
      if (activated > 0 && deactivated > 0) {
        toast.success(`Activated ${activated} and deactivated ${deactivated} slot(s)`);
      } else if (activated > 0) {
        toast.success(`Activated ${activated} slot(s)`);
      } else if (deactivated > 0) {
        toast.success(`Deactivated ${deactivated} slot(s)`);
      } else {
        toast.success('Slots updated');
      }
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to toggle slots';
      toast.error(message);
    }
  });

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: (ids) => workCheckSlotsApi.bulkDelete(ids),
    onSuccess: (data) => {
      const { deleted, blocked } = data.data || {};
      if (blocked > 0) {
        toast.success(`Deleted ${deleted} slot(s). ${blocked} slot(s) blocked due to active bookings.`);
      } else {
        toast.success(`Deleted ${deleted} slot(s)`);
      }
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to delete slots';
      toast.error(message);
    }
  });

  // Clone mutation
  const cloneSlots = useMutation({
    mutationFn: (data) => workCheckSlotsApi.clone(data),
    onSuccess: (data) => {
      const { created_count } = data.data || {};
      toast.success(`Successfully cloned ${created_count} slot(s)`);
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to clone slots';
      toast.error(message);
    }
  });

  // Bulk edit mutation
  const bulkEdit = useMutation({
    mutationFn: ({ ids, updates }) => workCheckSlotsApi.bulkEdit(ids, updates),
    onSuccess: (data) => {
      const { updated } = data.data || {};
      toast.success(`Updated ${updated} slot(s)`);
      invalidateSlots();
    },
    onError: (error) => {
      const message = error.response?.data?.error?.message || error.message || 'Failed to update slots';
      toast.error(message);
    }
  });

  return {
    createSlot,
    updateSlot,
    deleteSlot,
    bulkToggle,
    bulkDelete,
    cloneSlots,
    bulkEdit
  };
}

export default useWorkCheckSlotMutations;
