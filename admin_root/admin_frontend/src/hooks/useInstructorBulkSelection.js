import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { instructorsApi } from '../services/adminApi';

/**
 * Custom hook for managing bulk selection of instructors
 * Based on the useBulkSelection pattern but simplified for instructors
 *
 * @param {Array} instructors - Array of instructor objects (on current page)
 * @param {number} overrideTotalCount - Optional total instructor count across all pages
 * @returns {Object} Selection state and methods
 */
const useInstructorBulkSelection = (instructors = [], overrideTotalCount = null) => {
  const queryClient = useQueryClient();

  // Core state
  /** @type {[boolean, Function]} Whether selection mode is active */
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  /** @type {[Set<string>, Function]} Set of selected instructor IDs */
  const [selectedInstructorIds, setSelectedInstructorIds] = useState(new Set());
  /** @type {[boolean, Function]} Whether an API operation is in progress */
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** @type {[Object|null, Function]} Result of the last bulk operation */
  const [operationResult, setOperationResult] = useState(null);

  /**
   * ESC key listener to exit selection mode
   */
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

  /**
   * Reset selections when instructors data changes
   */
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedInstructorIds(new Set());
    }
  }, [instructors, isSelectionMode]);

  // Computed: count of selected items
  const selectedCount = selectedInstructorIds.size;

  // Computed: total instructors available
  const totalCount = overrideTotalCount !== null ? overrideTotalCount : instructors.length;

  /**
   * Memoized array of full instructor objects that are selected
   * @type {Array<Object>}
   */
  const selectedInstructors = useMemo(() => {
    return instructors.filter(instructor =>
      selectedInstructorIds.has(instructor.id || instructor.instructor_id)
    );
  }, [instructors, selectedInstructorIds]);

  /**
   * Selected IDs as an array (for API calls)
   * @type {Array<string>}
   */
  const selectedIds = useMemo(() => {
    return Array.from(selectedInstructorIds);
  }, [selectedInstructorIds]);

  /**
   * Toggle selection mode on/off
   */
  const toggleMode = useCallback(() => {
    if (isSelectionMode) {
      // Exiting selection mode - clear selections
      setSelectedInstructorIds(new Set());
      setIsSelectionMode(false);
    } else {
      // Entering selection mode
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  /**
   * Exit selection mode and clear all selections
   */
  const exitToView = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedInstructorIds(new Set());
  }, []);

  /**
   * Toggle an individual instructor's selection
   * @param {string} id - Instructor ID to toggle
   */
  const toggleSelection = useCallback((id) => {
    setSelectedInstructorIds(prev => {
      const newSet = new Set(prev);

      if (newSet.has(id)) {
        newSet.delete(id);

        // Auto-exit selection mode if last selection is cleared
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSet.add(id);

        // Auto-enter selection mode on first selection
        if (!isSelectionMode) {
          setIsSelectionMode(true);
        }
      }

      return newSet;
    });
  }, [isSelectionMode]);

  /**
   * Select all visible instructors
   */
  const selectAll = useCallback(() => {
    const allInstructorIds = new Set(
      instructors.map(instructor => instructor.id || instructor.instructor_id)
    );
    setSelectedInstructorIds(allInstructorIds);

    // Auto-enter selection mode if not already
    if (!isSelectionMode && instructors.length > 0) {
      setIsSelectionMode(true);
    }
  }, [instructors, isSelectionMode]);

  /**
   * Clear all selections (but stay in selection mode)
   */
  const clearAll = useCallback(() => {
    setSelectedInstructorIds(new Set());
  }, []);

  /**
   * Check if an instructor is selected
   * @param {string} id - Instructor ID to check
   * @returns {boolean} True if selected
   */
  const isSelected = useCallback((id) => {
    return selectedInstructorIds.has(id);
  }, [selectedInstructorIds]);

  /**
   * Execute bulk toggle status operation via API
   * Toggles the active status of selected instructors
   * @param {Array<string>} ids - Array of instructor IDs to toggle
   * @returns {Promise<Object>} Operation result
   */
  const executeBulkToggle = useCallback(async (ids) => {
    setIsSubmitting(true);
    setOperationResult(null);

    try {
      const response = await instructorsApi.bulkToggleStatus(ids);

      const result = response.data || response;
      setOperationResult(result);

      // Invalidate instructor-related queries to force refetch with fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructors'] }),
        queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] })
      ]);

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
        error: error.response?.data?.error || { message: 'Failed to toggle instructor status' }
      };
      setOperationResult(errorResult);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [queryClient]);

  return {
    // State
    isSelectionMode,
    selectedCount,
    totalCount,
    selectedInstructors,
    selectedInstructorIds,
    selectedIds,
    isSubmitting,
    operationResult,

    // Actions
    toggleMode,
    toggleSelection,
    selectAll,
    clearAll,
    exitToView,
    executeBulkToggle,

    // Helpers
    isSelected
  };
};

export default useInstructorBulkSelection;
