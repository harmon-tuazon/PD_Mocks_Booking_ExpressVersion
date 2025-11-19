import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentDuplicateIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import useCloneSessions from '../../hooks/useCloneSessions';

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
    location: '',
    mock_type: '',
    capacity: '',
    start_time: '',
    end_time: '',
    is_active: '',
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
        location: source.location || '',
        mock_type: source.mock_type || '',
        capacity: source.capacity || '',
        start_time: source.start_time || '',
        end_time: source.end_time || '',
        is_active: source.is_active || '',
        scheduled_activation_datetime: source.scheduled_activation_datetime || ''
      });
    } else {
      // Multiple sessions - start with blank form
      setFormData({
        exam_date: '',
        location: '',
        mock_type: '',
        capacity: '',
        start_time: '',
        end_time: '',
        is_active: '',
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

    if (formData.location) overrides.location = formData.location;
    if (formData.mock_type) overrides.mock_type = formData.mock_type;
    if (formData.capacity) overrides.capacity = parseInt(formData.capacity);
    if (formData.start_time) overrides.start_time = formData.start_time;
    if (formData.end_time) overrides.end_time = formData.end_time;
    if (formData.is_active) overrides.is_active = formData.is_active;
    if (formData.scheduled_activation_datetime) {
      overrides.scheduled_activation_datetime = formData.scheduled_activation_datetime;
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6 max-h-[90vh] flex flex-col">
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
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                        Clone {selectedSessions.length} Session{selectedSessions.length !== 1 ? 's' : ''}
                      </Dialog.Title>

                      <div className="mt-4 space-y-4">
                        {/* Info Banner */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                          <p className="text-sm text-blue-800 dark:text-blue-300">
                            {selectedSessions.length === 1 ? (
                              <>Form pre-populated with source session values. Change any field to override.</>
                            ) : (
                              <>Empty fields will use each source session's original value. Fill fields to override for all clones.</>
                            )}
                          </p>
                        </div>

                        {/* Clone Form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Exam Date - Required */}
                          <div className="sm:col-span-2">
                            <label htmlFor="exam_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              New Exam Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              id="exam_date"
                              value={formData.exam_date}
                              onChange={(e) => handleFieldChange('exam_date', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                              disabled={cloneMutation.isPending}
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
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Location (optional)
                            </label>
                            <select
                              id="location"
                              value={formData.location}
                              onChange={(e) => handleFieldChange('location', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                              disabled={cloneMutation.isPending}
                            >
                              <option value="">Keep original</option>
                              {LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>

                          {/* Mock Type */}
                          <div>
                            <label htmlFor="mock_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Mock Type (optional)
                            </label>
                            <select
                              id="mock_type"
                              value={formData.mock_type}
                              onChange={(e) => handleFieldChange('mock_type', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                              disabled={cloneMutation.isPending}
                            >
                              <option value="">Keep original</option>
                              {MOCK_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>

                          {/* Capacity */}
                          <div>
                            <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Capacity (optional)
                            </label>
                            <input
                              type="number"
                              id="capacity"
                              min="1"
                              max="100"
                              value={formData.capacity}
                              onChange={(e) => handleFieldChange('capacity', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
                            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Start Time (optional)
                            </label>
                            <input
                              type="time"
                              id="start_time"
                              value={formData.start_time}
                              onChange={(e) => handleFieldChange('start_time', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
                            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              End Time (optional)
                            </label>
                            <input
                              type="time"
                              id="end_time"
                              value={formData.end_time}
                              onChange={(e) => handleFieldChange('end_time', e.target.value)}
                              placeholder="Keep original"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                              disabled={cloneMutation.isPending}
                            />
                          </div>

                          {/* Status */}
                          <div className="sm:col-span-2">
                            <label htmlFor="is_active" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Status (optional)
                            </label>
                            <select
                              id="is_active"
                              value={formData.is_active}
                              onChange={(e) => handleFieldChange('is_active', e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                              disabled={cloneMutation.isPending}
                            >
                              <option value="">Keep original</option>
                              {ACTIVE_STATES.map(state => (
                                <option key={state.value} value={state.value}>{state.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Scheduled Activation DateTime - Conditional */}
                          {formData.is_active === 'scheduled' && (
                            <div className="sm:col-span-2">
                              <label htmlFor="scheduled_activation_datetime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Scheduled Activation <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="datetime-local"
                                id="scheduled_activation_datetime"
                                value={formData.scheduled_activation_datetime}
                                onChange={(e) => handleFieldChange('scheduled_activation_datetime', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                disabled={cloneMutation.isPending}
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

                        {/* Session Preview Table */}
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Selected Sessions
                          </h4>
                          <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
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
                <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
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
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
