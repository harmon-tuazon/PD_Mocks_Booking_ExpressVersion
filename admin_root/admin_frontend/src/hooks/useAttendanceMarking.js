/**
 * useAttendanceMarking Hook
 * Manages attendance marking state and selection logic
 *
 * Features:
 * - State machine: VIEW → SELECTING → SUBMITTING → SUCCESS/ERROR
 * - Multi-selection with Set for O(1) lookups
 * - Multi-action support: Mark Yes, Mark No, Unmark
 * - Can select bookings with any attendance status
 * - Keyboard shortcuts (Escape, Ctrl+A)
 */

import { useState, useCallback, useEffect } from 'react';

const useAttendanceMarking = (bookings = []) => {
  // State machine states: 'view', 'selecting', 'submitting'
  const [mode, setMode] = useState('view');

  // Selected booking IDs (using Set for O(1) lookups)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Action to perform on selected bookings: 'mark_yes' | 'mark_no' | 'unmark'
  const [action, setAction] = useState('mark_yes');

  // All bookings are selectable regardless of attendance status
  const selectableBookings = bookings;

  // Count bookings by attendance status
  const attendedCount = bookings.filter(
    booking => booking.attendance === 'Yes'
  ).length;

  const noShowCount = bookings.filter(
    booking => booking.attendance === 'No'
  ).length;

  const unmarkedCount = bookings.filter(
    booking => !booking.attendance || booking.attendance === ''
  ).length;

  /**
   * Toggle attendance marking mode
   */
  const toggleMode = useCallback(() => {
    if (mode === 'view') {
      setMode('selecting');
      setSelectedIds(new Set());
    } else {
      // Exit mode - clear selections
      setMode('view');
      setSelectedIds(new Set());
    }
  }, [mode]);

  /**
   * Toggle selection of a single booking
   * Now allows selecting bookings with any attendance status
   */
  const toggleSelection = useCallback((bookingId, booking) => {
    // Cannot select cancelled bookings
    if (booking?.booking_status === 'cancelled') {
      return false;
    }

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
    return true;
  }, []);

  /**
   * Select all selectable bookings
   */
  const selectAll = useCallback(() => {
    const allSelectableIds = selectableBookings.map(b => b.id);
    setSelectedIds(new Set(allSelectableIds));
  }, [selectableBookings]);

  /**
   * Clear all selections
   */
  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if a booking is selected
   */
  const isSelected = useCallback((bookingId) => {
    return selectedIds.has(bookingId);
  }, [selectedIds]);

  /**
   * Set mode to submitting (when API call starts)
   */
  const startSubmitting = useCallback(() => {
    setMode('submitting');
  }, []);

  /**
   * Exit to view mode after successful submission
   */
  const exitToView = useCallback(() => {
    setMode('view');
    setSelectedIds(new Set());
  }, []);

  /**
   * Return to selecting mode after error (to allow retry)
   */
  const returnToSelecting = useCallback(() => {
    setMode('selecting');
    // Keep selections for easy retry
  }, []);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape key - exit attendance mode
      if (e.key === 'Escape' && mode === 'selecting') {
        toggleMode();
      }

      // Ctrl+A - select all (prevent default browser behavior)
      if (e.ctrlKey && e.key === 'a' && mode === 'selecting') {
        e.preventDefault();
        selectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, toggleMode, selectAll]);

  return {
    // State
    mode,
    isAttendanceMode: mode !== 'view',
    isSubmitting: mode === 'submitting',
    selectedIds: Array.from(selectedIds), // Convert Set to Array for rendering
    selectedCount: selectedIds.size,
    selectableCount: selectableBookings.length,
    attendedCount,
    noShowCount,
    unmarkedCount,
    totalCount: bookings.length,
    action,

    // Actions
    toggleMode,
    toggleSelection,
    selectAll,
    clearAll,
    isSelected,
    setAction,
    startSubmitting,
    exitToView,
    returnToSelecting
  };
};

export default useAttendanceMarking;
