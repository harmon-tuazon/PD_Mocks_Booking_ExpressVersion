/**
 * MockExamsDashboard Page
 * Main dashboard for viewing and managing all mock exams
 */

import { Link, useNavigate } from 'react-router-dom';
import { useMockExamsData, useMockExamsMetrics } from '../hooks/useMockExamsData';
import { useTableFilters } from '../hooks/useTableFilters';
import { useFetchAggregates } from '../hooks/useFetchAggregates';
import useBulkSelection from '../hooks/useBulkSelection';
import DashboardMetrics from '../components/admin/DashboardMetrics';
import FilterBar from '../components/admin/FilterBar';
import MockExamsSelectionToolbar from '../components/admin/MockExamsSelectionToolbar';
import MockExamsTable from '../components/admin/MockExamsTable';
import BulkToggleActiveModal from '../components/admin/BulkToggleActiveModal';
import { useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

function MockExamsDashboard() {
  const navigate = useNavigate();

  // State for view mode
  const [viewMode, setViewMode] = useState('aggregate'); // 'list' or 'aggregate'

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Match BookingsTable

  // State for bulk toggle modal
  const [isBulkToggleModalOpen, setIsBulkToggleModalOpen] = useState(false);

  // Initialize filter management
  const {
    filters,
    updateFilter,
    resetFilters,
    toggleSort,
    hasActiveFilters,
    activeFilterCount,
    getQueryParams,
    getFilterParams // NEW: Excludes sort params for client-side sorting
  } = useTableFilters();

  // Build query params with page number
  const queryParamsWithPage = useMemo(() => {
    return {
      ...getQueryParams,  // getQueryParams is already a memoized value, not a function
      page: currentPage,
      limit: itemsPerPage
    };
  }, [getQueryParams, currentPage]);

  // Use filter params directly (it's already memoized in useTableFilters)
  const filterParamsOnly = getFilterParams;  // Already a memoized value, not a function

  // Fetch mock exams data with pagination (list view)
  const {
    data: mockExamsResponse,
    isLoading: isLoadingExams,
    error: examsError
  } = useMockExamsData(queryParamsWithPage, {
    enabled: viewMode === 'list'
  });

  // Extract data and pagination info
  const mockExamsData = useMemo(() => {
    if (!mockExamsResponse) return [];
    // Defensive: Ensure data is an array
    return Array.isArray(mockExamsResponse.data) ? mockExamsResponse.data : [];
  }, [mockExamsResponse]);

  const paginationInfo = useMemo(() => {
    if (!mockExamsResponse?.pagination) {
      return {
        total_pages: 1,
        total_records: 0,
        current_page: 1
      };
    }
    return mockExamsResponse.pagination;
  }, [mockExamsResponse]);

  // Fetch aggregates data when in aggregate view mode
  // Use filterParamsOnly to ONLY refetch when filters change, NOT when sort changes
  const {
    data: aggregatesData,
    isLoading: isLoadingAggregates,
    error: aggregatesError
  } = useFetchAggregates(filterParamsOnly, {
    enabled: viewMode === 'aggregate'
  });

  // Client-side sorted aggregates
  // This ensures sorting doesn't trigger API calls
  const sortedAggregates = useMemo(() => {
    if (!aggregatesData || !Array.isArray(aggregatesData)) return [];

    // Create a copy to avoid mutating original array
    const sorted = [...aggregatesData];

    // Map backend sort names to frontend column names for matching
    const columnMap = {
      'date': 'exam_date',
      'type': 'mock_type',
      'location': 'location'
    };

    const sortColumn = columnMap[filters.sort_by] || filters.sort_by;

    // Sort based on current filter settings
    sorted.sort((a, b) => {
      let compareValue = 0;

      switch (sortColumn) {
        case 'location':
          compareValue = (a.location || '').localeCompare(b.location || '');
          break;
        case 'exam_date':
          // Compare dates
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);
          compareValue = dateA - dateB;
          break;
        case 'mock_type':
          compareValue = (a.mock_type || '').localeCompare(b.mock_type || '');
          break;
        default:
          compareValue = 0;
      }

      // Apply sort order (ascending or descending)
      return filters.sort_order === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [aggregatesData, filters.sort_by, filters.sort_order]);

  // Client-side paginated aggregates
  const paginatedAggregates = useMemo(() => {
    if (!sortedAggregates || sortedAggregates.length === 0) return [];

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Return paginated slice
    return sortedAggregates.slice(startIndex, endIndex);
  }, [sortedAggregates, currentPage, itemsPerPage]);

  // Calculate total pages for aggregates
  const aggregatesTotalPages = useMemo(() => {
    if (!sortedAggregates || sortedAggregates.length === 0) return 1;
    return Math.ceil(sortedAggregates.length / itemsPerPage);
  }, [sortedAggregates, itemsPerPage]);

  // Initialize bulk selection
  // Use the current view's data for selection tracking
  const currentSessions = useMemo(() => {
    if (viewMode === 'aggregate') {
      // For aggregate view, flatten all sessions from aggregates
      const allSessions = [];
      paginatedAggregates.forEach(aggregate => {
        if (aggregate.sessions && Array.isArray(aggregate.sessions)) {
          allSessions.push(...aggregate.sessions);
        }
      });
      return allSessions;
    } else {
      // For list view, use the mock exams data directly
      return mockExamsData;
    }
  }, [viewMode, paginatedAggregates, mockExamsData]);

  // Calculate total session count across all pages for consistent display
  const totalSessionCount = useMemo(() => {
    if (viewMode === 'aggregate') {
      // For aggregate view, sum session counts from all aggregates (not just paginated)
      return sortedAggregates.reduce((total, aggregate) => {
        return total + (aggregate.session_count || 0);
      }, 0);
    } else {
      // For list view, use backend pagination total
      return paginationInfo.total_records;
    }
  }, [viewMode, sortedAggregates, paginationInfo.total_records]);

  const bulkSelection = useBulkSelection(currentSessions, totalSessionCount);

  // Fetch metrics data (only pass non-empty date filters)
  const metricsFilters = useMemo(() => {
    const params = {};
    if (filters.filter_date_from) params.date_from = filters.filter_date_from;
    if (filters.filter_date_to) params.date_to = filters.filter_date_to;
    return params;
  }, [filters.filter_date_from, filters.filter_date_to]);

  const {
    data: metricsData,
    isLoading: isLoadingMetrics
  } = useMockExamsMetrics(metricsFilters);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle filter change - reset to first page when filters change
  const handleFilterChange = (filterName, value) => {
    updateFilter(filterName, value);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Handle reset filters - also reset page
  const handleResetFilters = () => {
    resetFilters();
    setCurrentPage(1); // Reset to first page when filters are cleared
  };

  // Handle sorting for list view (backend sorting with API call)
  const handleSort = (column) => {
    toggleSort(column);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle sorting for aggregate view (client-side sorting, no API call)
  // Maps frontend column names to backend names for state consistency
  const handleAggregateSort = (column) => {
    // Map frontend column names to backend names for state
    const columnMap = {
      'exam_date': 'date',
      'mock_type': 'type',
      'location': 'location'
    };

    const backendColumn = columnMap[column] || column;
    toggleSort(backendColumn);
    // Note: This updates state but doesn't trigger API call because
    // useFetchAggregates uses getFilterParams (which excludes sort)
  };

  // Handler for viewing a mock exam session
  const handleView = (session) => {
    navigate(`/mock-exams/${session.id}`);
  };

  // Handler for opening bulk toggle modal
  const handleToggleActiveStatus = useCallback(() => {
    setIsBulkToggleModalOpen(true);
  }, []);

  // Handler for confirming bulk toggle operation
  const handleConfirmToggle = useCallback(async () => {
    try {
      const sessionIds = bulkSelection.selectedIds;
      const result = await bulkSelection.executeBulkToggle(sessionIds);

      // Show success/failure toast based on results
      if (result.success) {
        if (result.summary.failed === 0) {
          // All successful
          toast.success(
            `Successfully toggled status for ${result.summary.updated} session${result.summary.updated !== 1 ? 's' : ''}`
          );
        } else {
          // Partial success
          toast.success(
            `Toggled ${result.summary.updated} of ${result.summary.total} sessions. ${result.summary.failed} failed.`,
            { duration: 6000 }
          );
        }
      } else {
        // Complete failure
        toast.error('Failed to toggle session status. Please try again.');
      }

      // Exit selection mode and close modal on success
      if (result.success && result.summary.updated > 0) {
        bulkSelection.exitToView();
        setIsBulkToggleModalOpen(false);
      }
    } catch (error) {
      // Error toast already shown by executeBulkToggle
      console.error('Toggle confirmation error:', error);
      // Keep modal open on error so user can retry or cancel
    }
  }, [bulkSelection]);

  // Map backend sort column names back to frontend for display
  const getCurrentSortForAggregate = () => {
    const reverseColumnMap = {
      'date': 'exam_date',
      'type': 'mock_type',
      'location': 'location'
    };
    
    return {
      sort_by: reverseColumnMap[filters.sort_by] || filters.sort_by,
      sort_order: filters.sort_order
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">Mock Exams Dashboard</h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              View and manage all mock exam sessions
            </p>
          </div>
          <div>
            <Link
              to="/mock-exams/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Session
            </Link>
          </div>
        </div>

        {/* Dashboard Metrics */}
        <div className="mb-6">
          <DashboardMetrics
            metrics={metricsData?.metrics}
            isLoading={isLoadingMetrics}
          />
        </div>

        {/* Filter Bar or Selection Toolbar */}
        {!bulkSelection.isSelectionMode ? (
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            activeFilterCount={activeFilterCount}
            viewMode={viewMode}
            onViewModeChange={(newMode) => {
              setViewMode(newMode);
              setCurrentPage(1); // Reset to first page when view mode changes
            }}
          />
        ) : (
          <MockExamsSelectionToolbar
            selectedCount={bulkSelection.selectedCount}
            totalCount={bulkSelection.totalCount}
            onClearAll={bulkSelection.clearAll}
            onExitMode={bulkSelection.exitToView}
            onToggleActiveStatus={handleToggleActiveStatus}
            selectedSessions={bulkSelection.selectedSessions}
            isSubmitting={bulkSelection.isSubmitting}
          />
        )}

        {/* Error Message */}
        {examsError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {examsError.message || 'Failed to load mock exams'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mock Exams Table */}
        <MockExamsTable
          key={JSON.stringify(filterParamsOnly) + viewMode}
          data={viewMode === 'aggregate' ? paginatedAggregates : mockExamsData}
          isLoading={viewMode === 'aggregate' ? isLoadingAggregates : isLoadingExams}
          onSort={viewMode === 'aggregate' ? handleAggregateSort : handleSort}
          currentSort={viewMode === 'aggregate' ? getCurrentSortForAggregate() : {
            sort_by: filters.sort_by,
            sort_order: filters.sort_order
          }}
          viewMode={viewMode}
          onView={handleView}
          // Pagination props
          currentPage={currentPage}
          totalPages={viewMode === 'aggregate' ? aggregatesTotalPages : paginationInfo.total_pages}
          totalItems={viewMode === 'aggregate' ? sortedAggregates.length : paginationInfo.total_records}
          onPageChange={handlePageChange}
          // Bulk selection props
          isSelectionMode={bulkSelection.isSelectionMode}
          onToggleSelection={bulkSelection.toggleSelection}
          isSelected={bulkSelection.isSelected}
        />

        {/* Bulk Toggle Active Modal */}
        <BulkToggleActiveModal
          isOpen={isBulkToggleModalOpen}
          onClose={() => setIsBulkToggleModalOpen(false)}
          onConfirm={handleConfirmToggle}
          selectedSessions={bulkSelection.selectedSessions}
          isSubmitting={bulkSelection.isSubmitting}
        />
      </div>
    </div>
  );
}

export default MockExamsDashboard;
