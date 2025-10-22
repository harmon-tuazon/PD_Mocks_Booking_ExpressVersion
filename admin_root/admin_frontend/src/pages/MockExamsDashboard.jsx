/**
 * MockExamsDashboard Page
 * Main dashboard for viewing and managing all mock exams
 */

import { Link } from 'react-router-dom';
import { useMockExamsData, useMockExamsMetrics } from '../hooks/useMockExamsData';
import { useTableFilters } from '../hooks/useTableFilters';
import DashboardMetrics from '../components/admin/DashboardMetrics';
import FilterBar from '../components/admin/FilterBar';
import MockExamsTable from '../components/admin/MockExamsTable';

function MockExamsDashboard() {
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

  // Fetch mock exams data
  const {
    data: mockExamsData,
    isLoading: isLoadingExams,
    error: examsError
  } = useMockExamsData(getQueryParams);

  // Fetch metrics data
  const {
    data: metricsData,
    isLoading: isLoadingMetrics
  } = useMockExamsMetrics({
    date_from: filters.filter_date_from,
    date_to: filters.filter_date_to
  });

  const handleSort = (column) => {
    toggleSort(column);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mock Exams Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all mock exam sessions
          </p>
        </div>
        <Link
          to="/admin/mock-exams/create"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Session
        </Link>
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
        data={mockExamsData?.data}
        pagination={mockExamsData?.pagination}
        isLoading={isLoadingExams}
        onSort={handleSort}
        currentSort={{
          sort_by: filters.sort_by,
          sort_order: filters.sort_order
        }}
      />
    </div>
  );
}

export default MockExamsDashboard;
