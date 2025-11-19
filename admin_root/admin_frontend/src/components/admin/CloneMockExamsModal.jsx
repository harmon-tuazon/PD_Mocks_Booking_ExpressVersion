import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentDuplicateIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import useCloneSessions from '../../hooks/useCloneSessions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Label } from '@/components/ui/label';
import { convertTorontoToUTC } from '../../utils/dateTimeUtils';

// Valid options for form selects
const LOCATIONS = [
  'Mississauga',
  'Mississauga - B9',
  'Mississauga - Lab D',
  'Calgary',
  'Vancouver',
  'Montreal',
  'Richmond Hill',
  'Online'
];

const MOCK_TYPES = [
  'Situational Judgment',
  'Clinical Skills',
  'Mini-mock',
  'Mock Discussion'
];

const ACTIVE_STATES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' }
];

// Special value for "Keep original" - can't use empty string with shadcn Select
const KEEP_ORIGINAL = '__KEEP_ORIGINAL__';

/**
 * Modal for cloning mock exam sessions
 *
 * Features:
 * - Pre-populates form for single session selection (date +7 days)
 * - Shows blank form for multiple session selection
 * - Required field: exam_date (must differ from source)
 * - Optional fields: location, mock_type, capacity, times, status
 * - Empty fields use source session values
 * - Populated fields override source values for ALL clones
 * - NO confirmation input required (simpler UX than bulk edit/delete)
 * - Session preview table
 */
