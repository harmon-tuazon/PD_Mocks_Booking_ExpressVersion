/**
 * FilterBar Component
 * Provides filtering and search controls for the mock exams dashboard
 */

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

const FilterBar = ({ filters, onFilterChange, onReset, activeFilterCount }) => {
  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="space-y-3">
        {/* Search Bar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by type, location, date..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Date Range From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.filter_date_from || ''}
              onChange={(e) => onFilterChange('filter_date_from', e.target.value)}
              className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          {/* Date Range To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.filter_date_to || ''}
              onChange={(e) => onFilterChange('filter_date_to', e.target.value)}
              className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={filters.filter_location || ''}
              onChange={(e) => onFilterChange('filter_location', e.target.value)}
              className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              <option value="">All Locations</option>
              {LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          {/* Mock Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mock Type <span className="text-red-500">*</span>
            </label>
            <select
              value={filters.filter_mock_type || ''}
              onChange={(e) => onFilterChange('filter_mock_type', e.target.value)}
              className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              <option value="">All Types</option>
              {MOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.filter_status || 'all'}
              onChange={(e) => onFilterChange('filter_status', e.target.value)}
              className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
