/**
 * useTokenEditMutation Hook
 * Handles token update API calls with React Query for trainee credit tokens
 * Provides optimistic updates, automatic cache invalidation, and toast notifications
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { traineeApi } from '../services/adminApi';
import toast from 'react-hot-toast';

export const useTokenEditMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokens) => {
      if (!contactId) {
        throw new Error('Contact ID is required');
      }
      return traineeApi.updateTokens(contactId, tokens);
    },

    onMutate: async (tokens) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['trainee-search']);

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(['trainee-search']);

      // Optimistically update to the new value
      queryClient.setQueryData(['trainee-search'], (old) => {
        if (!old?.data?.contacts) return old;

        return {
          ...old,
          data: {
            ...old.data,
            contacts: old.data.contacts.map(contact =>
              contact.contactId === contactId
                ? {
                    ...contact,
                    tokens: {
                      mock_discussion: tokens.mock_discussion,
                      clinical_skills: tokens.clinical_skills,
                      situational_judgment: tokens.situational_judgment,
                      mini_mock: tokens.mini_mock,
                      shared_mock: tokens.shared_mock || 0
                    }
                  }
                : contact
            )
          }
        };
      });

      // Return a context object with the snapshotted value
      return { previousData };
    },

    onError: (error, tokens, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousData) {
        queryClient.setQueryData(['trainee-search'], context.previousData);
      }

      // Show error toast
      const errorMessage = error?.response?.data?.error?.message ||
                          error?.message ||
                          'Failed to update tokens. Please try again.';

      toast.error(errorMessage, {
        duration: 4000,
        position: 'top-right'
      });

      // Log detailed error for debugging
      console.error('Token update error:', error);
    },

    onSuccess: (data) => {
      // Force refetch (not just invalidate) to ensure UI updates immediately
      // invalidateQueries only marks as stale but may not trigger refetch if staleTime hasn't elapsed
      queryClient.refetchQueries({ queryKey: ['trainee-search'], type: 'active' });

      // Also invalidate specific trainee queries if they exist
      if (contactId) {
        queryClient.invalidateQueries(['trainee', contactId]);
        queryClient.invalidateQueries(['trainee-bookings', contactId]);
      }

      // Show success toast with icon
      toast.success('Tokens updated successfully!', {
        duration: 3000,
        position: 'top-right',
        icon: '✅'
      });

      // Log success for debugging
      console.log('✅ Tokens updated successfully:', data);
    },

    onSettled: () => {
      // Force refetch on settled to ensure data consistency regardless of success/failure
      // Using refetchQueries instead of invalidateQueries to guarantee immediate UI update
      queryClient.refetchQueries({ queryKey: ['trainee-search'], type: 'active' });
    }
  });
};

export default useTokenEditMutation;