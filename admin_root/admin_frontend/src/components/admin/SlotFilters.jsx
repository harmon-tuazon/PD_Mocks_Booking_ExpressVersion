/**
 * SlotFilters Component
 * Filter controls for work check slots list
 */

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { instructorsApi, groupsApi } from '../../services/adminApi';

const LOCATIONS = [
  { value: '', label: 'All Locations' },
  { value: 'Mississauga', label: 'Mississauga' },
  { value: 'Vancouver', label: 'Vancouver' },
  { value: 'Calgary', label: 'Calgary' },
  { value: 'Montreal', label: 'Montreal' },
  { value: 'Richmond Hill', label: 'Richmond Hill' },
  { value: 'Online', label: 'Online' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' }
];

const ACTIVATION_OPTIONS = [
  { value: 'all', label: 'All Activation' },
  { value: 'immediate', label: 'Immediate' },
  { value: 'scheduled', label: 'Scheduled' }
];

const SORT_OPTIONS = [
  { value: 'slot_date', label: 'Date' },
  { value: 'slot_time', label: 'Time' },
  { value: 'location', label: 'Location' },
  { value: 'created_at', label: 'Created At' }
];

const SlotFilters = ({
  instructorFilter,
  groupFilter,
  locationFilter,
  dateFrom,
  dateTo,
  statusFilter,
  activationFilter,
  sortBy,
  sortOrder,
  onFilterChange,
  onClearFilters,
  onSortChange
}) => {
  const [instructors, setInstructors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Fetch instructors for dropdown
  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const response = await instructorsApi.getDropdown();
        setInstructors(response.data || []);
      } catch (error) {
        console.error('Failed to fetch instructors:', error);
      } finally {
        setLoadingInstructors(false);
      }
    };
    fetchInstructors();
  }, []);

  // Fetch groups for dropdown
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await groupsApi.list({ limit: 100 });
        setGroups(response.data || []);
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, []);

  const hasActiveFilters = instructorFilter || groupFilter || locationFilter || dateFrom || dateTo || statusFilter !== 'all' || activationFilter !== 'all';

  return (
    <div className="bg-white dark:bg-dark-card shadow dark:shadow-gray-900/50 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Instructor Filter */}
        <div>
          <label htmlFor="instructor-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instructor
          </label>
          <select
            id="instructor-filter"
            value={instructorFilter}
            onChange={(e) => onFilterChange('instructor', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            disabled={loadingInstructors}
          >
            <option value="">All Instructors</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.instructor_name}
              </option>
            ))}
          </select>
        </div>

        {/* Group Filter */}
        <div>
          <label htmlFor="group-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Group
          </label>
          <select
            id="group-filter"
            value={groupFilter}
            onChange={(e) => onFilterChange('group', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            disabled={loadingGroups}
          >
            <option value="">All Groups</option>
            {groups.map((group) => (
              <option key={group.group_id} value={group.group_id}>
                {group.group_name || group.group_id}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location
          </label>
          <select
            id="location-filter"
            value={locationFilter}
            onChange={(e) => onFilterChange('location', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date From
          </label>
          <input
            type="date"
            id="date-from"
            value={dateFrom}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        {/* Date To */}
        <div>
          <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date To
          </label>
          <input
            type="date"
            id="date-to"
            value={dateTo}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        {/* Activation Status */}
        <div>
          <label htmlFor="activation-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Activation
          </label>
          <select
            id="activation-filter"
            value={activationFilter}
            onChange={(e) => onFilterChange('activation', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            {ACTIVATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort By
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value, sortOrder)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Order
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => onSortChange(sortBy, e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClearFilters}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default SlotFilters;
