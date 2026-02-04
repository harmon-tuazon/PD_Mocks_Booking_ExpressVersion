/**
 * InstructorFilters Component
 * Provides search, status filter, and sort controls for instructor list
 */

import { Search } from 'lucide-react';

const InstructorFilters = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange
}) => {
  // Sort options
  const SORT_OPTIONS = [
    { value: 'instructor_name:asc', label: 'Name (A-Z)' },
    { value: 'instructor_name:desc', label: 'Name (Z-A)' },
    { value: 'email:asc', label: 'Email (A-Z)' },
    { value: 'email:desc', label: 'Email (Z-A)' },
    { value: 'created_at:desc', label: 'Newest First' },
    { value: 'created_at:asc', label: 'Oldest First' }
  ];

  const currentSortValue = `${sortBy}:${sortOrder}`;

  const handleSortChange = (e) => {
    const [newSortBy, newSortOrder] = e.target.value.split(':');
    onSortChange?.(newSortBy, newSortOrder);
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search instructors by name or email..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Status:</span>
          <select
            value={status}
            onChange={(e) => onStatusChange?.(e.target.value)}
            className="block w-auto pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort:</span>
          <select
            value={currentSortValue}
            onChange={handleSortChange}
            className="block w-auto pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default InstructorFilters;
