/**
 * Test file for TraineeInfoCard component
 * Tests token editing functionality and UI interactions
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TraineeInfoCard from './TraineeInfoCard';
import { useTokenEditMutation } from '../../hooks/useTokenEditMutation';
import '@testing-library/jest-dom';

// Mock the mutation hook
jest.mock('../../hooks/useTokenEditMutation');

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

describe('TraineeInfoCard', () => {
  let queryClient;
  const mockMutateAsync = jest.fn();

  const mockTrainee = {
    contactId: '41459711858',
    firstname: 'John',
    lastname: 'Doe',
    email: 'john.doe@example.com',
    student_id: 'STU123456',
    ndecc_exam_date: '2025-03-15',
    tokens: {
      mock_discussion: 5,
      clinical_skills: 3,
      situational_judgment: 2,
      mini_mock: 1,
      shared_mock: 0
    }
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    // Setup mock mutation
    useTokenEditMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isLoading: false
    });

    jest.clearAllMocks();
  });

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should render trainee information correctly', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('STU123456')).toBeInTheDocument();
  });

  it('should display token balances', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    expect(screen.getByText('Token Balances')).toBeInTheDocument();
    expect(screen.getByText('Mock Discussion:')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Clinical Skills:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Situational Judgment:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Mini-mock:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should show Edit Tokens button', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    expect(editButton).toBeInTheDocument();
  });

  it('should enter edit mode when Edit Tokens is clicked', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    // Should show input fields
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(5); // 5 token types

    // Should show Save and Cancel buttons
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should update token values in edit mode', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');
    const mockDiscussionInput = inputs[0];

    fireEvent.change(mockDiscussionInput, { target: { value: '10' } });
    expect(mockDiscussionInput.value).toBe('10');
  });

  it('should disable Save button when no changes made', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });

  it('should enable Save button when changes are made', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('should save token changes successfully', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      success: true,
      data: { tokens: { ...mockTrainee.tokens, mock_discussion: 10 } }
    });

    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        mock_discussion: 10,
        clinical_skills: 3,
        situational_judgment: 2,
        mini_mock: 1,
        shared_mock: 0
      });
    });
  });

  it('should cancel edit mode without saving', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Should exit edit mode
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Original value
  });

  it('should handle trainee without tokens gracefully', () => {
    const traineeWithoutTokens = { ...mockTrainee, tokens: null };

    render(
      <TraineeInfoCard trainee={traineeWithoutTokens} />,
      { wrapper }
    );

    expect(screen.queryByText('Token Balances')).not.toBeInTheDocument();
  });

  it('should handle null trainee prop', () => {
    const { container } = render(
      <TraineeInfoCard trainee={null} />,
      { wrapper }
    );

    expect(container.firstChild).toBeNull();
  });

  it('should enforce minimum value of 0 for token inputs', () => {
    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');

    // Try to set negative value
    fireEvent.change(inputs[0], { target: { value: '-5' } });

    // Should be clamped to 0
    expect(inputs[0].value).toBe('0');
  });

  it('should show loading state during save', async () => {
    useTokenEditMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isLoading: true
    });

    render(
      <TraineeInfoCard trainee={mockTrainee} />,
      { wrapper }
    );

    const editButton = screen.getByRole('button', { name: /edit tokens/i });
    fireEvent.click(editButton);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '10' } });

    const saveButton = screen.getByRole('button', { name: /saving/i });
    expect(saveButton).toBeDisabled();
  });
});