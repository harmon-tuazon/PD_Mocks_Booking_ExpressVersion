import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { DatePicker } from '../ui/date-picker';
import { Calendar, MapPin, Users, BookOpen, CheckCircle, XCircle, Filter, X } from 'lucide-react';

/**
 * BookingFilters Component
 * Provides 5 filter types for booking data:
 * 1. Location (multi-select)
 * 2. Attendance (multi-select checkboxes)
 * 3. Mock Type (multi-select)
 * 4. Exam Date (date range)
 * 5. Booking Status (single select)
 */
const BookingFilters = ({ bookings = [], filters, onFiltersChange, className = '' }) => {
  // Hardcoded location and mock type options (aligned with mock exam dashboard)
  const uniqueValues = useMemo(() => {
    return {
      locations: [
        'Mississauga',
        'Mississauga - B9',
        'Mississauga - Lab D',
        'Calgary',
        'Vancouver',
        'Montreal',
        'Richmond Hill',
        'Online'
      ],
      mockTypes: [
        'Situational Judgment',
        'Clinical Skills',
        'Mini-mock',
        'Mock Discussion'
      ]
    };
  }, []);

  // Initialize filters if not provided
  const [localFilters, setLocalFilters] = useState({
    locations: [],
    attendance: [],
    mockTypes: [],
    dateFrom: null,
    dateTo: null,
    status: 'All',
    ...filters
  });

  // Update local filters when external filters change
  useEffect(() => {
    if (filters) {
      setLocalFilters(prev => ({ ...prev, ...filters }));
    }
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...localFilters, [filterType]: value };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  // Handle multi-select location
  const toggleLocation = (location) => {
    const newLocations = localFilters.locations.includes(location)
      ? localFilters.locations.filter(l => l !== location)
      : [...localFilters.locations, location];
    handleFilterChange('locations', newLocations);
  };

  // Handle multi-select mock type
  const toggleMockType = (mockType) => {
    const newMockTypes = localFilters.mockTypes.includes(mockType)
      ? localFilters.mockTypes.filter(m => m !== mockType)
      : [...localFilters.mockTypes, mockType];
    handleFilterChange('mockTypes', newMockTypes);
  };

  // Handle attendance checkboxes
  const toggleAttendance = (value) => {
    const newAttendance = localFilters.attendance.includes(value)
      ? localFilters.attendance.filter(a => a !== value)
      : [...localFilters.attendance, value];
    handleFilterChange('attendance', newAttendance);
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters = {
      locations: [],
      attendance: [],
      mockTypes: [],
      dateFrom: null,
      dateTo: null,
      status: 'All'
    };
    setLocalFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.locations.length > 0) count += localFilters.locations.length;
    if (localFilters.attendance.length > 0) count += localFilters.attendance.length;
    if (localFilters.mockTypes.length > 0) count += localFilters.mockTypes.length;
    if (localFilters.dateFrom || localFilters.dateTo) count += 1;
    if (localFilters.status !== 'All') count += 1;
    return count;
  }, [localFilters]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active filters header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button
            onClick={clearAllFilters}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Filter controls - responsive layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

        {/* Filter 1: Location */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <MapPin className="h-3 w-3" />
            Location
          </label>
          <div className="relative">
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder="Select locations"
                >
                  {localFilters.locations.length > 0
                    ? `${localFilters.locations.length} selected`
                    : "All locations"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectGroup>
                  {uniqueValues.locations.map(location => (
                    <div
                      key={location}
                      className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => toggleLocation(location)}
                    >
                      <Checkbox
                        checked={localFilters.locations.includes(location)}
                        className="pointer-events-none"
                      />
                      <label className="text-sm cursor-pointer flex-1">
                        {location}
                      </label>
                    </div>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter 2: Attendance */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Users className="h-3 w-3" />
            Attendance
          </label>
          <Select>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder="Select attendance"
              >
                {localFilters.attendance.length > 0
                  ? `${localFilters.attendance.length} selected`
                  : "All attendance"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectGroup>
                <div
                  className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleAttendance('Yes')}
                >
                  <Checkbox
                    checked={localFilters.attendance.includes('Yes')}
                    className="pointer-events-none"
                  />
                  <label className="text-sm cursor-pointer flex-1 text-green-600 dark:text-green-400">
                    Attended
                  </label>
                </div>
                <div
                  className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleAttendance('No')}
                >
                  <Checkbox
                    checked={localFilters.attendance.includes('No')}
                    className="pointer-events-none"
                  />
                  <label className="text-sm cursor-pointer flex-1 text-red-600 dark:text-red-400">
                    No Show
                  </label>
                </div>
                <div
                  className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleAttendance('Unmarked')}
                >
                  <Checkbox
                    checked={localFilters.attendance.includes('Unmarked')}
                    className="pointer-events-none"
                  />
                  <label className="text-sm cursor-pointer flex-1 text-gray-600 dark:text-gray-400">
                    Unmarked
                  </label>
                </div>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Filter 3: Mock Type */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <BookOpen className="h-3 w-3" />
            Mock Type
          </label>
          <Select>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder="Select mock types"
              >
                {localFilters.mockTypes.length > 0
                  ? `${localFilters.mockTypes.length} selected`
                  : "All types"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectGroup>
                {uniqueValues.mockTypes.map(mockType => (
                  <div
                    key={mockType}
                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleMockType(mockType)}
                  >
                    <Checkbox
                      checked={localFilters.mockTypes.includes(mockType)}
                      className="pointer-events-none"
                    />
                    <label className="text-sm cursor-pointer flex-1">
                      {mockType}
                    </label>
                  </div>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Filter 4: Date Range */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Calendar className="h-3 w-3" />
            Exam Date
          </label>
          <div className="flex gap-2">
            <DatePicker
              value={localFilters.dateFrom}
              onChange={(date) => handleFilterChange('dateFrom', date)}
              placeholder="From"
              className="flex-1"
            />
            <DatePicker
              value={localFilters.dateTo}
              onChange={(date) => handleFilterChange('dateTo', date)}
              placeholder="To"
              className="flex-1"
            />
          </div>
        </div>

        {/* Filter 5: Booking Status */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            <CheckCircle className="h-3 w-3" />
            Status
          </label>
          <Select
            value={localFilters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Bookings</SelectItem>
              <SelectItem value="Active">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Active
                </span>
              </SelectItem>
              <SelectItem value="Completed">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Completed
                </span>
              </SelectItem>
              <SelectItem value="Cancelled">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Cancelled
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {localFilters.locations.map(location => (
            <span
              key={`loc-${location}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <MapPin className="h-3 w-3" />
              {location}
              <button
                onClick={() => toggleLocation(location)}
                className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {localFilters.attendance.map(attendance => (
            <span
              key={`att-${attendance}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <Users className="h-3 w-3" />
              {attendance === 'Unmarked' ? 'Unmarked' : attendance === 'Yes' ? 'Attended' : 'No Show'}
              <button
                onClick={() => toggleAttendance(attendance)}
                className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {localFilters.mockTypes.map(mockType => (
            <span
              key={`mock-${mockType}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <BookOpen className="h-3 w-3" />
              {mockType}
              <button
                onClick={() => toggleMockType(mockType)}
                className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {(localFilters.dateFrom || localFilters.dateTo) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <Calendar className="h-3 w-3" />
              {localFilters.dateFrom && new Date(localFilters.dateFrom).toLocaleDateString()}
              {localFilters.dateFrom && localFilters.dateTo && ' - '}
              {localFilters.dateTo && new Date(localFilters.dateTo).toLocaleDateString()}
              <button
                onClick={() => {
                  handleFilterChange('dateFrom', null);
                  handleFilterChange('dateTo', null);
                }}
                className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {localFilters.status !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-3 w-3" />
              {localFilters.status}
              <button
                onClick={() => handleFilterChange('status', 'All')}
                className="ml-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingFilters;