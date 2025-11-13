import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Custom hook for managing bulk selection of mock exam sessions
 * Based on the pattern from useBatchCancellation but adapted for mock exams
 *
 * @param {Array} sessions - Array of mock exam sessions (on current page)
 * @param {number} overrideTotalCount - Optional total session count across all pages
 * @returns {Object} Selection state and methods
 */
const useBulkSelection = (sessions = [], overrideTotalCount = null) => {
  // Core state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState(new Set());

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

  // Reset selections when sessions change
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedSessionIds(new Set());
    }
  }, [sessions, isSelectionMode]);

  // Get counts
  const selectedCount = selectedSessionIds.size;
  const totalCount = overrideTotalCount !== null ? overrideTotalCount : sessions.length;

  // Get selected sessions with their details
  const selectedSessions = useMemo(() => {
    return sessions.filter(session => selectedSessionIds.has(session.id));
  }, [sessions, selectedSessionIds]);

  // Toggle selection mode
  const toggleMode = useCallback(() => {
    if (isSelectionMode) {
      // Exiting selection mode - clear selections
      setSelectedSessionIds(new Set());
      setIsSelectionMode(false);
    } else {
      // Entering selection mode
      setIsSelectionMode(true);
    }
  }, [isSelectionMode]);

  // Exit selection mode and clear selections
  const exitToView = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedSessionIds(new Set());
  }, []);

  // Toggle individual session selection
  const toggleSelection = useCallback((sessionId) => {
    setSelectedSessionIds(prev => {
      const newSet = new Set(prev);

      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);

        // Auto-exit selection mode if last selection is cleared
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        newSet.add(sessionId);

        // Auto-enter selection mode on first selection
        if (!isSelectionMode) {
          setIsSelectionMode(true);
        }
      }

      return newSet;
    });
  }, [isSelectionMode]);

  // Select all sessions
  const selectAll = useCallback(() => {
    const allSessionIds = new Set(sessions.map(session => session.id));
    setSelectedSessionIds(allSessionIds);

    // Auto-enter selection mode if not already
    if (!isSelectionMode && sessions.length > 0) {
      setIsSelectionMode(true);
    }
  }, [sessions, isSelectionMode]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedSessionIds(new Set());
  }, []);

  // Check if a session is selected
  const isSelected = useCallback((sessionId) => {
    return selectedSessionIds.has(sessionId);
  }, [selectedSessionIds]);

  // Get selected session IDs as array
  const selectedIds = useMemo(() => {
    return Array.from(selectedSessionIds);
  }, [selectedSessionIds]);

  return {
    // State
    isSelectionMode,
    selectedCount,
    totalCount,
    selectedSessions,
    selectedSessionIds,
    selectedIds,

    // Actions
    toggleMode,
    toggleSelection,
    selectAll,
    clearAll,
    exitToView,

    // Helpers
    isSelected
  };
};

export default useBulkSelection;