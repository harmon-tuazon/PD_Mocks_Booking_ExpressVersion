/**
 * FilterBar Component
 * Provides filtering controls for the mock exams dashboard
 * Compact layout with filters first, reset button, then view toggles at the end
 */

import { ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { LOCATIONS, MOCK_TYPES } from '../../constants/examConstants';

const FilterBar = ({
  filters,
  onFilterChange,
  onReset,
  activeFilterCount,
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="bg-white dark:bg-dark-card shadow-lg rounded-lg p-4 mb-6">
      {/* Compact horizontal layout - filters first, then reset, then view toggles */}
      <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">

        {/* Date Filters - Compact */}
        <div className="flex items-center gap-2">
          <DatePicker
            value={filters.filter_date_from || ''}
            onChange={(value) => onFilterChange('filter_date_from', value)}
            placeholder="From Date"
            className="min-w-[140px]"
          />
          <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
          <DatePicker
            value={filters.filter_date_to || ''}
            onChange={(value) => onFilterChange('filter_date_to', value)}
            placeholder="To Date"
            className="min-w-[140px]"
          />
        </div>

        {/* Location Filter - Compact */}
        <div className="min-w-[140px]">
          <Select
            value={filters.filter_location || 'all'}
            onValueChange={(value) => onFilterChange('filter_location', value === 'all' ? '' : value)}
          >
            <SelectTrigger title="Location">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {LOCATIONS.map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mock Type Filter - Compact */}
        <div className="min-w-[160px]">
          <Select
            value={filters.filter_mock_type || 'all'}
            onValueChange={(value) => onFilterChange('filter_mock_type', value === 'all' ? '' : value)}
          >
            <SelectTrigger title="Mock Type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MOCK_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter - Compact */}
        <div className="min-w-[120px]">
          <Select
            value={filters.filter_status || 'all'}
            onValueChange={(value) => onFilterChange('filter_status', value)}
          >
            <SelectTrigger title="Status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter - Frontend only (Upcoming vs All) */}
        <div className="min-w-[120px]">
          <Select
            value={filters.filter_date_range || 'upcoming'}
            onValueChange={(value) => onFilterChange('filter_date_range', value)}
          >
            <SelectTrigger title="Date Range">
              <SelectValue placeholder="Upcoming" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="all">All Dates</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button - Compact with Badge */}
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300
                   bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200
                   dark:hover:bg-gray-700 rounded-lg flex items-center
                   transition-colors duration-200"
          title="Reset all filters"
        >
          Reset
          {activeFilterCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500 text-white text-xs
                           rounded-full min-w-[20px] text-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onViewModeChange('list')}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="List View"
          >
            <ListBulletIcon className="h-4 w-4 mr-1.5" />
            List
          </button>
          <button
            onClick={() => onViewModeChange('aggregate')}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              viewMode === 'aggregate'
                ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Group View"
          >
            <Squares2X2Icon className="h-4 w-4 mr-1.5" />
            Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;