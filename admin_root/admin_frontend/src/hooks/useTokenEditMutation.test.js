/**
 * Test file for useTokenEditMutation hook
 * Validates token editing functionality with React Query
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTokenEditMutation } from './useTokenEditMutation';
import { traineeApi } from '../services/adminApi';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('../services/adminApi');
jest.mock('react-hot-toast');

describe('useTokenEditMutation', () => {
  let queryClient;
  const mockContactId = '41459711858';
  const mockTokens = {
    mock_discussion: 5,
    clinical_skills: 3,
    situational_judgment: 2,
    mini_mock: 1,
    shared_mock: 0
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should successfully update tokens', async () => {
    const mockResponse = {
      success: true,
      data: {
        contactId: mockContactId,
        tokens: mockTokens
      }
    };

    traineeApi.updateTokens.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(
      () => useTokenEditMutation(mockContactId),
      { wrapper }
    );

    result.current.mutate(mockTokens);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(traineeApi.updateTokens).toHaveBeenCalledWith(mockContactId, mockTokens);
    expect(toast.success).toHaveBeenCalledWith(
      'Tokens updated successfully!',
      expect.objectContaining({
        duration: 3000,
        position: 'top-right',
        icon: '✅'
      })
    );
  });

  it('should handle errors properly', async () => {
    const mockError = new Error('Network error');
    traineeApi.updateTokens.mockRejectedValueOnce(mockError);

    const { result } = renderHook(
      () => useTokenEditMutation(mockContactId),
      { wrapper }
    );

    result.current.mutate(mockTokens);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Network error',
      expect.objectContaining({
        duration: 4000,
        position: 'top-right'
      })
    );
  });

  it('should require contactId', async () => {
    const { result } = renderHook(
      () => useTokenEditMutation(null),
      { wrapper }
    );

    result.current.mutate(mockTokens);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Contact ID is required');
  });

  it('should perform optimistic updates', async () => {
    const mockPreviousData = {
      data: {
        contacts: [
          {
            contactId: mockContactId,
            tokens: {
              mock_discussion: 10,
              clinical_skills: 10,
              situational_judgment: 10,
              mini_mock: 10,
              shared_mock: 10
            }
          }
        ]
      }
    };

    queryClient.setQueryData(['trainee-search'], mockPreviousData);

    const { result } = renderHook(
      () => useTokenEditMutation(mockContactId),
      { wrapper }
    );

    result.current.mutate(mockTokens);

    // Check optimistic update
    const updatedData = queryClient.getQueryData(['trainee-search']);
    expect(updatedData.data.contacts[0].tokens).toEqual(mockTokens);
  });

  it('should rollback on error', async () => {
    const mockPreviousData = {
      data: {
        contacts: [
          {
            contactId: mockContactId,
            tokens: {
              mock_discussion: 10,
              clinical_skills: 10,
              situational_judgment: 10,
              mini_mock: 10,
              shared_mock: 10
            }
          }
        ]
      }
    };

    queryClient.setQueryData(['trainee-search'], mockPreviousData);
    traineeApi.updateTokens.mockRejectedValueOnce(new Error('Update failed'));

    const { result } = renderHook(
      () => useTokenEditMutation(mockContactId),
      { wrapper }
    );

    result.current.mutate(mockTokens);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Check rollback
    const rolledBackData = queryClient.getQueryData(['trainee-search']);
    expect(rolledBackData).toEqual(mockPreviousData);
  });
});