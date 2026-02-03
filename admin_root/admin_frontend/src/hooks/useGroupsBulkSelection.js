import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook for managing bulk selection of groups
 * Based on the pattern from useBulkSelection but adapted for groups
 *
 * @param {Array} groups - Array of groups (on current page)
 * @param {number} overrideTotalCount - Optional total group count across all pages
 * @returns {Object} Selection state and methods
 */
const useGroupsBulkSelection = (groups = [], overrideTotalCount = null) => {
  const queryClient = useQueryClient();

  // Core state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationResult, setOperationResult] = useState(null);

  // ESC key listener to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSelectionMode) {
        exitToView();
      }
    };

    if (isSelectionMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelectionMode]);

  // Reset selections when groups change
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedGroupIds(new Set());
    }
  }, [groups, isSelectionMode]);

  // Get counts
  const selectedCount = selectedGroupIds.size;
  const totalCount = overrideTotalCount !== null ? overrideTotalCount : groups.length;

  // Get selected groups with their details
  const selectedGroups = useMemo(() => {
    return groups.filter(group => selectedGroupIds.has(group.group_id));
  }, [groups, selectedGroupIds]);

  // Toggle selection mode
  const toggleMode = useCallback(() => {
    if (isSelectionMode) {
      // Exiting selection mode - clear selections
      setSelectedGroupIds(new Set());
      setIsSelectionMode(false);
    } else {
      // Entering selection mode
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  // Exit selection mode and clear selections
  const exitToView = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedGroupIds(new Set());
  }, []);

  // Toggle individual group selection
  const toggleSelection = useCallback((groupId) => {
    setSelectedGroupIds(prev => {
      const newSet = new Set(prev);

      if (newSet.has(groupId)) {
        newSet.delete(groupId);

        // Auto-exit selection mode if last selection is cleared
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSet.add(groupId);

        // Auto-enter selection mode on first selection
        if (!isSelectionMode) {
          setIsSelectionMode(true);
        }
      }

      return newSet;
    });
  }, [isSelectionMode]);

  // Select all groups
  const selectAll = useCallback(() => {
    const allGroupIds = new Set(groups.map(group => group.group_id));
    setSelectedGroupIds(allGroupIds);

    // Auto-enter selection mode if not already
    if (!isSelectionMode && groups.length > 0) {
      setIsSelectionMode(true);
    }
  }, [groups, isSelectionMode]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedGroupIds(new Set());
  }, []);

  // Check if a group is selected
  const isSelected = useCallback((groupId) => {
    return selectedGroupIds.has(groupId);
  }, [selectedGroupIds]);

  // Get selected group IDs as array
  const selectedIds = useMemo(() => {
    return Array.from(selectedGroupIds);
  }, [selectedGroupIds]);

  // Set submitting state
  const setSubmittingState = useCallback((state) => {
    setIsSubmitting(state);
  }, []);

  // Invalidate group queries after operations
  const invalidateQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups'] }),
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] }),
      queryClient.invalidateQueries({ queryKey: ['group-detail'] })
    ]);
  }, [queryClient]);

  return {
    // State
    isSelectionMode,
    selectedCount,
    totalCount,
    selectedGroups,
    selectedGroupIds,
    selectedIds,
    isSubmitting,
    operationResult,

    // Actions
    toggleMode,
    toggleSelection,
    selectAll,
    clearAll,
    exitToView,
    setSubmittingState,
    invalidateQueries,

    // Helpers
    isSelected
  };
};

export default useGroupsBulkSelection;
