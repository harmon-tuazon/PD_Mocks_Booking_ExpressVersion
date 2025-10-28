/**
 * MockExamsDashboard Page
 * Main dashboard for viewing and managing all mock exams
 */

import { Link, useNavigate } from 'react-router-dom';
import { useMockExamsInfinite, useMockExamsMetrics } from '../hooks/useMockExamsData';
import { useTableFilters } from '../hooks/useTableFilters';
import { useFetchAggregates } from '../hooks/useFetchAggregates';
import DashboardMetrics from '../components/admin/DashboardMetrics';
import FilterBar from '../components/admin/FilterBar';
import MockExamsTable from '../components/admin/MockExamsTable';
import { useMemo, useState } from 'react';

function MockExamsDashboard() {
  const navigate = useNavigate();

  // State for view mode
  const [viewMode, setViewMode] = useState('aggregate'); // 'list' or 'aggregate'

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

  // Fetch mock exams data with infinite scroll (list view)
  const {
    data: mockExamsData,
    isLoading: isLoadingExams,
    error: examsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useMockExamsInfinite(getQueryParams);

  // Flatten all pages of data into a single array
  const allExams = useMemo(() => {
    if (!mockExamsData?.pages || !Array.isArray(mockExamsData.pages)) return [];
    return mockExamsData.pages.flatMap(page => {
      // Defensive: Ensure page.data is an array before flattening
      return Array.isArray(page?.data) ? page.data : [];
    });
  }, [mockExamsData]);

  // Fetch aggregates data when in aggregate view mode
  // Use getFilterParams to ONLY refetch when filters change, NOT when sort changes
  const {
    data: aggregatesData,
    isLoading: isLoadingAggregates,
    error: aggregatesError
  } = useFetchAggregates(getFilterParams, {
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

  // Handle sorting for list view (backend sorting with API call)
  const handleSort = (column) => {
    toggleSort(column);
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

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

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
          key={JSON.stringify(getFilterParams) + viewMode}
          data={viewMode === 'aggregate' ? sortedAggregates : allExams}
          isLoading={viewMode === 'aggregate' ? isLoadingAggregates : isLoadingExams}
          onSort={viewMode === 'aggregate' ? handleAggregateSort : handleSort}
          currentSort={viewMode === 'aggregate' ? getCurrentSortForAggregate() : {
            sort_by: filters.sort_by,
            sort_order: filters.sort_order
          }}
          hasNextPage={viewMode === 'aggregate' ? false : hasNextPage}
          fetchNextPage={viewMode === 'aggregate' ? undefined : fetchNextPage}
          isFetchingNextPage={viewMode === 'aggregate' ? false : isFetchingNextPage}
          viewMode={viewMode}
          onView={handleView}
        />
      </div>
    </div>
  );
}

export default MockExamsDashboard;
