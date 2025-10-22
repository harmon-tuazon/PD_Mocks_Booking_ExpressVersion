import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import InsufficientTokensError from '../InsufficientTokensError';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock window.open
const mockWindowOpen = jest.fn();
window.open = mockWindowOpen;

// Mock window.location
delete window.location;
window.location = { href: jest.fn() };

describe('InsufficientTokensError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <InsufficientTokensError {...props} />
      </BrowserRouter>
    );
  };

  test('renders with default mock type', () => {
    renderComponent();
    expect(screen.getByText('Insufficient Tokens')).toBeInTheDocument();
    expect(screen.getByText(/You don't have enough tokens to book this Mock Exam/)).toBeInTheDocument();
  });

  test('renders with custom mock type', () => {
    renderComponent({ mockType: 'Situational Judgment' });
    expect(screen.getByText(/You don't have enough tokens to book this Situational Judgment/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't have sufficient tokens for this situational judgment/i)).toBeInTheDocument();
  });

  test('renders contact information correctly', () => {
    renderComponent();
    expect(screen.getByText('Need Help? Contact Us')).toBeInTheDocument();
    expect(screen.getByText('Email Support')).toBeInTheDocument();
    expect(screen.getByText('info@prepdoctors.com')).toBeInTheDocument();
    expect(screen.getByText('Call Support')).toBeInTheDocument();
    expect(screen.getByText('+1 855-397-7737')).toBeInTheDocument();
  });

  test('handles email button click', () => {
    renderComponent();
    const emailButton = screen.getByLabelText('Send email to PrepDoctors support');
    fireEvent.click(emailButton);
    expect(window.location.href).toBe('mailto:info@prepdoctors.com');
  });

  test('handles phone button click', () => {
    renderComponent();
    const phoneButton = screen.getByLabelText('Call PrepDoctors support');
    fireEvent.click(phoneButton);
    expect(window.location.href).toBe('tel:+18553977737');
  });

  test('handles go back button with custom onGoBack function', () => {
    const mockOnGoBack = jest.fn();
    renderComponent({ onGoBack: mockOnGoBack });
    const goBackButton = screen.getByLabelText('Go back to exam types selection');
    fireEvent.click(goBackButton);
    expect(mockOnGoBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('handles go back button with default navigation', () => {
    renderComponent();
    const goBackButton = screen.getByLabelText('Go back to exam types selection');
    fireEvent.click(goBackButton);
    expect(mockNavigate).toHaveBeenCalledWith('/book/exam-types');
  });

  test('handles contact academic advisors button click', () => {
    renderComponent();
    const contactButton = screen.getByLabelText('Visit academic advisors page for assistance');
    fireEvent.click(contactButton);
    expect(mockWindowOpen).toHaveBeenCalledWith('https://ca.prepdoctors.com/academic-advisors', '_blank');
  });

  test('applies custom className', () => {
    const { container } = renderComponent({ className: 'custom-class' });
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  test('renders additional information section', () => {
    renderComponent();
    expect(screen.getByText('Why am I seeing this?')).toBeInTheDocument();
    expect(screen.getByText(/Your account doesn't have sufficient tokens/)).toBeInTheDocument();
  });

  test('renders footer note with support hours', () => {
    renderComponent();
    expect(screen.getByText(/Our support team is available Monday through Friday/)).toBeInTheDocument();
    expect(screen.getByText(/We typically respond to emails within 24 hours/)).toBeInTheDocument();
  });
});