import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../services/adminApi';

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

  /**
   * Execute bulk toggle status operation via API
   * Toggles the status of selected groups (active <-> inactive)
   * @param {Array<string>} ids - Array of group IDs to toggle
   * @returns {Promise<Object>} Operation result
   */
  const executeBulkToggle = useCallback(async (ids) => {
    setIsSubmitting(true);
    setOperationResult(null);

    try {
      const response = await groupsApi.bulkToggleStatus(ids);

      const result = response.data || response;
      setOperationResult(result);

      // Invalidate group-related queries to force refetch with fresh data
      await invalidateQueries();

      return result;
    } catch (error) {
      console.error('Bulk toggle failed:', error);
      const errorResult = {
        success: false,
        summary: {
          total: ids.length,
          updated: 0,
          failed: ids.length
        },
        error: error.response?.data?.error || { message: 'Failed to toggle group status' }
      };
      setOperationResult(errorResult);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [invalidateQueries]);

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
    executeBulkToggle,

    // Helpers
    isSelected
  };
};

export default useGroupsBulkSelection;
