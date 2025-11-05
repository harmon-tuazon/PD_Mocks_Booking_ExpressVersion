/**
 * PrerequisiteExamSelector Component
 * Multi-select checklist interface for selecting prerequisite exams
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { usePrerequisiteExams, filterPrerequisiteExams } from '../../hooks/usePrerequisiteExams';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTime } from '../../utils/timeFormatters';

const const PrerequisiteExamSelector = ({
  mockExamId,
  discussionExamDate,
  currentAssociations = [],
  onChange,
  disabled = false,
  className = ''
}) => {
  // State for selected exam IDs
  const [selectedIds, setSelectedIds] = useState(currentAssociations);

  // State for collapsible section
  const [isCollapsed, setIsCollapsed] = useState(false);

  // State for filters
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    location: '',
    types: {
      'Clinical Skills': true,
      'Situational Judgment': true
    }
  });

  // Fetch available prerequisite exams
  const {
    data: availableExams = [],
    isLoading,
    isError,
    error,
    refetch
  } = usePrerequisiteExams(mockExamId, discussionExamDate);

  // Sync selected IDs with current associations when they change
  useEffect(() => {
    setSelectedIds(currentAssociations);
  }, [currentAssociations]);

  // Extract unique locations from available exams
  const uniqueLocations = useMemo(() => {
    const locations = new Set();
    availableExams.forEach(exam => {
      const props = exam.properties || exam;
      if (props.location && props.location !== 'N/A') {
        locations.add(props.location);
      }
    });
    return Array.from(locations).sort();
  }, [availableExams]);

  // Filter exams based on all filters
  const filteredExams = useMemo(() => {
    let filtered = filterPrerequisiteExams(
      availableExams,
      mockExamId,
      [], // Don't exclude already associated - show them as checked
      '' // No search term anymore
    );

    // Apply additional filters
    filtered = filtered.filter(exam => {
      const props = exam.properties || exam;

      // Type filter
      const mockType = props.mock_type || 'Unknown';
      if (!filters.types[mockType]) {
        return false;
      }

      // Location filter
      if (filters.location && props.location !== filters.location) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const examDate = props.exam_date;
        if (examDate) {
          const examDateObj = new Date(examDate);

          if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            if (examDateObj < fromDate) return false;
          }

          if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999); // Include entire day
            if (examDateObj > toDate) return false;
          }
        }
      }

      return true;
    });

    return filtered;
  }, [availableExams, mockExamId, filters]);

  // Handle checkbox toggle
  const handleExamToggle = useCallback((examId, checked) => {
    const newSelectedIds = checked
      ? [...selectedIds, examId]
      : selectedIds.filter(id => id !== examId);

    setSelectedIds(newSelectedIds);
    onChange(newSelectedIds);
  }, [selectedIds, onChange]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allIds = filteredExams.map(exam => exam.id);
    setSelectedIds(allIds);
    onChange(allIds);
  }, [filteredExams, onChange]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setSelectedIds([]);
    onChange([]);
  }, [onChange]);

  // Toggle collapse state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  // Update filter
  const updateFilter = useCallback((filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  }, []);

  // Update type filter
  const updateTypeFilter = useCallback((type, checked) => {
    setFilters(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: checked
      }
    }));
  }, []);

  // Get mock type badge variant
  const getMockTypeVariant = (type) => {
    switch (type) {
      case 'Clinical Skills':
        return 'success';
      case 'Situational Judgment':
        return 'info';
      default:
        return 'default';
    }
  };

  // Format exam display text
  const formatExamDisplay = (exam) => {
    // Handle both direct properties and nested properties structure
    const props = exam.properties || exam;
    const mockType = props.mock_type || 'Unknown';
    const location = props.location || 'N/A';
    const examDate = props.exam_date;
    const startTime = props.start_time;
    const endTime = props.end_time;

    return {
      mockType,
      location,
      examDate: examDate ? formatDateLong(examDate) : 'Date TBD',
      timeRange: startTime && endTime
        ? `${formatTime(startTime)} - ${formatTime(endTime)}`
        : 'Time TBD',
      bookingInfo: props.total_bookings !== undefined && props.capacity
        ? `${props.total_bookings}/${props.capacity} booked`
        : null
    };
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-2 p-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      ))}
    </div>
  );

  // Empty state component
  const EmptyState = ({ message, actionText, onAction }) => (
    <div className="text-center py-8 px-4">
      <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {actionText}
        </button>
      )}
    </div>
  );

  // Error state component
  const ErrorState = () => (
    <div className="text-center py-8 px-4">
      <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-400" />
      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
        Failed to load available exams
      </p>
      <button
        onClick={() => refetch()}
        className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Try again
      </button>
    </div>
  );

  // Check if discussion date is not set
  if (!discussionExamDate) {
    return (
      <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
        <EmptyState
          message="Set the exam date first to see available prerequisites"
        />
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Collapsible Header - always visible - COMPACT */}
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={toggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse();
          }
        }}
        aria-expanded={!isCollapsed}
        aria-label="Toggle prerequisite exams section"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Prerequisite Exams (Optional)
          </span>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs py-0.5 px-1.5">
              {selectedIds.length} selected
            </Badge>
          )}
        </div>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
            isCollapsed ? '' : 'rotate-180'
          }`}
        />
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* Filters Section - COMPACT */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="space-y-2">
              {/* Date Range Filter - COMPACT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    disabled={disabled || isLoading}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    disabled={disabled || isLoading}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Location and Type Filters - COMPACT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Location Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Location
                  </label>
                  <select
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                    disabled={disabled || isLoading || uniqueLocations.length === 0}
                    className="w-full h-8 text-sm px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">All Locations</option>
                    {uniqueLocations.map(location => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filters */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Exam Types
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.types['Clinical Skills']}
                        onCheckedChange={(checked) => updateTypeFilter('Clinical Skills', checked)}
                        disabled={disabled || isLoading}
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Clinical</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.types['Situational Judgment']}
                        onCheckedChange={(checked) => updateTypeFilter('Situational Judgment', checked)}
                        disabled={disabled || isLoading}
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Situational</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selection Actions */}
          {!isLoading && !isError && filteredExams.length > 0 && (
            <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {selectedIds.length} of {filteredExams.length} selected
              </div>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  disabled={disabled}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={disabled || selectedIds.length === 0}
                  className="text-xs text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Exam List - REDUCED HEIGHT */}
          <ScrollArea className="h-[250px]">
            <div className="p-2 space-y-1.5">
              {isLoading && <LoadingSkeleton />}

              {isError && <ErrorState />}

              {!isLoading && !isError && filteredExams.length === 0 && (
                <EmptyState
                  message="No exams match your filters. Adjust the filters or create Clinical Skills or Situational Judgment exams scheduled before this discussion date."
                />
              )}

              {!isLoading && !isError && filteredExams.map(exam => {
                const display = formatExamDisplay(exam);
                const isChecked = selectedIds.includes(exam.id);

                return (
                  <div
                    key={exam.id}
                    className={`
                      flex items-start space-x-3 p-2 rounded-lg border
                      ${isChecked
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
                      ${disabled ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                      transition-colors cursor-pointer
                    `}
                    onClick={() => !disabled && handleExamToggle(exam.id, !isChecked)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleExamToggle(exam.id, !isChecked);
                      }
                    }}
                    aria-label={`Select ${display.mockType} exam on ${display.examDate}`}
                  >
                    {/* Checkbox */}
                    <div className="pt-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleExamToggle(exam.id, checked)}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select exam ${exam.id}`}
                      />
                    </div>

                    {/* Exam Details - COMPACT */}
                    <div className="flex-1 min-w-0">
                      {/* Type Badge and Location */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant={getMockTypeVariant(display.mockType)} className="text-xs py-0.5 px-1.5">
                          {display.mockType}
                        </Badge>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          <MapPinIcon className="inline h-3.5 w-3.5 mr-1" />
                          {display.location}
                        </span>
                      </div>

                      {/* Date and Time */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{display.examDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{display.timeRange}</span>
                        </div>
                      </div>

                      {/* Booking Info */}
                      {display.bookingInfo && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {display.bookingInfo}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer with selection count - COMPACT */}
          {!isLoading && !isError && selectedIds.length > 0 && (
            <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {selectedIds.length} exam{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
  );

  // Empty state component
  const EmptyState = ({ message, actionText, onAction }) => (
    <div className="text-center py-8 px-4">
      <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {actionText}
        </button>
      )}
    </div>
  );

  // Error state component
  const ErrorState = () => (
    <div className="text-center py-8 px-4">
      <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-400" />
      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
        Failed to load available exams
      </p>
      <button
        onClick={() => refetch()}
        className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Try again
      </button>
    </div>
  );

  // Check if discussion date is not set
  if (!discussionExamDate) {
    return (
      <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
        <EmptyState
          message="Set the exam date first to see available prerequisites"
        />
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Collapsible Header - always visible */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={toggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse();
          }
        }}
        aria-expanded={!isCollapsed}
        aria-label="Toggle prerequisite exams section"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Prerequisite Exams (Optional)
          </span>
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedIds.length} selected
            </Badge>
          )}
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
            isCollapsed ? '' : 'rotate-180'
          }`}
        />
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <>
          {/* Filters Section */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="space-y-3">
              {/* Date Range Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    disabled={disabled || isLoading}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    disabled={disabled || isLoading}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Location and Type Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Location Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Location
                  </label>
                  <select
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                    disabled={disabled || isLoading || uniqueLocations.length === 0}
                    className="w-full h-8 text-sm px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">All Locations</option>
                    {uniqueLocations.map(location => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filters */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Exam Types
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.types['Clinical Skills']}
                        onCheckedChange={(checked) => updateTypeFilter('Clinical Skills', checked)}
                        disabled={disabled || isLoading}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Clinical</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.types['Situational Judgment']}
                        onCheckedChange={(checked) => updateTypeFilter('Situational Judgment', checked)}
                        disabled={disabled || isLoading}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Situational</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selection Actions */}
          {!isLoading && !isError && filteredExams.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.length} of {filteredExams.length} selected
              </div>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  disabled={disabled}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={disabled || selectedIds.length === 0}
                  className="text-xs text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Exam List */}
          <ScrollArea className="h-[400px]">
            <div className="p-3 space-y-2">
              {isLoading && <LoadingSkeleton />}

              {isError && <ErrorState />}

              {!isLoading && !isError && filteredExams.length === 0 && (
                <EmptyState
                  message="No exams match your filters. Adjust the filters or create Clinical Skills or Situational Judgment exams scheduled before this discussion date."
                />
              )}

              {!isLoading && !isError && filteredExams.map(exam => {
                const display = formatExamDisplay(exam);
                const isChecked = selectedIds.includes(exam.id);

                return (
                  <div
                    key={exam.id}
                    className={`
                      flex items-start space-x-3 p-3 rounded-lg border
                      ${isChecked
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
                      ${disabled ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                      transition-colors cursor-pointer
                    `}
                    onClick={() => !disabled && handleExamToggle(exam.id, !isChecked)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleExamToggle(exam.id, !isChecked);
                      }
                    }}
                    aria-label={`Select ${display.mockType} exam on ${display.examDate}`}
                  >
                    {/* Checkbox */}
                    <div className="pt-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleExamToggle(exam.id, checked)}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select exam ${exam.id}`}
                      />
                    </div>

                    {/* Exam Details */}
                    <div className="flex-1 min-w-0">
                      {/* Type Badge and Location */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getMockTypeVariant(display.mockType)}>
                          {display.mockType}
                        </Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          <MapPinIcon className="inline h-3.5 w-3.5 mr-1" />
                          {display.location}
                        </span>
                      </div>

                      {/* Date and Time */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          <span>{display.examDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <span>{display.timeRange}</span>
                        </div>
                      </div>

                      {/* Booking Info */}
                      {display.bookingInfo && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {display.bookingInfo}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer with selection count */}
          {!isLoading && !isError && selectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedIds.length} exam{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PrerequisiteExamSelector;