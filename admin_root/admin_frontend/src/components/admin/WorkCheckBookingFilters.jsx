/**
 * WorkCheckBookingFilters Component
 * Filter controls for work check bookings list
 */

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { instructorsApi } from '../../services/adminApi';

const LOCATIONS = [
  { value: 'all', label: 'All Locations' },
  { value: 'Mississauga', label: 'Mississauga' },
  { value: 'Vancouver', label: 'Vancouver' },
  { value: 'Calgary', label: 'Calgary' },
  { value: 'Montreal', label: 'Montreal' },
  { value: 'Richmond Hill', label: 'Richmond Hill' },
  { value: 'Online', label: 'Online' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Work Check', label: 'Work Check' },
  { value: 'Demo', label: 'Demo' },
  { value: 'Supervised Session', label: 'Supervised Session' }
];

const WorkCheckBookingFilters = ({
  instructorFilter,
  locationFilter,
  dateFrom,
  dateTo,
  statusFilter,
  typeFilter,
  onFilterChange,
  onClearFilters
}) => {
  const [instructors, setInstructors] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(true);

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

  const hasActiveFilters = instructorFilter || locationFilter || dateFrom || dateTo ||
    (statusFilter && statusFilter !== 'all') || (typeFilter && typeFilter !== 'all');

  return (
    <div className="bg-white dark:bg-dark-card shadow dark:shadow-gray-900/50 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Location Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location
          </label>
          <Select
            value={locationFilter || 'all'}
            onValueChange={(value) => onFilterChange('location', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instructor Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instructor
          </label>
          <Select
            value={instructorFilter || 'all'}
            onValueChange={(value) => onFilterChange('instructor', value === 'all' ? '' : value)}
            disabled={loadingInstructors}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingInstructors ? 'Loading...' : 'All Instructors'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Instructors</SelectItem>
              {instructors.map((instructor) => (
                <SelectItem key={instructor.id} value={instructor.id}>
                  {instructor.instructor_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <Select
            value={statusFilter || 'all'}
            onValueChange={(value) => onFilterChange('status', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <Select
            value={typeFilter || 'all'}
            onValueChange={(value) => onFilterChange('type', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date From
          </label>
          <DatePicker
            value={dateFrom}
            onChange={(value) => onFilterChange('dateFrom', value)}
            placeholder="Select start date"
            className="w-full"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date To
          </label>
          <DatePicker
            value={dateTo}
            onChange={(value) => onFilterChange('dateTo', value)}
            placeholder="Select end date"
            className="w-full"
          />
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

export default WorkCheckBookingFilters;
