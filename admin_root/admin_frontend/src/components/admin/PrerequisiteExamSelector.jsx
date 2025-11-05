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
  MagnifyingGlassIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { usePrerequisiteExams, filterPrerequisiteExams } from '../../hooks/usePrerequisiteExams';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTime } from '../../utils/timeFormatters';

const PrerequisiteExamSelector = ({
  mockExamId,
  discussionExamDate,
  currentAssociations = [],
  onChange,
  disabled = false,
  className = ''
}) => {
  // State for selected exam IDs
  const [selectedIds, setSelectedIds] = useState(currentAssociations);

  // State for search
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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

  // Filter exams based on search and exclusions
  const filteredExams = useMemo(() => {
    return filterPrerequisiteExams(
      availableExams,
      mockExamId,
      [], // Don't exclude already associated - show them as checked
      debouncedSearchTerm
    );
  }, [availableExams, mockExamId, debouncedSearchTerm]);

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
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled || isLoading}
            className="pl-9 pr-3"
          />
        </div>
      </div>

      {/* Selection Actions */}
      {!isLoading && !isError && filteredExams.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
              message={
                debouncedSearchTerm
                  ? "No exams match your search"
                  : "No eligible prerequisite exams found. Create Clinical Skills or Situational Judgment exams scheduled before this discussion date."
              }
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
    </div>
  );
};

export default PrerequisiteExamSelector;