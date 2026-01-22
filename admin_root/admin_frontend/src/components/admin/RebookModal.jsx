/**
 * RebookModal Component
 * Single-select modal for rebooking a booking to a different exam session
 *
 * UI Pattern: Based on PrerequisiteExamSelector (single-select variant)
 * Uses Headless UI Dialog for modal implementation
 *
 * Location and mock_type are automatically filtered based on original booking
 * (no user selection needed - exams shown are same type and location)
 */

import React, { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAvailableExamsForRebook } from '../../hooks/useRebooking';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTime } from '../../utils/timeFormatters';

const RebookModal = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isSubmitting = false
}) => {
  // Selected exam state (single selection)
  const [selectedExamId, setSelectedExamId] = useState(null);

  // Date filter state (only filter needed - location/type come from booking)
  const [dateFrom, setDateFrom] = useState('');

  // Get booking info - these are used to filter exams automatically
  const mockType = booking?.mock_exam_type || booking?.mock_type;
  const currentExamId = booking?.associated_mock_exam;
  const currentLocation = booking?.attending_location || booking?.location;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedExamId(null);
      setDateFrom('');
    }
  }, [isOpen]);

  // Fetch exams filtered by booking's mock_type and location (automatic)
  const {
    data: examData,
    isLoading,
    isError
  } = useAvailableExamsForRebook(mockType, currentLocation, currentExamId, isOpen && !!mockType && !!currentLocation);

  // Extract exams from API response
  const availableExams = examData?.exams || [];

  // Apply date filter client-side (mock_type and location already filtered server-side)
  const filteredExams = useMemo(() => {
    return availableExams.filter(exam => {
      // Date filter (applied client-side)
      if (dateFrom) {
        const examDate = new Date(exam.exam_date);
        const fromDate = new Date(dateFrom);
        if (examDate < fromDate) return false;
      }
      return true;
    });
  }, [availableExams, dateFrom]);

  // Handle exam selection (single select - toggle)
  const handleExamSelect = useCallback((examId) => {
    setSelectedExamId(prev => prev === examId ? null : examId);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedExamId) {
      onConfirm(selectedExamId);
    }
  }, [selectedExamId, onConfirm]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  // Get mock type badge variant
  const getMockTypeVariant = (type) => {
    switch (type) {
      case 'Clinical Skills': return 'success';
      case 'Situational Judgment': return 'info';
      case 'Mini-mock': return 'warning';
      case 'Mock Discussion': return 'purple';
      default: return 'default';
    }
  };

  if (!booking) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
        </Transition.Child>

        {/* Full-screen container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                      >
                        Rebook Booking
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Select a new exam session for {booking.name || booking.student_id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Current Booking Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Current Booking
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={getMockTypeVariant(mockType)}>{mockType}</Badge>
                    <span className="text-gray-600 dark:text-gray-300">
                      {formatDateLong(booking.exam_date)} at {formatTime(booking.start_time)}
                    </span>
                    {currentLocation && (
                      <span className="text-gray-500 dark:text-gray-400">
                        - {currentLocation}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date Filter Only */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                    Filter by Date (Optional)
                  </label>
                  <DatePicker
                    value={dateFrom}
                    onChange={setDateFrom}
                    placeholder="Show exams from this date"
                    disabled={isLoading || isSubmitting}
                    className="h-8 text-sm max-w-xs"
                  />
                </div>

                {/* Available Exams List */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Available {mockType} Sessions in {currentLocation} ({filteredExams.length})
                    </p>
                  </div>

                  <ScrollArea className="h-[250px]">
                    <div className="p-2 space-y-1">
                      {/* Loading state */}
                      {isLoading && (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            Loading available exams...
                          </span>
                        </div>
                      )}

                      {/* Error state */}
                      {isError && (
                        <div className="text-center py-8">
                          <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-red-400" />
                          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                            Failed to load available exams
                          </p>
                        </div>
                      )}

                      {/* Empty state */}
                      {!isLoading && !isError && filteredExams.length === 0 && (
                        <div className="text-center py-8">
                          <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            No available {mockType} sessions found in {currentLocation}
                          </p>
                        </div>
                      )}

                      {/* Exam list */}
                      {!isLoading && !isError && filteredExams.map(exam => {
                        const isSelected = selectedExamId === exam.hubspot_id;
                        const availableSlots = Math.max(0, (exam.capacity || 0) - (exam.total_bookings || 0));

                        return (
                          <div
                            key={exam.hubspot_id}
                            className={`
                              flex items-center p-2 rounded-lg border cursor-pointer transition-colors
                              ${isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                              ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}
                            `}
                            onClick={() => !isSubmitting && handleExamSelect(exam.hubspot_id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (!isSubmitting && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                handleExamSelect(exam.hubspot_id);
                              }
                            }}
                          >
                            {/* Radio-style indicator */}
                            <div className="mr-3">
                              <div className={`
                                w-4 h-4 rounded-full border-2 flex items-center justify-center
                                ${isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300 dark:border-gray-600'}
                              `}>
                                {isSelected && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>

                            {/* Exam Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                {/* Date */}
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  <span>{formatDateLong(exam.exam_date)}</span>
                                </div>
                                {/* Time */}
                                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                  <ClockIcon className="h-3.5 w-3.5" />
                                  <span>{formatTime(exam.start_time)} - {formatTime(exam.end_time)}</span>
                                </div>
                                {/* Capacity */}
                                <span className={`text-xs ${availableSlots <= 3 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                  ({exam.total_bookings || 0}/{exam.capacity || 0} booked)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Warning */}
                {selectedExamId && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mt-4 border border-amber-200 dark:border-amber-800">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This will update the booking to the selected exam session. No tokens will be refunded or deducted.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!selectedExamId || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Rebooking...
                      </>
                    ) : (
                      'Confirm Rebooking'
                    )}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default RebookModal;
