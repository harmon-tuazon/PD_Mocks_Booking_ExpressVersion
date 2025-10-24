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
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

function MockExamsDashboard() {
  const navigate = useNavigate();

  // State for view mode
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'aggregate'

  // Initialize filter management
  const {
    filters,
    updateFilter,
    resetFilters,
    toggleSort,
    hasActiveFilters,
    activeFilterCount,
    getQueryParams
  } = useTableFilters();

  // Fetch mock exams data with infinite scroll
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
    if (!mockExamsData?.pages) return [];
    return mockExamsData.pages.flatMap(page => page.data || []);
  }, [mockExamsData]);

  // Fetch aggregates data when in aggregate view mode
  const {
    data: aggregatesData,
    isLoading: isLoadingAggregates,
    error: aggregatesError
  } = useFetchAggregates(getQueryParams, {
    enabled: viewMode === 'aggregate'
  });

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

  const handleSort = (column) => {
    toggleSort(column);
  };

  // Handler for viewing a mock exam session
  const handleView = (session) => {
    navigate(`/mock-exams/${session.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-h1 font-bold text-navy-900 dark:text-gray-100">Mock Exams Dashboard</h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              View and manage all mock exam sessions
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-l-md border ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <ListBulletIcon className="h-5 w-5 mr-1" />
                List View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('aggregate')}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                  viewMode === 'aggregate'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Squares2X2Icon className="h-5 w-5 mr-1" />
                Group View
              </button>
            </div>

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
          key={JSON.stringify(getQueryParams) + viewMode}
          data={viewMode === 'aggregate' ? (aggregatesData?.data || []) : allExams}
          isLoading={viewMode === 'aggregate' ? isLoadingAggregates : isLoadingExams}
          onSort={handleSort}
          currentSort={{
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
