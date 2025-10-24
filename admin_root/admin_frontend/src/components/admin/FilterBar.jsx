/**
 * FilterBar Component
 * Provides filtering and search controls for the mock exams dashboard
 * Redesigned for compact horizontal layout with view toggle on the left
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
    <div className="bg-white dark:bg-dark-card shadow rounded-lg p-3 mb-6">
      {/* Single horizontal line layout */}
      <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">

        {/* View Mode Toggle - Leftmost position */}
        <div className="inline-flex rounded-md shadow-sm flex-shrink-0" role="group">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-l-md border transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
            title="List View"
          >
            <ListBulletIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('aggregate')}
            className={`inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-r-md border-t border-r border-b transition-colors ${
              viewMode === 'aggregate'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-hover'
            }`}
            title="Group View"
          >
            <Squares2X2Icon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Group</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 hidden lg:block"></div>

        {/* Search Bar - Compact */}
        <div className="flex-1 min-w-[150px] max-w-[200px]">
          <input
            type="text"
            placeholder="Search..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="block w-full px-2.5 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs placeholder-gray-400 dark:text-gray-300"
          />
        </div>

        {/* Date Filters - Compact */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.filter_date_from || ''}
            onChange={(e) => onFilterChange('filter_date_from', e.target.value)}
            className="block px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs dark:text-gray-300"
            title="From Date"
          />
          <span className="text-gray-500 dark:text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={filters.filter_date_to || ''}
            onChange={(e) => onFilterChange('filter_date_to', e.target.value)}
            className="block px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs dark:text-gray-300"
            title="To Date"
          />
        </div>

        {/* Location Filter - Compact */}
        <div className="min-w-[120px]">
          <select
            value={filters.filter_location || ''}
            onChange={(e) => onFilterChange('filter_location', e.target.value)}
            className="block w-full px-2.5 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs dark:text-gray-300"
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

        {/* Mock Type Filter - Compact */}
        <div className="min-w-[130px]">
          <select
            value={filters.filter_mock_type || ''}
            onChange={(e) => onFilterChange('filter_mock_type', e.target.value)}
            className="block w-full px-2.5 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs dark:text-gray-300"
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

        {/* Status Filter - Compact */}
        <div className="min-w-[100px]">
          <select
            value={filters.filter_status || 'all'}
            onChange={(e) => onFilterChange('filter_status', e.target.value)}
            className="block w-full px-2.5 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-xs dark:text-gray-300"
            title="Status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Active filter count badge */}
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 flex-shrink-0">
            {activeFilterCount}
          </span>
        )}

        {/* Reset Button - Rightmost position */}
        <button
          type="button"
          onClick={onReset}
          disabled={activeFilterCount === 0}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-bg hover:bg-gray-50 dark:hover:bg-dark-hover focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <svg className="h-3.5 w-3.5 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Filters
        </button>
      </div>

      {/* Mobile/Tablet Responsive Layout - Shows on smaller screens */}
      <div className="mt-3 lg:hidden">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>For best experience, use desktop view to see all filters in one line.</p>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
