/**
 * FilterBar Component
 * Provides filtering controls for the mock exams dashboard
 * Features large view toggle buttons and spacious filter layout
 */

import { ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

const LOCATIONS = [
  'Mississauga',
  'Calgary',
  'Vancouver',
  'Montreal',
  'Richmond Hill',
  'Online'
];

const MOCK_TYPES = [
  'Situational Judgment',
  'Clinical Skills',
  'Mini-mock',
  'Mock Discussion'
];

const FilterBar = ({
  filters,
  onFilterChange,
  onReset,
  activeFilterCount,
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="bg-white dark:bg-dark-card shadow-lg rounded-lg p-6 mb-6">
      {/* Single horizontal line layout with more spacing */}
      <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap">

        {/* View Mode Toggle - Larger buttons */}
        <div className="inline-flex rounded-lg shadow-sm flex-shrink-0" role="group">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`inline-flex items-center px-6 py-3 text-base font-semibold rounded-l-lg border-2 transition-all transform hover:scale-105 ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                : 'bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
            title="List View"
          >
            <ListBulletIcon className="h-5 w-5 mr-2" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('aggregate')}
            className={`inline-flex items-center px-6 py-3 text-base font-semibold rounded-r-lg border-2 border-l-0 transition-all transform hover:scale-105 ${
              viewMode === 'aggregate'
                ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                : 'bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
            title="Group View"
          >
            <Squares2X2Icon className="h-5 w-5 mr-2" />
            <span>Group View</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 hidden lg:block"></div>

        {/* Date Filters - Larger */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={filters.filter_date_from || ''}
            onChange={(e) => onFilterChange('filter_date_from', e.target.value)}
            className="block px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm dark:text-gray-300"
            title="From Date"
          />
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">to</span>
          <input
            type="date"
            value={filters.filter_date_to || ''}
            onChange={(e) => onFilterChange('filter_date_to', e.target.value)}
            className="block px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm dark:text-gray-300"
            title="To Date"
          />
        </div>

        {/* Location Filter - Larger */}
        <div className="min-w-[150px]">
          <select
            value={filters.filter_location || ''}
            onChange={(e) => onFilterChange('filter_location', e.target.value)}
            className="block w-full px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm dark:text-gray-300"
            title="Location"
          >
            <option value="">All Locations</option>
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

        {/* Mock Type Filter - Larger */}
        <div className="min-w-[180px]">
          <select
            value={filters.filter_mock_type || ''}
            onChange={(e) => onFilterChange('filter_mock_type', e.target.value)}
            className="block w-full px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm dark:text-gray-300"
            title="Mock Type"
          >
            <option value="">All Types</option>
            {MOCK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter - Larger */}
        <div className="min-w-[130px]">
          <select
            value={filters.filter_status || 'all'}
            onChange={(e) => onFilterChange('filter_status', e.target.value)}
            className="block w-full px-4 py-2.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm dark:text-gray-300"
            title="Status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Active filter count badge - Larger */}
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 flex-shrink-0">
            {activeFilterCount}
          </span>
        )}

        {/* Reset Button - Larger */}
        <button
          type="button"
          onClick={onReset}
          disabled={activeFilterCount === 0}
          className="inline-flex items-center px-5 py-2.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-bg hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 flex-shrink-0"
        >
          <svg className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Filters
        </button>
      </div>

      {/* Mobile/Tablet Responsive Layout - Shows on smaller screens */}
      <div className="mt-4 lg:hidden">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>For best experience, use desktop view to see all filters in one line.</p>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
