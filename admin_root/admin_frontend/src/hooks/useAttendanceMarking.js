/**
 * useAttendanceMarking Hook
 * Manages attendance marking state and selection logic
 *
 * Features:
 * - State machine: VIEW → SELECTING → SUBMITTING → SUCCESS/ERROR
 * - Multi-selection with Map for O(1) lookups (stores both id and hubspot_id)
 * - Multi-action support: Mark Yes, Mark No, Unmark
 * - Can select bookings with any attendance status
 * - Keyboard shortcuts (Escape, Ctrl+A)
 *
 * Updated: Now tracks both Supabase UUID (id) and HubSpot ID (hubspot_id) for each booking
 * to support cascading lookup pattern for bookings that haven't synced to HubSpot yet.
 */

import { useState, useCallback, useEffect } from 'react';

const useAttendanceMarking = (bookings = []) => {
  // State machine states: 'view', 'selecting', 'submitting'
  const [mode, setMode] = useState('view');

  // Selected bookings (using Map: id -> { id, hubspot_id } for O(1) lookups)
  // Stores both IDs to support cascading lookup in backend
  const [selectedBookingsMap, setSelectedBookingsMap] = useState(new Map());

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
      setSelectedBookingsMap(new Map());
    } else {
      // Exit mode - clear selections
      setMode('view');
      setSelectedBookingsMap(new Map());
    }
  }, [mode]);

  /**
   * Toggle selection of a single booking
   * Now allows selecting bookings with any attendance status
   * Stores both id (Supabase UUID) and hubspot_id for cascading lookup
   */
  const toggleSelection = useCallback((bookingId, booking) => {
    // Cannot select cancelled bookings
    if (booking?.is_active === 'Cancelled') {
      return false;
    }

    setSelectedBookingsMap(prev => {
      const newMap = new Map(prev);
      if (newMap.has(bookingId)) {
        newMap.delete(bookingId);
      } else {
        // Store both id and hubspot_id for backend cascading lookup
        newMap.set(bookingId, {
          id: booking.id,
          hubspot_id: booking.hubspot_id || null
        });
      }
      return newMap;
    });
    return true;
  }, []);

  /**
   * Select all selectable bookings
   * Stores both id and hubspot_id for each booking
   */
  const selectAll = useCallback(() => {
    const newMap = new Map();
    selectableBookings.forEach(b => {
      newMap.set(b.id, {
        id: b.id,
        hubspot_id: b.hubspot_id || null
      });
    });
    setSelectedBookingsMap(newMap);
  }, [selectableBookings]);

  /**
   * Clear all selections
   */
  const clearAll = useCallback(() => {
    setSelectedBookingsMap(new Map());
  }, []);

  /**
   * Check if a booking is selected
   */
  const isSelected = useCallback((bookingId) => {
    return selectedBookingsMap.has(bookingId);
  }, [selectedBookingsMap]);

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
    setSelectedBookingsMap(new Map());
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

  // Convert Map to arrays for external use
  const selectedIds = Array.from(selectedBookingsMap.keys());
  const selectedBookings = Array.from(selectedBookingsMap.values());

  return {
    // State
    mode,
    isAttendanceMode: mode !== 'view',
    isSubmitting: mode === 'submitting',
    selectedIds, // Array of Supabase UUIDs (for backward compatibility)
    selectedBookings, // Array of { id, hubspot_id } objects (for cascading lookup)
    selectedCount: selectedBookingsMap.size,
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
