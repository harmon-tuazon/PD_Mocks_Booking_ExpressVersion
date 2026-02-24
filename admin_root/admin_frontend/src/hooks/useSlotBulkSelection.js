/**
 * Hook for managing bulk selection state for work check slots
 * Similar pattern to useInstructorBulkSelection
 */

import { useState, useCallback, useMemo } from 'react';
import { useWorkCheckSlotMutations } from './useWorkCheckSlotMutations';

/**
 * Hook for managing bulk selection of work check slots
 * @param {Array} slots - Current page of slots
 * @param {number} totalCount - Total number of slots across all pages
 * @returns {Object} Selection state and handlers
 */
function useSlotBulkSelection(slots = [], totalCount = 0) {
  // Selection state - using Set for efficient lookups
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get mutations
  const { bulkToggle, bulkDelete } = useWorkCheckSlotMutations();

  // Computed values
  const selectedCount = selectedIds.size;

  // Get selected slots from current page
  const selectedSlots = useMemo(() => {
    return slots.filter(slot => selectedIds.has(slot.id));
  }, [slots, selectedIds]);

  // Check if a slot is selected
  const isSelected = useCallback((id) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Toggle selection for a single slot
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

  // Select all slots on current page
  const selectAll = useCallback(() => {
    const allIds = slots.map(slot => slot.id);
    setSelectedIds(new Set(allIds));
    setIsSelectionMode(true);
  }, [slots]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Exit selection mode
  const exitToView = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  // Execute bulk toggle
  const executeBulkToggle = useCallback(async (ids, action = 'toggle') => {
    setIsSubmitting(true);
    try {
      const idsArray = Array.from(ids);
      const result = await bulkToggle.mutateAsync({ ids: idsArray, action });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [bulkToggle]);

  // Execute bulk delete
  const executeBulkDelete = useCallback(async (ids) => {
    setIsSubmitting(true);
    try {
      const idsArray = Array.from(ids);
      const result = await bulkDelete.mutateAsync(idsArray);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  }, [bulkDelete]);

  return {
    // State
    selectedIds,
    selectedCount,
    selectedSlots,
    isSelectionMode,
    isSubmitting,
    totalCount,

    // Actions
    isSelected,
    toggleSelection,
    selectAll,
    clearAll,
    exitToView,
    executeBulkToggle,
    executeBulkDelete
  };
}

export default useSlotBulkSelection;
