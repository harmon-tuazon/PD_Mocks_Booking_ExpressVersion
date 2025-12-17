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
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Label } from '@/components/ui/label';
import { convertTorontoToUTC } from '../../utils/dateTimeUtils';
import {
  LOCATIONS,
  MOCK_TYPES,
  EXAM_STATUS_OPTIONS,
  MOCK_SET_OPTIONS,
  MOCK_SET_APPLICABLE_TYPES
} from '../../constants/examConstants';

// Map EXAM_STATUS_OPTIONS to the format expected by the clone modal
// Clone modal uses 'active'/'inactive' while constants use 'true'/'false'
const ACTIVE_STATES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' }
];

// Capacity options (1-100)
const CAPACITY_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);

// Time options (00:00 to 23:30 in 30-minute increments)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
});

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
    mock_set: KEEP_ORIGINAL,
    capacity: KEEP_ORIGINAL,
    start_time: KEEP_ORIGINAL,
    end_time: KEEP_ORIGINAL,
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

      // Calculate default new date (+7 days from source)
      let newExamDate = '';
      if (source.exam_date) {
        try {
          const sourceDate = new Date(source.exam_date);
          if (!isNaN(sourceDate.getTime())) {
            sourceDate.setDate(sourceDate.getDate() + 7); // Default to +7 days
            newExamDate = sourceDate.toISOString().split('T')[0];
          }
        } catch (error) {
          console.error('[CloneModal] Error calculating new exam date:', error);
          // Fallback to empty - user must select date
          newExamDate = '';
        }
      }

      setFormData({
        exam_date: newExamDate,
        location: source.location || KEEP_ORIGINAL,
        mock_type: source.mock_type || KEEP_ORIGINAL,
        mock_set: KEEP_ORIGINAL, // Use sentinel value instead of empty string
        capacity: KEEP_ORIGINAL, // Use sentinel value instead of empty string
        start_time: KEEP_ORIGINAL, // Use sentinel value instead of empty string
        end_time: KEEP_ORIGINAL, // Use sentinel value instead of empty string
        is_active: KEEP_ORIGINAL, // Use sentinel value instead of empty string
        scheduled_activation_datetime: source.scheduled_activation_datetime || ''
      });
    } else {
      // Multiple sessions - start with blank form
      setFormData({
        exam_date: '',
        location: KEEP_ORIGINAL,
        mock_type: KEEP_ORIGINAL,
        mock_set: KEEP_ORIGINAL,
        capacity: KEEP_ORIGINAL,
        start_time: KEEP_ORIGINAL,
        end_time: KEEP_ORIGINAL,
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

    // Validate time range if both provided and not KEEP_ORIGINAL
    if (formData.start_time && formData.start_time !== KEEP_ORIGINAL &&
        formData.end_time && formData.end_time !== KEEP_ORIGINAL) {
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

    // Capacity must be positive if provided and not KEEP_ORIGINAL
    if (formData.capacity && formData.capacity !== KEEP_ORIGINAL && parseInt(formData.capacity) <= 0) {
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
    // mock_set can be explicitly cleared with '__clear__' or set to a value
    if (formData.mock_set && formData.mock_set !== KEEP_ORIGINAL) {
      overrides.mock_set = formData.mock_set === '__clear__' ? '' : formData.mock_set;
    }
    if (formData.capacity && formData.capacity !== KEEP_ORIGINAL) {
      overrides.capacity = parseInt(formData.capacity);
    }
    if (formData.start_time && formData.start_time !== KEEP_ORIGINAL) {
      overrides.start_time = formData.start_time;
    }
    if (formData.end_time && formData.end_time !== KEEP_ORIGINAL) {
      overrides.end_time = formData.end_time;
    }
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
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

                {/* Modal Content */}
                <div className="sm:flex sm:items-start">
                  {/* Icon */}
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentDuplicateIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Clone Sessions
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                      {/* Session count info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {selectedSessions.length}
                          </span>{' '}
                          session{selectedSessions.length !== 1 ? 's' : ''} will be cloned
                        </p>
                      </div>

                      {/* Edit Fields Section */}
                      <div className="space-y-4 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Override fields (leave blank to keep original values)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Exam Date - Required */}
                          <div className="md:col-span-2">
                            <Label htmlFor="exam_date">
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
                            <Label htmlFor="location">Location</Label>
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
                            <Label htmlFor="mock_type">Mock Type</Label>
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

                          {/* Mock Set */}
                          <div>
                            <Label htmlFor="mock_set">Mock Set</Label>
                            <Select
                              value={formData.mock_set}
                              onValueChange={(value) => handleFieldChange('mock_set', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                <SelectItem value="__clear__">Clear (no set)</SelectItem>
                                {MOCK_SET_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Only applies to SJ, CS, and Mock Discussion exams
                            </p>
                          </div>

                          {/* Capacity */}
                          <div>
                            <Label htmlFor="capacity">Capacity</Label>
                            <Select
                              value={formData.capacity}
                              onValueChange={(value) => handleFieldChange('capacity', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {CAPACITY_OPTIONS.map(num => (
                                  <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {validationErrors.capacity && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.capacity}
                              </p>
                            )}
                          </div>

                          {/* Start Time */}
                          <div>
                            <Label htmlFor="start_time">Start Time</Label>
                            <Select
                              value={formData.start_time}
                              onValueChange={(value) => handleFieldChange('start_time', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {TIME_OPTIONS.map(time => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {validationErrors.start_time && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.start_time}
                              </p>
                            )}
                          </div>

                          {/* End Time */}
                          <div>
                            <Label htmlFor="end_time">End Time</Label>
                            <Select
                              value={formData.end_time}
                              onValueChange={(value) => handleFieldChange('end_time', value)}
                              disabled={cloneMutation.isPending}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Keep original" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                <SelectItem value={KEEP_ORIGINAL}>Keep original</SelectItem>
                                {TIME_OPTIONS.map(time => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status */}
                          <div>
                            <Label htmlFor="is_active">Status</Label>
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

                          {/* Scheduled Activation DateTime */}
                          <div>
                            <Label htmlFor="scheduled_activation_datetime">Scheduled Activation</Label>
                            <DateTimePicker
                              id="scheduled_activation_datetime"
                              value={formData.scheduled_activation_datetime || ''}
                              onChange={(value) => handleFieldChange('scheduled_activation_datetime', value)}
                              placeholder="Keep current"
                              disabled={cloneMutation.isPending}
                              minDateTime={new Date().toISOString()}
                            />
                            {validationErrors.scheduled_activation_datetime && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.scheduled_activation_datetime}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Session Preview Table */}
                      {previewSessions.length > 0 && (
                        <>
                          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capacity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                {previewSessions.map((session) => (
                                  <tr key={session.id} className="bg-blue-50 dark:bg-blue-900/20">
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{session.mock_type}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{session.exam_date}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{session.location}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{session.capacity}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{getStatusDisplay(session)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Remaining count */}
                          {remainingCount > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                              ...and {remainingCount} more session{remainingCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 sm:mt-4 sm:flex sm:flex-row-reverse sm:ml-10">
                  {/* Clone Button */}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!formData.exam_date || cloneMutation.isPending}
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      !formData.exam_date || cloneMutation.isPending
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
                  >
                    {cloneMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Cloning...
                      </>
                    ) : (
                      `Clone ${selectedSessions.length} Session${selectedSessions.length !== 1 ? 's' : ''}`
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={cloneMutation.isPending}
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto transition-colors"
                  >
                    Cancel
                  </button>
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
