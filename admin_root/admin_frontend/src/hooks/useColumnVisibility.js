import { useState, useEffect, useCallback } from 'react';

// Default visible columns (only 3 as per requirement)
const DEFAULT_COLUMNS = ['time', 'token_used', 'booking_date'];

// All available dynamic columns (excludes fixed columns: name, email, student_id)
export const COLUMN_DEFINITIONS = [
  { id: 'mock_exam_type', label: 'Mock Type', defaultVisible: false },
  { id: 'exam_date', label: 'Exam Date', defaultVisible: false },
  { id: 'time', label: 'Time', defaultVisible: true },
  { id: 'attending_location', label: 'Location', defaultVisible: false },
  { id: 'dominant_hand', label: 'Dominant Hand', defaultVisible: false },
  { id: 'attendance', label: 'Attendance', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: false },
  { id: 'token_used', label: 'Token Used', defaultVisible: true },
  { id: 'booking_date', label: 'Booking Date', defaultVisible: true }
];

// Fixed columns that are always visible and sticky
export const FIXED_COLUMNS = [
  { id: 'name', label: 'Name', fixed: true },
  { id: 'email', label: 'Email', fixed: true },
  { id: 'student_id', label: 'Student ID', fixed: true }
];

/**
 * Custom hook for managing column visibility in the bookings table
 * Persists settings to session storage and provides sizing logic
 */
export const useColumnVisibility = (storageKey = 'admin:mock-exam-detail:column-visibility') => {
  // Initialize visible columns from session storage or defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that stored data is an array of strings
        if (Array.isArray(parsed) && parsed.every(col => typeof col === 'string')) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading column visibility:', error);
    }
    return DEFAULT_COLUMNS;
  });

  // Save to session storage whenever visible columns change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(visibleColumns));
    } catch (error) {
      console.error('Error saving column visibility:', error);
    }
  }, [visibleColumns, storageKey]);

  // Toggle a column's visibility
  const toggleColumn = useCallback((columnId) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnId)) {
        return prev.filter(col => col !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  }, []);

  // Reset to default columns
  const resetDefaults = useCallback(() => {
    setVisibleColumns(DEFAULT_COLUMNS);
  }, []);

  // Check if a column is visible
  const isColumnVisible = useCallback((columnId) => {
    return visibleColumns.includes(columnId);
  }, [visibleColumns]);

  // Get size class based on number of visible columns
  const getSizeClass = useCallback(() => {
    const visibleCount = visibleColumns.length;

    if (visibleCount <= 3) {
      return 'size-large'; // py-4, text-sm, px-6
    } else if (visibleCount <= 6) {
      return 'size-medium'; // py-3, text-xs, px-4
    } else {
      return 'size-small'; // py-2, text-xs, px-3
    }
  }, [visibleColumns]);

  // Get CSS classes for table cells based on size
  const getCellClasses = useCallback(() => {
    const sizeClass = getSizeClass();

    switch (sizeClass) {
      case 'size-large':
        return 'px-6 py-4 text-sm';
      case 'size-medium':
        return 'px-4 py-3 text-xs';
      case 'size-small':
        return 'px-3 py-2 text-xs';
      default:
        return 'px-4 py-3 text-xs';
    }
  }, [getSizeClass]);

  // Get CSS classes for table headers based on size
  const getHeaderClasses = useCallback(() => {
    const sizeClass = getSizeClass();

    switch (sizeClass) {
      case 'size-large':
        return 'px-6 py-4 text-sm font-medium';
      case 'size-medium':
        return 'px-4 py-3 text-xs font-medium';
      case 'size-small':
        return 'px-3 py-2 text-xs font-medium';
      default:
        return 'px-4 py-3 text-xs font-medium';
    }
  }, [getSizeClass]);

  // Get ordered list of all columns (fixed + visible dynamic)
  const getColumnOrder = useCallback(() => {
    // Fixed columns always come first
    const fixedColumnIds = FIXED_COLUMNS.map(col => col.id);
    // Then add visible dynamic columns in their definition order
    const dynamicColumnIds = COLUMN_DEFINITIONS
      .filter(col => visibleColumns.includes(col.id))
      .map(col => col.id);

    return [...fixedColumnIds, ...dynamicColumnIds];
  }, [visibleColumns]);

  return {
    visibleColumns,
    toggleColumn,
    resetDefaults,
    isColumnVisible,
    getSizeClass,
    getCellClasses,
    getHeaderClasses,
    getColumnOrder,
    columnDefinitions: COLUMN_DEFINITIONS,
    fixedColumns: FIXED_COLUMNS
  };
};