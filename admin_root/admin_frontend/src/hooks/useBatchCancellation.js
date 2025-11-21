/**
 * useBatchCancellation Hook
 * State management for batch booking cancellation
 *
 * Features:
 * - Manage cancellation mode state
 * - Track selected bookings for cancellation
 * - Handle selection/deselection logic
 * - Provide counts and status
 * - Integration with cancellation modal
 * - Similar pattern to useAttendanceMarking
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

const useBatchCancellation = (bookings = []) => {
  // Core state
  const [isCancellationMode, setIsCancellationMode] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundTokens, setRefundTokens] = useState(true);  // Default: enabled

  // Reset selections when bookings change (e.g., after successful cancellation)
  useEffect(() => {
    if (!isCancellationMode) {
      setSelectedBookingIds(new Set());
    }
  }, [bookings, isCancellationMode]);

  // Get cancellable bookings (exclude already cancelled)
  const cancellableBookings = useMemo(() => {
    return bookings.filter(booking =>
      booking.is_active !== 'Cancelled'
    );
  }, [bookings]);

  // Get selected bookings with their details
  const selectedBookings = useMemo(() => {
    return bookings.filter(booking => selectedBookingIds.has(booking.id));
  }, [bookings, selectedBookingIds]);

  // Get counts
  const selectedCount = selectedBookingIds.size;
  const cancellableCount = cancellableBookings.length;
  const totalCount = bookings.length;

  // Toggle cancellation mode
  const toggleMode = useCallback(() => {
    if (isCancellationMode) {
      // Exiting cancellation mode - clear selections
      setSelectedBookingIds(new Set());
      setIsModalOpen(false);
    } else {
      // Entering cancellation mode
      setSelectedBookingIds(new Set());
    }
    setIsCancellationMode(!isCancellationMode);
  }, [isCancellationMode]);

  // Exit cancellation mode (called after successful cancellation)
  const exitToView = useCallback(() => {
    setIsCancellationMode(false);
    setSelectedBookingIds(new Set());
    setIsModalOpen(false);
    setIsSubmitting(false);
  }, []);

  // Select all cancellable bookings
  const selectAll = useCallback(() => {
    const allCancellableIds = new Set(
      cancellableBookings.map(booking => booking.id)
    );
    setSelectedBookingIds(allCancellableIds);
  }, [cancellableBookings]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedBookingIds(new Set());
  }, []);

  // Toggle individual booking selection
  const toggleSelection = useCallback((bookingId, booking) => {
    // Validate booking can be selected
    if (booking?.is_active === 'Cancelled') {
      return false;
    }

    setSelectedBookingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        // Only add if booking is cancellable
        if (booking && booking.is_active !== 'Cancelled') {
          newSet.add(bookingId);
        }
      }
      return newSet;
    });
  }, []);

  // Check if a booking is selected
  const isSelected = useCallback((bookingId) => {
    return selectedBookingIds.has(bookingId);
  }, [selectedBookingIds]);

  // Check if a booking can be cancelled
  const canCancel = useCallback((bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    return booking &&
      booking.is_active !== 'Cancelled';
  }, [bookings]);

  // Open cancellation modal
  const openModal = useCallback(() => {
    if (selectedCount > 0) {
      setIsModalOpen(true);
    }
  }, [selectedCount]);

  // Close cancellation modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Don't clear selections - user might want to retry
  }, []);

  // Start submitting (set loading state)
  const startSubmitting = useCallback(() => {
    setIsSubmitting(true);
  }, []);

  // Return to selecting mode (after error)
  const returnToSelecting = useCallback(() => {
    setIsSubmitting(false);
    setIsModalOpen(false);
  }, []);

  // Get selected booking IDs as array
  const selectedIds = useMemo(() => {
    return Array.from(selectedBookingIds);
  }, [selectedBookingIds]);

  // Toggle refund tokens
  const toggleRefund = useCallback(() => {
    setRefundTokens(prev => !prev);
  }, []);

  return {
    // State
    isCancellationMode,
    isModalOpen,
    isSubmitting,
    selectedCount,
    cancellableCount,
    totalCount,
    selectedBookings,
    selectedIds,
    refundTokens,

    // Actions
    toggleMode,
    exitToView,
    selectAll,
    clearAll,
    toggleSelection,
    openModal,
    closeModal,
    startSubmitting,
    returnToSelecting,
    toggleRefund,

    // Helpers
    isSelected,
    canCancel
  };
};

export default useBatchCancellation;