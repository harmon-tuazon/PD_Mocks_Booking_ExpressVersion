/**
 * Custom hook for managing table filters state
 */

import { useState, useCallback, useMemo } from 'react';

const DEFAULT_FILTERS = {
  page: 1,
  limit: 25,
  sort_by: 'exam_date',
  sort_order: 'desc',
  filter_location: '',
  filter_mock_type: '',
  filter_status: 'all',
  filter_date_from: '',
  filter_date_to: ''
};

/**
 * Hook to manage table filters and sorting
 * @param {Object} initialFilters - Initial filter values
 * @returns {Object} Filter state and update functions
 */
export function useTableFilters(initialFilters = {}) {
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
    ...initialFilters
  });

  /**
   * Update a specific filter
   */
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1 // Reset to page 1 when changing filters
    }));
  }, []);

  /**
   * Update multiple filters at once
   */
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to page 1 when changing filters
    }));
  }, []);

  /**
   * Reset all filters to defaults
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Set page number
   */
  const setPage = useCallback((page) => {
    updateFilter('page', page);
  }, [updateFilter]);

  /**
   * Set sorting
   */
  const setSort = useCallback((sortBy, sortOrder) => {
    setFilters(prev => ({
      ...prev,
      sort_by: sortBy,
      sort_order: sortOrder,
      page: 1
    }));
  }, []);

  /**
   * Toggle sort order for a column
   */
  const toggleSort = useCallback((column) => {
    setFilters(prev => {
      if (prev.sort_by === column) {
        // Same column - toggle order
        return {
          ...prev,
          sort_order: prev.sort_order === 'asc' ? 'desc' : 'asc',
          page: 1
        };
      } else {
        // Different column - set to ascending
        return {
          ...prev,
          sort_by: column,
          sort_order: 'asc',
          page: 1
        };
      }
    });
  }, []);

  /**
   * Check if any filters are active (excluding defaults)
   */
  const hasActiveFilters = useMemo(() => {
    return (
      filters.filter_location !== '' ||
      filters.filter_mock_type !== '' ||
      filters.filter_status !== 'all' ||
      filters.filter_date_from !== '' ||
      filters.filter_date_to !== ''
    );
  }, [filters]);

  /**
   * Get active filter count
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.filter_location) count++;
    if (filters.filter_mock_type) count++;
    if (filters.filter_status !== 'all') count++;
    if (filters.filter_date_from) count++;
    if (filters.filter_date_to) count++;
    return count;
  }, [filters]);

  /**
   * Get query params for API call (removes empty values)
   * INCLUDES sort parameters - use for paginated list view
   */
  const getQueryParams = useMemo(() => {
    const params = {};
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== '' && value !== 'all') {
        params[key] = value;
      }
    });
    return params;
  }, [filters]);

  /**
   * Get filter params for API call (EXCLUDES sort and page parameters)
   * Use for aggregate view to avoid refetching on sort changes
   */
  const getFilterParams = useMemo(() => {
    const params = {};
    Object.keys(filters).forEach(key => {
      // Exclude sort_by, sort_order, and page from API params
      if (key !== 'sort_by' && key !== 'sort_order' && key !== 'page') {
        const value = filters[key];
        if (value !== '' && value !== 'all') {
          params[key] = value;
        }
      }
    });
    return params;
  }, [filters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    setPage,
    setSort,
    toggleSort,
    hasActiveFilters,
    activeFilterCount,
    getQueryParams,
    getFilterParams // NEW: For client-side sorting scenarios
  };
}

export default useTableFilters;
