import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Custom hook for managing rebook selection mode
 * Similar to useBatchCancellation but only allows single selection
 * When a booking is selected, it automatically triggers the rebook flow
 *
 * @param {Array} bookings - Array of booking objects
 * @returns {Object} Selection state and actions
 */
const useRebookSelection = (bookings = []) => {
  // Core state
  const [isRebookMode, setIsRebookMode] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Reset selection when bookings change or mode is exited
  useEffect(() => {
    if (!isRebookMode) {
      setSelectedBookingId(null);
    }
  }, [bookings, isRebookMode]);

  // Get rebookable bookings (exclude cancelled bookings)
  const rebookableBookings = useMemo(() => {
    return bookings.filter(booking =>
      booking.is_active !== 'Cancelled' &&
      booking.is_active !== 'cancelled'
    );
  }, [bookings]);

  // Get selected booking with its details
  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return bookings.find(booking => booking.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // Get counts
  const selectedCount = selectedBookingId ? 1 : 0;
  const rebookableCount = rebookableBookings.length;
  const totalCount = bookings.length;

  // Toggle rebook mode
  const toggleMode = useCallback(() => {
    if (isRebookMode) {
      // Exiting rebook mode - clear selection
      setSelectedBookingId(null);
    }
    setIsRebookMode(!isRebookMode);
  }, [isRebookMode]);

  // Exit rebook mode (called after successful rebook or cancel)
  const exitMode = useCallback(() => {
    setIsRebookMode(false);
    setSelectedBookingId(null);
  }, []);

  // Clear selection without exiting mode
  const clearSelection = useCallback(() => {
    setSelectedBookingId(null);
  }, []);

  // Toggle individual booking selection (single selection only)
  const toggleSelection = useCallback((bookingId, booking) => {
    // Validate booking can be selected
    if (booking?.is_active === 'Cancelled' || booking?.is_active === 'cancelled') {
      return false;
    }

    setSelectedBookingId(prev => {
      // If same booking is clicked, deselect it
      if (prev === bookingId) {
        return null;
      }
      // Otherwise, select the new booking (replacing any previous selection)
      return bookingId;
    });

    return true;
  }, []);

  // Check if a booking is selected
  const isSelected = useCallback((bookingId) => {
    return selectedBookingId === bookingId;
  }, [selectedBookingId]);

  // Check if a booking can be rebooked
  const canRebook = useCallback((bookingId) => {
    const booking = bookings.find(b => b.id === bookingId);
    return booking &&
      booking.is_active !== 'Cancelled' &&
      booking.is_active !== 'cancelled';
  }, [bookings]);

  return {
    // State
    isRebookMode,
    selectedBookingId,
    selectedBooking,
    selectedCount,
    rebookableCount,
    totalCount,

    // Actions
    toggleMode,
    exitMode,
    clearSelection,
    toggleSelection,

    // Helpers
    isSelected,
    canRebook
  };
};

export default useRebookSelection;
