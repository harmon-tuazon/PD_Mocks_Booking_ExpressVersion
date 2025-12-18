/**
 * PrerequisiteManager Component
 *
 * Manages prerequisite exams for Mock Discussion sessions with checkbox UI and delta-based updates.
 * Only renders for Mock Discussion exam types.
 *
 * Features:
 * - Loads current prerequisites on mount using React Query
 * - Shows available CS/SJ exams as checkboxes (before the exam date)
 * - Tracks original state vs current checked state
 * - Calculates delta (added/removed) on save
 * - Uses delta-based API for efficient updates
 * - Shows pending changes indicator
 * - Provides Save and Reset buttons
 *
 * @component
 * @param {Object} props
 * @param {string} props.examId - The Mock Discussion exam HubSpot ID
 * @param {string} props.examType - The exam type (e.g., 'Mock Discussion')
 * @param {string} props.examDate - The exam date in YYYY-MM-DD format
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  CheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { mockExamsApi } from '../../services/adminApi';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTime } from '../../utils/timeFormatters';

const PrerequisiteManager = ({
  examId,
  examType,
  examDate
}) => {
  const queryClient = useQueryClient();

  // Determine if this is a Mock Discussion exam (used for conditional rendering and query enabling)
  const isMockDiscussion = examType === 'Mock Discussion';

  // State for tracking prerequisites
  const [originalPrereqs, setOriginalPrereqs] = useState([]);
  const [checkedPrereqs, setCheckedPrereqs] = useState([]);

  // State for collapsible section
  const [isCollapsed, setIsCollapsed] = useState(false);

  // State for filters
  const [filters, setFilters] = useState({
    dateFrom: '',
    location: '',
    types: {
      'Clinical Skills': true,
      'Situational Judgment': true
    }
  });

  // Fetch current prerequisites for the exam
  const {
    data: currentPrerequisites,
    isLoading: isLoadingPrereqs,
    isError: isPrereqsError,
    error: prereqsError
  } = useQuery({
    queryKey: ['examPrerequisites', examId],
    queryFn: async () => {
      const response = await mockExamsApi.getPrerequisites(examId);
      return response?.data?.prerequisite_exam_ids || response?.data?.prerequisiteExamIds || [];
    },
    enabled: !!examId && isMockDiscussion,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000  // 5 minutes
  });

  // Fetch available prerequisite exams (CS and SJ exams before the exam date)
  const {
    data: availableExams = [],
    isLoading: isLoadingAvailable,
    isError: isAvailableError,
    error: availableError,
    refetch: refetchAvailable
  } = useQuery({
    queryKey: ['availablePrerequisites', examId, examDate],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const params = {
        filter_mock_type: ['Clinical Skills', 'Situational Judgment'],
        filter_status: 'active',
        filter_date_from: today,
        filter_date_to: examDate,
        sort_by: 'exam_date',
        sort_order: 'asc',
        limit: 100
      };
      const response = await mockExamsApi.list(params);
      // Handle different response structures
      if (response?.data && Array.isArray(response.data)) {
        return response.data;
      } else if (Array.isArray(response)) {
        return response;
      }
      return [];
    },
    enabled: !!examDate && isMockDiscussion,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    placeholderData: []
  });

  // Initialize state when current prerequisites load
  useEffect(() => {
    if (currentPrerequisites && Array.isArray(currentPrerequisites)) {
      setOriginalPrereqs(currentPrerequisites);
      setCheckedPrereqs(currentPrerequisites);
    }
  }, [currentPrerequisites]);

  // Calculate delta between original and current state
  const delta = useMemo(() => {
    const added = checkedPrereqs.filter(id => !originalPrereqs.includes(id));
    const removed = originalPrereqs.filter(id => !checkedPrereqs.includes(id));
    return {
      added,
      removed,
      hasChanges: added.length > 0 || removed.length > 0
    };
  }, [checkedPrereqs, originalPrereqs]);

  // Mutation for saving delta updates
  const saveMutation = useMutation({
    mutationFn: async ({ addIds, removeIds }) => {
      return await mockExamsApi.updatePrerequisitesDelta(examId, addIds, removeIds);
    },
    onSuccess: (data) => {
      // Update original state to match saved state
      setOriginalPrereqs([...checkedPrereqs]);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['examPrerequisites', examId] });
      queryClient.invalidateQueries({ queryKey: ['mockExamDetail', examId] });
      queryClient.invalidateQueries({ queryKey: ['mockExam', examId] });
    },
    onError: (error) => {
      console.error('Failed to save prerequisite changes:', error);
    }
  });

  // Handle checkbox toggle
  const handleExamToggle = useCallback((targetExamId, checked) => {
    setCheckedPrereqs(prev => {
      if (checked) {
        return [...prev, targetExamId];
      } else {
        return prev.filter(id => id !== targetExamId);
      }
    });
  }, []);

  // Handle select all visible
  const handleSelectAll = useCallback(() => {
    const filteredIds = filteredExams.map(exam => exam.id);
    setCheckedPrereqs(prev => {
      const newSet = new Set([...prev, ...filteredIds]);
      return Array.from(newSet);
    });
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setCheckedPrereqs([]);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    if (!delta.hasChanges) return;
    saveMutation.mutate({
      addIds: delta.added,
      removeIds: delta.removed
    });
  }, [delta, saveMutation]);

  // Handle reset to original state
  const handleReset = useCallback(() => {
    setCheckedPrereqs([...originalPrereqs]);
  }, [originalPrereqs]);

  // Toggle collapse state
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

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
    let filtered = availableExams.filter(exam => {
      // Exclude the current Mock Discussion exam itself
      if (exam.id === examId) return false;
      return true;
    });

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

      // Date filter (from date only)
      if (filters.dateFrom) {
        const examDateStr = props.exam_date;
        if (examDateStr) {
          const examDateObj = new Date(examDateStr);
          const fromDate = new Date(filters.dateFrom);
          if (examDateObj < fromDate) return false;
        }
      }

      return true;
    });

    return filtered;
  }, [availableExams, examId, filters]);

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
    const props = exam.properties || exam;
    const mockType = props.mock_type || 'Unknown';
    const location = props.location || 'N/A';
    const examDateStr = props.exam_date;
    const startTime = props.start_time;
    const endTime = props.end_time;

    return {
      mockType,
      location,
      examDate: examDateStr ? formatDateLong(examDateStr) : 'Date TBD',
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
  const EmptyState = ({ message }) => (
    <div className="text-center py-8 px-4">
      <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );

  // Error state component
  const ErrorState = ({ onRetry }) => (
    <div className="text-center py-8 px-4">
      <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-400" />
      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
        Failed to load available exams
      </p>
      <button
        onClick={onRetry}
        className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Try again
      </button>
    </div>
  );

  // Only render for Mock Discussion exam types
  if (!isMockDiscussion) {
    return null;
  }

  // Check if exam date is not set
  if (!examDate) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <EmptyState message="Set the exam date first to see available prerequisites" />
      </div>
    );
  }

  const isLoading = isLoadingPrereqs || isLoadingAvailable;
  const isError = isPrereqsError || isAvailableError;
  const isSaving = saveMutation.isPending;
  const disabled = isSaving;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Collapsible Header */}
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
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Prerequisite Exams (Optional)
          </span>
          {checkedPrereqs.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs py-0.5 px-1.5">
              {checkedPrereqs.length} selected
            </Badge>
          )}
          {delta.hasChanges && (
            <Badge variant="warning" className="ml-1 text-xs py-0.5 px-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              Unsaved changes
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
          {/* Filters Section */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* From Date Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  From Date
                </label>
                <DatePicker
                  value={filters.dateFrom}
                  onChange={(date) => updateFilter('dateFrom', date)}
                  placeholder="Select from date"
                  disabled={disabled || isLoading}
                  className="h-8 text-sm"
                />
              </div>

              {/* Location Filter */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Location
                </label>
                <select
                  value={filters.location}
                  onChange={(e) => updateFilter('location', e.target.value)}
                  disabled={disabled || isLoading || uniqueLocations.length === 0}
                  className="w-full h-8 text-sm px-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                <div className="flex items-center gap-4 h-8">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={filters.types['Clinical Skills']}
                      onCheckedChange={(checked) => updateTypeFilter('Clinical Skills', checked)}
                      disabled={disabled || isLoading}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">Clinical Skills</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
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

          {/* Selection Actions */}
          {!isLoading && !isError && filteredExams.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {checkedPrereqs.length} of {filteredExams.length} exams selected
              </div>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  disabled={disabled}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  Select All Visible
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={disabled || checkedPrereqs.length === 0}
                  className="text-xs text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Exam List */}
          <ScrollArea className="h-[250px]">
            <div className="p-3 space-y-2">
              {isLoading && <LoadingSkeleton />}

              {isError && <ErrorState onRetry={() => refetchAvailable()} />}

              {!isLoading && !isError && filteredExams.length === 0 && (
                <EmptyState
                  message="No exams match your filters. Adjust the filters or create Clinical Skills or Situational Judgment exams scheduled before this discussion date."
                />
              )}

              {!isLoading && !isError && filteredExams.map(exam => {
                const display = formatExamDisplay(exam);
                const isChecked = checkedPrereqs.includes(exam.id);

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
                    <div className="pt-0.5">
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
                      {/* Type Badge */}
                      <div className="mb-1.5">
                        <Badge variant={getMockTypeVariant(display.mockType)} className="text-xs">
                          {display.mockType}
                        </Badge>
                      </div>

                      {/* All details on one line */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        {/* Location */}
                        <div className="flex items-center gap-1">
                          <MapPinIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{display.location}</span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{display.examDate}</span>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{display.timeRange}</span>
                        </div>

                        {/* Booking Info */}
                        {display.bookingInfo && (
                          <span className="text-gray-500 dark:text-gray-400">
                            ({display.bookingInfo})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer with Save/Reset Actions */}
          <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              {/* Changes Summary */}
              <div className="flex items-center gap-2">
                {delta.hasChanges ? (
                  <>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Changes:
                    </span>
                    {delta.added.length > 0 && (
                      <Badge variant="success" className="text-xs py-0 px-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        +{delta.added.length} added
                      </Badge>
                    )}
                    {delta.removed.length > 0 && (
                      <Badge variant="destructive" className="text-xs py-0 px-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        -{delta.removed.length} removed
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {checkedPrereqs.length > 0
                      ? `${checkedPrereqs.length} prerequisite${checkedPrereqs.length !== 1 ? 's' : ''} configured`
                      : 'No prerequisites selected'
                    }
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {delta.hasChanges && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    disabled={isSaving}
                    className="text-xs h-7 px-2"
                  >
                    <ArrowPathIcon className="h-3.5 w-3.5 mr-1" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={!delta.hasChanges || isSaving}
                  className="text-xs h-7 px-3"
                >
                  {isSaving ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-3.5 w-3.5 mr-1" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Success/Error Messages */}
            {saveMutation.isSuccess && (
              <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                Prerequisites saved successfully
              </div>
            )}
            {saveMutation.isError && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                Failed to save: {saveMutation.error?.message || 'Unknown error'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PrerequisiteManager;
