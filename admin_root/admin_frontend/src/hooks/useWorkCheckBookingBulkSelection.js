/**
 * Hook for managing bulk selection state for work check bookings
 * Supports selection from expandable aggregate rows
 */

import { useState, useCallback, useMemo } from 'react';
import { useWorkCheckBookingMutations } from './useWorkCheckBookingMutations';

/**
 * Hook for managing bulk selection of work check bookings
 * @param {Array} aggregates - Current page of aggregates (with preloaded bookings)
 * @param {number} totalCount - Total number of bookings
 * @returns {Object} Selection state and handlers
 */
function useWorkCheckBookingBulkSelection(aggregates = [], totalCount = 0) {
  // Selection state - using Set for efficient lookups
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get mutations
  const { bulkToggle, bulkDelete, cloneBookings } = useWorkCheckBookingMutations();

  // Computed values
  const selectedCount = selectedIds.size;

  // Get all bookings from aggregates (flattened)
  const allBookings = useMemo(() => {
    return aggregates.flatMap(agg => agg.bookings || []);
  }, [aggregates]);

  // Get selected bookings
  const selectedBookings = useMemo(() => {
    return allBookings.filter(booking => selectedIds.has(booking.id));
  }, [allBookings, selectedIds]);

  // Check if a booking is selected
  const isSelected = useCallback((id) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Toggle selection for a single booking
  const toggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });

    // Enter selection mode if not already
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  // Select/deselect all bookings in an aggregate
  const selectAllInAggregate = useCallback((bookingIds, select = true) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      bookingIds.forEach(id => {
        if (select) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      });
      return newSet;
    });

    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  // Select all bookings on current page
  const selectAll = useCallback(() => {
    const allIds = allBookings.map(booking => booking.id);
    setSelectedIds(new Set(allIds));
    setIsSelectionMode(true);
  }, [allBookings]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Exit selection mode
  const exitToView = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  // Execute bulk toggle status
  const executeBulkToggle = useCallback(async (ids, targetStatus) => {
    setIsSubmitting(true);
    try {
      const idsArray = Array.from(ids);
      const result = await bulkToggle.mutateAsync({ ids: idsArray, targetStatus });
      // Clear selection after successful operation
      clearAll();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [bulkToggle, clearAll]);

  // Execute bulk delete
  const executeBulkDelete = useCallback(async (ids) => {
    setIsSubmitting(true);
    try {
      const idsArray = Array.from(ids);
      const result = await bulkDelete.mutateAsync(idsArray);
      // Clear selection after successful operation
      clearAll();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [bulkDelete, clearAll]);

  // Execute clone
  const executeClone = useCallback(async (data) => {
    setIsSubmitting(true);
    try {
      const result = await cloneBookings.mutateAsync(data);
      // Clear selection after successful operation
      clearAll();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [cloneBookings, clearAll]);

  return {
    // State
    selectedIds,
    selectedCount,
    selectedBookings,
    isSelectionMode,
    isSubmitting,
    totalCount,

    // Actions
    isSelected,
    toggleSelection,
    selectAllInAggregate,
    selectAll,
    clearAll,
    exitToView,
    executeBulkToggle,
    executeBulkDelete,
    executeClone
  };
}

export default useWorkCheckBookingBulkSelection;