const CloneMockExamsModal = ({
  isOpen,
  onClose,
  selectedSessions,
  onSuccess
}) => {
  // Form state
  const [formData, setFormData] = useState({
    exam_date: '',
    location: KEEP_ORIGINAL,
    mock_type: KEEP_ORIGINAL,
    capacity: '',
    start_time: '',
    end_time: '',
    is_active: KEEP_ORIGINAL,
    scheduled_activation_datetime: ''
  });
  const [validationErrors, setValidationErrors] = useState({});

  const cloneMutation = useCloneSessions();

  // Pre-populate form when single session selected
  useEffect(() => {
    if (!isOpen) return;

    if (selectedSessions.length === 1) {
      const source = selectedSessions[0];
      const sourceDate = new Date(source.exam_date);
      sourceDate.setDate(sourceDate.getDate() + 7); // Default to +7 days

      setFormData({
        exam_date: sourceDate.toISOString().split('T')[0],
        location: source.location || KEEP_ORIGINAL,
        mock_type: source.mock_type || KEEP_ORIGINAL,
        capacity: source.capacity || '',
        start_time: source.start_time || '',
        end_time: source.end_time || '',
        is_active: source.is_active || KEEP_ORIGINAL,
        scheduled_activation_datetime: source.scheduled_activation_datetime || ''
      });
    } else {
      // Multiple sessions - start with blank form
      setFormData({
        exam_date: '',
        location: KEEP_ORIGINAL,
        mock_type: KEEP_ORIGINAL,
        capacity: '',
        start_time: '',
        end_time: '',
        is_active: KEEP_ORIGINAL,
        scheduled_activation_datetime: ''
      });
    }

    setValidationErrors({});
  }, [isOpen, selectedSessions]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !cloneMutation.isPending) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, cloneMutation.isPending, onClose]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Clear scheduled_activation_datetime if changing away from scheduled
    if (field === 'is_active' && value !== 'scheduled') {
      setFormData(prev => ({
        ...prev,
        scheduled_activation_datetime: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Date is required
    if (!formData.exam_date) {
      errors.exam_date = 'New exam date is required for cloning';
    }

    // Date must be different from all source sessions
    if (formData.exam_date) {
      const sameDate = selectedSessions.some(s => s.exam_date === formData.exam_date);
      if (sameDate) {
        errors.exam_date = 'New date must be different from original date(s)';
      }
    }

    // Validate time range if both provided
    if (formData.start_time && formData.end_time) {
      const start = new Date(`2000-01-01T${formData.start_time}`);
      const end = new Date(`2000-01-01T${formData.end_time}`);
      if (start >= end) {
        errors.start_time = 'Start time must be before end time';
      }
    }

    // If status is scheduled, datetime is required
    if (formData.is_active === 'scheduled' && !formData.scheduled_activation_datetime) {
      errors.scheduled_activation_datetime = 'Scheduled activation datetime is required when status is scheduled';
    }

    // Capacity must be positive if provided
    if (formData.capacity && parseInt(formData.capacity) <= 0) {
      errors.capacity = 'Capacity must be a positive number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle confirm button click
  const handleConfirm = async () => {
    if (cloneMutation.isPending) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Prepare overrides object (only non-empty fields)
    const overrides = {
      exam_date: formData.exam_date // Always required
    };

    // Convert KEEP_ORIGINAL back to empty string, or use the actual value
    if (formData.location && formData.location !== KEEP_ORIGINAL) {
      overrides.location = formData.location;
    }
    if (formData.mock_type && formData.mock_type !== KEEP_ORIGINAL) {
      overrides.mock_type = formData.mock_type;
    }
    if (formData.capacity) overrides.capacity = parseInt(formData.capacity);
    if (formData.start_time) overrides.start_time = formData.start_time;
    if (formData.end_time) overrides.end_time = formData.end_time;
    if (formData.is_active && formData.is_active !== KEEP_ORIGINAL) {
      overrides.is_active = formData.is_active;
    }

    // IMPORTANT: Convert Toronto time to UTC for scheduled activation
    if (formData.scheduled_activation_datetime) {
      overrides.scheduled_activation_datetime = convertTorontoToUTC(formData.scheduled_activation_datetime);
    }

    try {
      await cloneMutation.mutateAsync({ selectedSessions, overrides });

      // Close modal on success
      onClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Clone operation failed:', error);
    }
  };

  // Get preview sessions (first 10)
  const previewSessions = useMemo(() => {
    return selectedSessions.slice(0, 10);
  }, [selectedSessions]);

  const remainingCount = selectedSessions.length - previewSessions.length;

  // Helper function to get status display
  const getStatusDisplay = (session) => {
    if (session.is_active === 'true' || session.is_active === 'active') return 'Active';
    if (session.is_active === 'scheduled') return 'Scheduled';
    return 'Inactive';
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={cloneMutation.isPending ? () => {} : onClose}
      >
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
          <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6 max-h-[90vh] flex flex-col">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={cloneMutation.isPending}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="overflow-y-auto flex-1">
                  <div className="sm:flex sm:items-start">
                    {/* Icon */}
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                      <DocumentDuplicateIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100">
                        Clone {selectedSessions.length} Session{selectedSessions.length !== 1 ? 's' : ''}
                      </Dialog.Title>

                      <div className="mt-4 space-y-6">
                        {/* Info Banner */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-blue-800 dark:text-blue-300">
                                {selectedSessions.length === 1 ? (
                                  <>Form pre-populated with source session values. Change any field to override.</>
                                ) : (
                                  <>Empty fields will use each source session's original value. Fill fields to override for all clones.</>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Section: Basic Information */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            Basic Information
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                          {/* Exam Date - Required */}
                          <div className="sm:col-span-2">
                            <Label htmlFor="exam_date" className="text-gray-700 dark:text-gray-300">
                              New Exam Date <span className="text-red-500">*</span>
                            </Label>
                            <DatePicker
                              value={formData.exam_date}
                              onChange={(value) => handleFieldChange('exam_date', value)}
                              placeholder="Select new date"
                              required
                              disabled={cloneMutation.isPending}
                              className="mt-1"
                            />
                            {validationErrors.exam_date && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                                <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                                {validationErrors.exam_date}
                              </p>
                            )}
                          </div>

                          {/* Location */}
                          <div>
                            <Label htmlFor="location" className="text-gray-700 dark:text-gray-300">
                              Location (optional)
                            </Label>
                            <Select
                              value={formData.location}
                              onValueChange={(value) => handleFieldChange('location', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {LOCATIONS.map(loc => (
                                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Mock Type */}
                          <div>
                            <Label htmlFor="mock_type" className="text-gray-700 dark:text-gray-300">
                              Mock Type (optional)
                            </Label>
                            <Select
                              value={formData.mock_type}
                              onValueChange={(value) => handleFieldChange('mock_type', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {MOCK_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Capacity */}
                          <div>
                            <Label htmlFor="capacity" className="text-gray-700 dark:text-gray-300">
                              Capacity (optional)
                            </Label>
                            <Input
                              type="number"
                              id="capacity"
                              min="1"
                              max="100"
                              value={formData.capacity}
                              onChange={(e) => handleFieldChange('capacity', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1"
                              disabled={cloneMutation.isPending}
                            />
                            {validationErrors.capacity && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.capacity}
                              </p>
                            )}
                          </div>

                          {/* Start Time */}
                          <div>
                            <Label htmlFor="start_time" className="text-gray-700 dark:text-gray-300">
                              Start Time (optional)
                            </Label>
                            <Input
                              type="time"
                              id="start_time"
                              value={formData.start_time}
                              onChange={(e) => handleFieldChange('start_time', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1"
                              disabled={cloneMutation.isPending}
                            />
                            {validationErrors.start_time && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.start_time}
                              </p>
                            )}
                          </div>

                          {/* End Time */}
                          <div>
                            <Label htmlFor="end_time" className="text-gray-700 dark:text-gray-300">
                              End Time (optional)
                            </Label>
                            <Input
                              type="time"
                              id="end_time"
                              value={formData.end_time}
                              onChange={(e) => handleFieldChange('end_time', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1"
                              disabled={cloneMutation.isPending}
                            />
                          </div>

                          {/* Status */}
                          <div className="sm:col-span-2">
                            <Label htmlFor="is_active" className="text-gray-700 dark:text-gray-300">
                              Status (optional)
                            </Label>
                            <Select
                              value={formData.is_active}
                              onValueChange={(value) => handleFieldChange('is_active', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {ACTIVE_STATES.map(state => (
                                  <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Scheduled Activation DateTime - Conditional */}
                          {formData.is_active === 'scheduled' && (
                            <div className="sm:col-span-2">
                              <Label htmlFor="scheduled_activation_datetime" className="text-gray-700 dark:text-gray-300">
                                Scheduled Activation <span className="text-red-500">*</span>
                              </Label>
                              <DateTimePicker
                                id="scheduled_activation_datetime"
                                value={formData.scheduled_activation_datetime || ''}
                                onChange={(value) => handleFieldChange('scheduled_activation_datetime', value)}
                                placeholder="Select activation date and time"
                                className="mt-1 w-full"
                                disabled={cloneMutation.isPending}
                                minDateTime={new Date().toISOString().slice(0, 16)}
                              />
                              {validationErrors.scheduled_activation_datetime && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                                  {validationErrors.scheduled_activation_datetime}
                                </p>
                              )}
                            </div>
                          )}
                          </div>
                        </div>

                        {/* Session Preview Table */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                            Selected Sessions ({selectedSessions.length})
                          </h4>
                          <div className="mt-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Capacity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {previewSessions.map((session) => (
                                  <tr key={session.id}>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{session.mock_type}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{session.exam_date}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{session.location}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{session.capacity}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{getStatusDisplay(session)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {remainingCount > 0 && (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              ...and {remainingCount} more session{remainingCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Fixed at bottom */}
                <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 mt-6 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6">
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  {/* Clone Button */}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!formData.exam_date || cloneMutation.isPending}
                    className={`inline-flex w-full justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm sm:w-auto ${
                      !formData.exam_date || cloneMutation.isPending
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                        : 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                    }`}
                  >
                    {cloneMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Cloning {selectedSessions.length} session{selectedSessions.length !== 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>Clone {selectedSessions.length} Session{selectedSessions.length !== 1 ? 's' : ''}</>
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={cloneMutation.isPending}
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default CloneMockExamsModal;
