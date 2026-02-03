import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentDuplicateIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { groupsApi } from '../../services/adminApi';

/**
 * Modal for cloning workcheck groups
 *
 * Features:
 * - Clone one or more groups with new dates
 * - Option to include students from source groups
 * - Pre-populates form for single group selection (date +7 days)
 * - Shows blank form for multiple group selection
 */
const CloneGroupsModal = ({
  isOpen,
  onClose,
  selectedGroups,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Location options
  const LOCATION_OPTIONS = [
    'Mississauga',
    'Vancouver',
    'Calgary',
    'Montreal',
    'Richmond Hill',
    'Online'
  ];

  // Status options
  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'completed', label: 'Completed' }
  ];

  // Form state
  const [formData, setFormData] = useState({
    groupName: '',
    startDate: '',
    endDate: '',
    timePeriod: '',
    location: '',
    status: '',
    maxCapacity: '',
    includeStudents: false
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Clone mutation - handles multiple groups sequentially
  const cloneMutation = useMutation({
    mutationFn: async ({ groups, overrides }) => {
      const results = [];
      const errors = [];

      for (const group of groups) {
        try {
          // Build clone data for this group
          const cloneData = {
            groupName: overrides.groupName || `${group.group_name} (Copy)`,
            timePeriod: overrides.timePeriod || group.time_period,
            location: overrides.location || group.location || 'Mississauga',
            status: overrides.status || group.status || 'active',
            startDate: overrides.startDate,
            endDate: overrides.endDate || group.end_date || null,
            maxCapacity: overrides.maxCapacity ? parseInt(overrides.maxCapacity) : group.max_capacity,
            includeStudents: overrides.includeStudents
          };

          const result = await groupsApi.clone(group.group_id, cloneData);
          results.push({ group: group.group_id, success: true, data: result });
        } catch (error) {
          errors.push({ group: group.group_id, success: false, error: error.message });
        }
      }

      return { results, errors, total: groups.length };
    },
    onSuccess: (data) => {
      const successCount = data.results.length;
      const errorCount = data.errors.length;

      if (errorCount === 0) {
        toast.success(`Successfully cloned ${successCount} group${successCount !== 1 ? 's' : ''}`);
      } else if (successCount === 0) {
        toast.error(`Failed to clone all ${errorCount} group${errorCount !== 1 ? 's' : ''}`);
      } else {
        toast.success(`Cloned ${successCount} of ${data.total} groups. ${errorCount} failed.`);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to clone groups');
    }
  });

  // Pre-populate form when single group selected
  useEffect(() => {
    if (!isOpen) return;

    if (selectedGroups.length === 1) {
      const source = selectedGroups[0];

      // Calculate default new date (+7 days from source)
      let newStartDate = '';
      let newEndDate = '';
      if (source.start_date) {
        try {
          const sourceDate = new Date(source.start_date);
          if (!isNaN(sourceDate.getTime())) {
            sourceDate.setDate(sourceDate.getDate() + 7);
            newStartDate = sourceDate.toISOString().split('T')[0];
          }
        } catch (error) {
          newStartDate = '';
        }
      }
      if (source.end_date) {
        try {
          const sourceDate = new Date(source.end_date);
          if (!isNaN(sourceDate.getTime())) {
            sourceDate.setDate(sourceDate.getDate() + 7);
            newEndDate = sourceDate.toISOString().split('T')[0];
          }
        } catch (error) {
          newEndDate = '';
        }
      }

      setFormData({
        groupName: `${source.group_name} (Copy)`,
        startDate: newStartDate,
        endDate: newEndDate,
        timePeriod: source.time_period || '',
        location: source.location || '',
        status: '',
        maxCapacity: '',
        includeStudents: false
      });
    } else {
      // Multiple groups - start with blank form (groupName not applicable for bulk clone)
      setFormData({
        groupName: '',
        startDate: '',
        endDate: '',
        timePeriod: '',
        location: '',
        status: '',
        maxCapacity: '',
        includeStudents: false
      });
    }

    setValidationErrors({});
  }, [isOpen, selectedGroups]);

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
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Start date is required
    if (!formData.startDate) {
      errors.startDate = 'New start date is required for cloning';
    }

    // Start date must be different from all source groups
    if (formData.startDate) {
      const sameDate = selectedGroups.some(g => g.start_date === formData.startDate);
      if (sameDate) {
        errors.startDate = 'New date must be different from original date(s)';
      }
    }

    // If end date provided, it must be after start date
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end <= start) {
        errors.endDate = 'End date must be after start date';
      }
    }

    // Capacity must be positive if provided
    if (formData.maxCapacity && parseInt(formData.maxCapacity) <= 0) {
      errors.maxCapacity = 'Capacity must be a positive number';
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

    // Prepare overrides object
    const overrides = {
      groupName: formData.groupName?.trim() || null,
      startDate: formData.startDate,
      endDate: formData.endDate || null,
      timePeriod: formData.timePeriod || null,
      location: formData.location || null,
      status: formData.status || null,
      maxCapacity: formData.maxCapacity || null,
      includeStudents: formData.includeStudents
    };

    try {
      await cloneMutation.mutateAsync({ groups: selectedGroups, overrides });

      // Close modal on success
      onClose();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Clone operation failed:', error);
    }
  };

  // Get preview groups (first 10)
  const previewGroups = useMemo(() => {
    return selectedGroups.slice(0, 10);
  }, [selectedGroups]);

  const remainingCount = selectedGroups.length - previewGroups.length;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentDuplicateIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      Clone Groups
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                      {/* Group count info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-primary-600 dark:text-primary-400">
                            {selectedGroups.length}
                          </span>{' '}
                          group{selectedGroups.length !== 1 ? 's' : ''} will be cloned
                        </p>
                      </div>

                      {/* Edit Fields Section */}
                      <div className="space-y-4 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Clone Settings
                        </h4>

                        {/* Group Name - Only show for single group clone */}
                        {selectedGroups.length === 1 && (
                          <div>
                            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              New Group Name
                            </label>
                            <input
                              type="text"
                              id="groupName"
                              value={formData.groupName}
                              onChange={(e) => handleFieldChange('groupName', e.target.value)}
                              disabled={cloneMutation.isPending}
                              placeholder="Leave empty to use default name"
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Start Date - Required */}
                          <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              New Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              id="startDate"
                              value={formData.startDate}
                              onChange={(e) => handleFieldChange('startDate', e.target.value)}
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                            {validationErrors.startDate && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                                <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                                {validationErrors.startDate}
                              </p>
                            )}
                          </div>

                          {/* End Date */}
                          <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              New End Date
                            </label>
                            <input
                              type="date"
                              id="endDate"
                              value={formData.endDate}
                              onChange={(e) => handleFieldChange('endDate', e.target.value)}
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                            {validationErrors.endDate && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.endDate}
                              </p>
                            )}
                          </div>

                          {/* Time Period */}
                          <div>
                            <label htmlFor="timePeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Time Period
                            </label>
                            <select
                              id="timePeriod"
                              value={formData.timePeriod}
                              onChange={(e) => handleFieldChange('timePeriod', e.target.value)}
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            >
                              <option value="">Keep original</option>
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>

                          {/* Location */}
                          <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Location
                            </label>
                            <select
                              id="location"
                              value={formData.location}
                              onChange={(e) => handleFieldChange('location', e.target.value)}
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            >
                              <option value="">Keep original</option>
                              {LOCATION_OPTIONS.map((loc) => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>

                          {/* Status */}
                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Status
                            </label>
                            <select
                              id="status"
                              value={formData.status}
                              onChange={(e) => handleFieldChange('status', e.target.value)}
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            >
                              <option value="">Keep original</option>
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Max Capacity */}
                          <div>
                            <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Max Capacity
                            </label>
                            <input
                              type="number"
                              id="maxCapacity"
                              min="1"
                              value={formData.maxCapacity}
                              onChange={(e) => handleFieldChange('maxCapacity', e.target.value)}
                              placeholder="Keep original"
                              disabled={cloneMutation.isPending}
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                            {validationErrors.maxCapacity && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {validationErrors.maxCapacity}
                              </p>
                            )}
                          </div>

                          {/* Include Students */}
                          <div className="md:col-span-2">
                            <div className="flex items-center">
                              <input
                                id="includeStudents"
                                type="checkbox"
                                checked={formData.includeStudents}
                                onChange={(e) => handleFieldChange('includeStudents', e.target.checked)}
                                disabled={cloneMutation.isPending}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <label htmlFor="includeStudents" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                Include students from original group(s)
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Group Preview Table */}
                      {previewGroups.length > 0 && (
                        <>
                          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Group Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                {previewGroups.map((group) => (
                                  <tr key={group.group_id} className="bg-primary-50 dark:bg-primary-900/20">
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{group.group_name}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{group.time_period}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{formatDate(group.start_date)}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{group.student_count || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Remaining count */}
                          {remainingCount > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                              ...and {remainingCount} more group{remainingCount !== 1 ? 's' : ''}
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
                    disabled={!formData.startDate || cloneMutation.isPending}
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      !formData.startDate || cloneMutation.isPending
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
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
                      `Clone ${selectedGroups.length} Group${selectedGroups.length !== 1 ? 's' : ''}`
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={cloneMutation.isPending}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto transition-colors"
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

export default CloneGroupsModal;
