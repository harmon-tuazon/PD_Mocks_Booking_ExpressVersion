/**
 * WorkCheckBookingFilters Component
 * Filter controls for work check bookings list
 * Compact horizontal layout matching Mocks Dashboard FilterBar
 */

import { useState, useEffect } from 'react';
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

  // Count active filters for badge
  const activeFilterCount = [
    locationFilter,
    instructorFilter,
    dateFrom,
    dateTo,
    statusFilter && statusFilter !== 'all' ? statusFilter : null,
    typeFilter && typeFilter !== 'all' ? typeFilter : null
  ].filter(Boolean).length;

  return (
    <div className="bg-white dark:bg-dark-card shadow-lg rounded-lg p-4 mb-6">
      {/* Compact horizontal layout - filters in a row with Reset at end */}
      <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">

        {/* Date From */}
        <div className="min-w-[140px]">
          <DatePicker
            value={dateFrom}
            onChange={(value) => onFilterChange('dateFrom', value)}
            placeholder="From Date"
            className="w-full"
          />
        </div>

        {/* Date To */}
        <div className="min-w-[140px]">
          <DatePicker
            value={dateTo}
            onChange={(value) => onFilterChange('dateTo', value)}
            placeholder="To Date"
            className="w-full"
          />
        </div>

        {/* Location Filter */}
        <div className="min-w-[140px]">
          <Select
            value={locationFilter || 'all'}
            onValueChange={(value) => onFilterChange('location', value === 'all' ? '' : value)}
          >
            <SelectTrigger title="Location">
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
        <div className="min-w-[160px]">
          <Select
            value={instructorFilter || 'all'}
            onValueChange={(value) => onFilterChange('instructor', value === 'all' ? '' : value)}
            disabled={loadingInstructors}
          >
            <SelectTrigger title="Instructor">
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
        <div className="min-w-[120px]">
          <Select
            value={statusFilter || 'all'}
            onValueChange={(value) => onFilterChange('status', value)}
          >
            <SelectTrigger title="Status">
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
        <div className="min-w-[140px]">
          <Select
            value={typeFilter || 'all'}
            onValueChange={(value) => onFilterChange('type', value)}
          >
            <SelectTrigger title="Type">
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

        {/* Reset Button with Badge */}
        <button
          onClick={onClearFilters}
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
      </div>
    </div>
  );
};

export default WorkCheckBookingFilters;
