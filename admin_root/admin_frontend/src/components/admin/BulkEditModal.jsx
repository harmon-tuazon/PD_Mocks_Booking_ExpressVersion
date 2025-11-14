/**
 * BulkEditModal Component
 *
 * Modal for bulk editing multiple mock exam sessions with smart filtering and validation.
 *
 * Features:
 * - **Smart Filtering**: Automatically separates sessions into editable (0 bookings) and blocked (>0 bookings)
 * - **6 Editable Fields**: location, mock_type, capacity, exam_date, is_active, scheduled_activation_datetime
 * - **Empty Field Behavior**: Fields left blank are NOT updated (preserves existing values)
 * - **Auto-Regeneration**: mock_exam_name regenerated when mock_type, location, or exam_date changes
 * - **Confirmation Safety**: User must type count of editable sessions to proceed
 * - **Preview Table**: Shows first 10 editable + 5 blocked sessions with visual indicators
 * - **Loading States**: Disables inputs during submission, shows spinner
 * - **Real-time Validation**: Inline error messages for invalid inputs
 * - **Keyboard Support**: ESC to close (if not submitting), Tab navigation, Enter in confirmation
 * - **Accessibility**: ARIA labels, semantic HTML, screen reader support
 * - **Responsive**: Mobile, tablet, desktop layouts
 *
 * @component
 * @example
 * // Usage in MockExamsDashboard
 * <BulkEditModal
 *   isOpen={isBulkEditModalOpen}
 *   onClose={() => setIsBulkEditModalOpen(false)}
 *   selectedSessions={bulkSelection.selectedSessions}
 *   onSuccess={handleBulkEditSuccess}
 * />
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Handler to close modal
 * @param {Array<Object>} props.selectedSessions - Array of selected session objects
 * @param {string} props.selectedSessions[].id - HubSpot session ID
 * @param {string|number} props.selectedSessions[].total_bookings - Number of bookings (determines if editable)
 * @param {string} props.selectedSessions[].mock_type - Current mock type
 * @param {string} props.selectedSessions[].location - Current location
 * @param {string} props.selectedSessions[].exam_date - Current exam date
 * @param {Function} props.onSuccess - Handler called after successful update (closes modal, exits selection)
 *
 * @returns {JSX.Element} Modal component with form and preview table
 */

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PencilSquareIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { formatDateShort } from '../../utils/dateUtils';
import { convertUTCToToronto, convertTorontoToUTC } from '../../utils/dateTimeUtils';
import useBulkEdit from '../../hooks/useBulkEdit';
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
import { Input } from '@/components/ui/input';

