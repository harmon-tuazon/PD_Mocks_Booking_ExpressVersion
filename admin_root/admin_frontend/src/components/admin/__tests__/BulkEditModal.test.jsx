/**
 * Unit tests for BulkEditModal component
 * Tests the bulk edit functionality for mock exam sessions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BulkEditModal from '../BulkEditModal';
import { vi } from 'vitest';

// Mock the useBulkEdit hook
vi.mock('../../../hooks/useBulkEdit', () => ({
  default: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null
  })
}));

// Mock date utilities
vi.mock('../../../utils/dateUtils', () => ({
  formatDateShort: (date) => date || 'N/A'
}));

vi.mock('../../../utils/dateTimeUtils', () => ({
  convertUTCToToronto: (date) => date,
  convertTorontoToUTC: (date) => date
}));

const mockSessions = [
  {
    id: '1',
    mock_type: 'Situational Judgment',
    exam_date: '2024-01-15',
    location: 'Mississauga',
    capacity: '20',
    total_bookings: '0',
    is_active: 'true'
  },
  {
    id: '2',
    mock_type: 'Clinical Skills',
    exam_date: '2024-01-20',
    location: 'Vancouver',
    capacity: '15',
    total_bookings: '5',
    is_active: 'false'
  },
  {
    id: '3',
    mock_type: 'Mock Discussion',
    exam_date: '2024-01-25',
    location: 'Montreal',
    capacity: '10',
    total_bookings: '0',
    is_active: 'scheduled'
  }
];

describe('BulkEditModal', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      selectedSessions: mockSessions,
      onSuccess: vi.fn()
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <BulkEditModal {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  test('renders modal with correct session breakdown', () => {
    renderComponent();

    // Check title
    expect(screen.getByText('Bulk Edit Sessions')).toBeInTheDocument();

    // Check session breakdown
    expect(screen.getByText(/2 sessions can be edited/)).toBeInTheDocument();
    expect(screen.getByText(/1 session has bookings/)).toBeInTheDocument();
  });

  test('shows warning banner for sessions with bookings', () => {
    renderComponent();

    expect(screen.getByText(/Sessions with existing bookings cannot be edited/)).toBeInTheDocument();
  });

  test('displays empty state when all sessions have bookings', () => {
    const sessionsWithBookings = mockSessions.map(s => ({ ...s, total_bookings: '10' }));
    renderComponent({ selectedSessions: sessionsWithBookings });

    expect(screen.getByText(/All selected sessions have bookings and cannot be edited/)).toBeInTheDocument();
  });

  test('renders all form fields correctly', () => {
    renderComponent();

    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Mock Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Capacity')).toBeInTheDocument();
    expect(screen.getByLabelText('Exam Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  test('shows scheduled activation field when status is scheduled', async () => {
    renderComponent();

    // Select scheduled status
    const statusSelect = screen.getByLabelText('Status');
    fireEvent.click(statusSelect);
    fireEvent.click(screen.getByText('Scheduled'));

    await waitFor(() => {
      expect(screen.getByLabelText('Scheduled Activation')).toBeInTheDocument();
    });
  });

  test('displays preview table with sessions', () => {
    renderComponent();

    // Check table headers
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Current Capacity')).toBeInTheDocument();
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();

    // Check session data
    expect(screen.getByText('Situational Judgment')).toBeInTheDocument();
    expect(screen.getByText('Clinical Skills')).toBeInTheDocument();
    expect(screen.getByText('Mock Discussion')).toBeInTheDocument();
  });

  test('validates confirmation input correctly', () => {
    renderComponent();

    const confirmInput = screen.getByPlaceholderText('Type 2 to confirm');

    // Wrong number
    fireEvent.change(confirmInput, { target: { value: '3' } });
    expect(screen.getByText('Please type 2 to confirm')).toBeInTheDocument();

    // Correct number
    fireEvent.change(confirmInput, { target: { value: '2' } });
    expect(screen.queryByText('Please type 2 to confirm')).not.toBeInTheDocument();
  });

  test('disables confirm button when conditions not met', () => {
    renderComponent();

    const confirmButton = screen.getByRole('button', { name: /Update.*Session/i });

    // Should be disabled initially (no fields filled, no confirmation)
    expect(confirmButton).toBeDisabled();
  });

  test('enables confirm button when valid', async () => {
    renderComponent();

    // Fill a field
    const capacityInput = screen.getByLabelText('Capacity');
    fireEvent.change(capacityInput, { target: { value: '30' } });

    // Enter correct confirmation
    const confirmInput = screen.getByPlaceholderText('Type 2 to confirm');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const confirmButton = screen.getByRole('button', { name: /Update 2 Sessions/i });

    await waitFor(() => {
      expect(confirmButton).not.toBeDisabled();
    });
  });

  test('closes modal when cancel is clicked', () => {
    const onClose = vi.fn();
    renderComponent({ onClose });

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  test('shows info banner about blank fields', () => {
    renderComponent();

    expect(screen.getByText(/Fields left blank will not be updated/)).toBeInTheDocument();
  });
});