const BulkEditModal = ({
  isOpen,
  onClose,
  selectedSessions,
  onSuccess
}) => {
  // Form state - sentinel values for selects, empty for inputs
  const [formData, setFormData] = useState({
    location: '__keep_current__',
    mock_type: '__keep_current__',
    capacity: '',
    exam_date: '',
    is_active: '__keep_current__',
    scheduled_activation_datetime: ''
  });
  const [confirmationInput, setConfirmationInput] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const editMutation = useBulkEdit();

  // Filter sessions based on bookings
  const editableSessions = useMemo(() =>
    selectedSessions.filter(s => !s.total_bookings || parseInt(s.total_bookings) === 0),
    [selectedSessions]
  );

  const blockedSessions = useMemo(() =>
    selectedSessions.filter(s => s.total_bookings && parseInt(s.total_bookings) > 0),
    [selectedSessions]
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        location: '',
        mock_type: '',
        capacity: '',
        exam_date: '',
        is_active: '',
        scheduled_activation_datetime: ''
      });
      setConfirmationInput('');
      setValidationErrors({});
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !editMutation.isPending) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, editMutation.isPending, onClose]);

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

  // Check if at least one field has a value
  const hasAtLeastOneField = useMemo(() => {
    return Object.values(formData).some(value => value !== '');
  }, [formData]);

  // Validate confirmation input
  const isConfirmationValid = useMemo(() => {
    const inputNumber = parseInt(confirmationInput);
    return inputNumber === editableSessions.length;
  }, [confirmationInput, editableSessions.length]);

  // Prepare updates object (only non-empty fields)
  const prepareUpdates = () => {
    const updates = {};

    // Sentinel value for "keep current" option in selects
    const KEEP_CURRENT = '__keep_current__';

    if (formData.location && formData.location !== KEEP_CURRENT) updates.location = formData.location;
    if (formData.mock_type && formData.mock_type !== KEEP_CURRENT) updates.mock_type = formData.mock_type;
    if (formData.capacity) updates.capacity = parseInt(formData.capacity);
    if (formData.exam_date) updates.exam_date = formData.exam_date;
    if (formData.is_active && formData.is_active !== KEEP_CURRENT) updates.is_active = formData.is_active;

    // Handle scheduled activation datetime
    if (formData.is_active === 'scheduled' && formData.scheduled_activation_datetime) {
      // Convert to UTC for backend
      updates.scheduled_activation_datetime = convertTorontoToUTC(formData.scheduled_activation_datetime);
    }

    return updates;
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // At least one field must be filled
    if (!hasAtLeastOneField) {
      errors.general = 'At least one field must be filled';
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
    if (!isConfirmationValid || editMutation.isPending) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Extract only editable session IDs
    const sessionIds = editableSessions.map(session => session.id);
    const updates = prepareUpdates();

    try {
      await editMutation.mutateAsync({ sessionIds, updates });

      // Close modal on success
      onClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Bulk edit operation failed:', error);
    }
  };

  // Get preview sessions (first 10)
  const previewSessions = useMemo(() => {
    const allSessions = [...editableSessions, ...blockedSessions];
    return allSessions.slice(0, 10);
  }, [editableSessions, blockedSessions]);

  const remainingCount = editableSessions.length + blockedSessions.length - previewSessions.length;

  // Helper function to get status display
  const getStatusDisplay = (session) => {
    if (session.is_active === 'true') return 'Active';
    if (session.is_active === 'scheduled') return 'Scheduled';
    return 'Inactive';
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={editMutation.isPending ? () => {} : onClose}
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
                    disabled={editMutation.isPending}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="sm:flex sm:items-start">
                  {/* Icon */}
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 sm:mx-0 sm:h-10 sm:w-10">
                    <PencilSquareIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Bulk Edit Sessions
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                      {/* Session breakdown */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {editableSessions.length}
                          </span>{' '}
                          session{editableSessions.length !== 1 ? 's' : ''} can be edited
                          {blockedSessions.length > 0 && (
                            <>
                              {', '}
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                {blockedSessions.length}
                              </span>{' '}
                              session{blockedSessions.length !== 1 ? 's have' : ' has'} bookings (cannot edit)
                            </>
                          )}
                        </p>
                      </div>

                      {/* Warning banner for blocked sessions */}
                      {blockedSessions.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 dark:border-yellow-400 p-3">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                              Sessions with existing bookings cannot be edited and will be skipped.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Empty state if no editable sessions */}
                      {editableSessions.length === 0 ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-600 dark:border-red-400 p-4">
                          <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                            All selected sessions have bookings and cannot be edited.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Edit form */}
                          <div className="space-y-4 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Edit Fields (leave blank to keep current values)
                            </h4>

                            {/* Validation errors */}
                            {validationErrors.general && (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {validationErrors.general}
                              </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Location */}
                              <div>
                                <Label htmlFor="location">Location</Label>
                                <Select
                                  value={formData.location}
                                  onValueChange={(value) => handleFieldChange('location', value)}
                                  disabled={editMutation.isPending}
                                >
                                  <SelectTrigger id="location">
                                    <SelectValue placeholder="Keep current" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__keep_current__">Keep current</SelectItem>
                                    <SelectItem value="Mississauga">Mississauga</SelectItem>
                                    <SelectItem value="Mississauga - B9">Mississauga - B9</SelectItem>
                                    <SelectItem value="Mississauga - Lab D">Mississauga - Lab D</SelectItem>
                                    <SelectItem value="Vancouver">Vancouver</SelectItem>
                                    <SelectItem value="Montreal">Montreal</SelectItem>
                                    <SelectItem value="Calgary">Calgary</SelectItem>
                                    <SelectItem value="Richmond Hill">Richmond Hill</SelectItem>
                                    <SelectItem value="Online">Online</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Mock Type */}
                              <div>
                                <Label htmlFor="mock_type">Mock Type</Label>
                                <Select
                                  value={formData.mock_type}
                                  onValueChange={(value) => handleFieldChange('mock_type', value)}
                                  disabled={editMutation.isPending}
                                >
                                  <SelectTrigger id="mock_type">
                                    <SelectValue placeholder="Keep current" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__keep_current__">Keep current</SelectItem>
                                    <SelectItem value="Situational Judgment">Situational Judgment</SelectItem>
                                    <SelectItem value="Clinical Skills">Clinical Skills</SelectItem>
                                    <SelectItem value="Mock Discussion">Mock Discussion</SelectItem>
                                    <SelectItem value="Mini-mock">Mini-mock</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Capacity */}
                              <div>
                                <Label htmlFor="capacity">Capacity</Label>
                                <Input
                                  type="number"
                                  id="capacity"
                                  value={formData.capacity}
                                  onChange={(e) => handleFieldChange('capacity', e.target.value)}
                                  placeholder="Keep current"
                                  min="1"
                                  max="100"
                                  disabled={editMutation.isPending}
                                  className={validationErrors.capacity ? 'border-red-500' : ''}
                                />
                                {validationErrors.capacity && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                    {validationErrors.capacity}
                                  </p>
                                )}
                              </div>

                              {/* Exam Date */}
                              <div>
                                <Label htmlFor="exam_date">Exam Date</Label>
                                <DatePicker
                                  id="exam_date"
                                  value={formData.exam_date}
                                  onChange={(value) => handleFieldChange('exam_date', value)}
                                  placeholder="Keep current"
                                  disabled={editMutation.isPending}
                                />
                              </div>

                              {/* Status */}
                              <div>
                                <Label htmlFor="is_active">Status</Label>
                                <Select
                                  value={formData.is_active}
                                  onValueChange={(value) => handleFieldChange('is_active', value)}
                                  disabled={editMutation.isPending}
                                >
                                  <SelectTrigger id="is_active">
                                    <SelectValue placeholder="Keep current" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__keep_current__">Keep current</SelectItem>
                                    <SelectItem value="true">Active</SelectItem>
                                    <SelectItem value="false">Inactive</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Scheduled Activation DateTime - conditional */}
                              {formData.is_active === 'scheduled' && (
                                <div>
                                  <Label htmlFor="scheduled_activation">Scheduled Activation</Label>
                                  <DateTimePicker
                                    id="scheduled_activation"
                                    value={formData.scheduled_activation_datetime}
                                    onChange={(value) => handleFieldChange('scheduled_activation_datetime', value)}
                                    placeholder="Select date and time"
                                    disabled={editMutation.isPending}
                                    minDateTime={new Date().toISOString()}
                                  />
                                  {validationErrors.scheduled_activation_datetime && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                      {validationErrors.scheduled_activation_datetime}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info banner */}
                          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-400 p-3">
                            <div className="flex">
                              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                              <p className="text-sm text-blue-800 dark:text-blue-300">
                                Fields left blank will not be updated. Only the fields you fill in will be changed.
                              </p>
                            </div>
                          </div>

                          {/* Session preview table */}
                          {previewSessions.length > 0 && (
                            <>
                              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Type
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Date
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Location
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Current Capacity
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Total Bookings
                                      </th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Status
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                    {previewSessions.map((session) => {
                                      const hasBookings = session.total_bookings && parseInt(session.total_bookings) > 0;
                                      const isEditable = !hasBookings;
                                      return (
                                        <tr
                                          key={session.id}
                                          className={hasBookings ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}
                                        >
                                          <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                            {session.mock_type || 'N/A'}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                            {formatDateShort(session.exam_date)}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                            {session.location || 'N/A'}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                            {session.capacity || 'N/A'}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                            {session.total_bookings || '0'}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${
                                              isEditable
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                            }`}>
                                              {isEditable ? getStatusDisplay(session) : 'Has bookings'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
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

                          {/* Confirmation input */}
                          <div className="space-y-2">
                            <Label htmlFor="confirmation-input">
                              Type <span className="font-bold">{editableSessions.length}</span> to confirm bulk edit
                            </Label>
                            <Input
                              id="confirmation-input"
                              type="text"
                              inputMode="numeric"
                              value={confirmationInput}
                              onChange={(e) => setConfirmationInput(e.target.value)}
                              disabled={editMutation.isPending}
                              placeholder={`Type ${editableSessions.length} to confirm`}
                              className="text-center"
                              autoComplete="off"
                            />
                            {confirmationInput && !isConfirmationValid && (
                              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                                Please type {editableSessions.length} to confirm
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 sm:mt-4 sm:flex sm:flex-row-reverse sm:ml-10">
                  {/* Confirm Button */}
                  <button
                    type="button"
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      !isConfirmationValid || !hasAtLeastOneField || editMutation.isPending || editableSessions.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
                    onClick={handleConfirm}
                    disabled={!isConfirmationValid || !hasAtLeastOneField || editMutation.isPending || editableSessions.length === 0}
                  >
                    {editMutation.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      `Update ${editableSessions.length > 0 ? editableSessions.length : ''} Session${editableSessions.length !== 1 ? 's' : ''}`
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto transition-colors"
                    onClick={onClose}
                    disabled={editMutation.isPending}
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

export default BulkEditModal;