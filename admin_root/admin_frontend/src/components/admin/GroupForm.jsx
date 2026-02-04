/**
 * GroupForm Component
 * Modal form for creating and editing groups
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PencilIcon, DocumentDuplicateIcon, PlusIcon } from '@heroicons/react/24/outline';

const GroupForm = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData = null, // If provided, we're in edit mode
  mode = 'create' // 'create', 'edit', or 'clone'
}) => {
  const inputRef = useRef(null);

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
    location: 'Mississauga',
    cycle: '',
    timePeriod: 'AM',
    startDate: '',
    endDate: '',
    maxCapacity: 20,
    status: 'active'
  });

  const [errors, setErrors] = useState({});

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          groupName: mode === 'clone' ? `${initialData.group_name} - Copy` : initialData.group_name || '',
          location: initialData.location || 'Mississauga',
          cycle: initialData.cycle || '',
          timePeriod: initialData.time_period || 'AM',
          startDate: initialData.start_date || '',
          endDate: initialData.end_date || '',
          maxCapacity: initialData.max_capacity || 20,
          status: initialData.status || 'active'
        });
      } else {
        setFormData({
          groupName: '',
          location: 'Mississauga',
          cycle: '',
          timePeriod: 'AM',
          startDate: '',
          endDate: '',
          maxCapacity: 20,
          status: 'active'
        });
      }
      setErrors({});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData, mode]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.groupName?.trim()) {
      newErrors.groupName = 'Group name is required';
    } else if (formData.groupName.length > 100) {
      newErrors.groupName = 'Group name cannot exceed 100 characters';
    }

    if (!formData.timePeriod) {
      newErrors.timePeriod = 'Time period is required';
    }

    if (!formData.location) {
      newErrors.location = 'Location is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (formData.endDate && formData.startDate && formData.endDate <= formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (!formData.maxCapacity || formData.maxCapacity < 1) {
      newErrors.maxCapacity = 'Max capacity must be at least 1';
    } else if (formData.maxCapacity > 100) {
      newErrors.maxCapacity = 'Max capacity cannot exceed 100';
    }

    return newErrors;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseInt(value, 10) || '' : value;

    setFormData(prev => ({ ...prev, [name]: newValue }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Prepare data for API
    const submitData = {
      groupName: formData.groupName.trim(),
      location: formData.location,
      cycle: formData.cycle?.trim() || null,
      timePeriod: formData.timePeriod,
      startDate: formData.startDate,
      endDate: formData.endDate || null,
      maxCapacity: formData.maxCapacity,
      status: formData.status
    };

    // For clone mode, add the includeStudents flag
    if (mode === 'clone') {
      submitData.includeStudents = true;
    }

    onSubmit(submitData);
  };

  const getTitle = () => {
    switch (mode) {
      case 'edit':
        return 'Edit Group';
      case 'clone':
        return 'Clone Group';
      default:
        return 'Create New Group';
    }
  };

  const getSubmitText = () => {
    if (isLoading) return 'Saving...';
    switch (mode) {
      case 'edit':
        return 'Update Group';
      case 'clone':
        return 'Clone Group';
      default:
        return 'Create Group';
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'edit':
        return <PencilIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />;
      case 'clone':
        return <DocumentDuplicateIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />;
      default:
        return <PlusIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />;
    }
  };

  // Common input class
  const inputBaseClass = "block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-1";
  const inputNormalClass = `${inputBaseClass} border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`;
  const inputErrorClass = `${inputBaseClass} border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100`;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isLoading ? () => {} : onClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Header with Icon */}
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    {getIcon()}
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
                      {getTitle()}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {mode === 'create' && 'Fill in the details below to create a new group.'}
                      {mode === 'edit' && 'Update the group details below.'}
                      {mode === 'clone' && 'Create a copy of the selected group.'}
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {/* Group Name */}
                  <div>
                    <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      name="groupName"
                      id="groupName"
                      value={formData.groupName}
                      onChange={handleChange}
                      disabled={isLoading}
                      className={errors.groupName ? inputErrorClass : inputNormalClass}
                      placeholder="e.g., Group 1"
                    />
                    {errors.groupName && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.groupName}</p>
                    )}
                  </div>

                  {/* Location and Cycle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="location"
                        id="location"
                        value={formData.location}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={errors.location ? inputErrorClass : inputNormalClass}
                      >
                        {LOCATION_OPTIONS.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      {errors.location && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="cycle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cycle
                      </label>
                      <input
                        type="text"
                        name="cycle"
                        id="cycle"
                        value={formData.cycle}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={inputNormalClass}
                        placeholder="Enter cycle (optional)"
                      />
                    </div>
                  </div>

                  {/* Time Period, Status, and Max Capacity */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="timePeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Time Period <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="timePeriod"
                        id="timePeriod"
                        value={formData.timePeriod}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={errors.timePeriod ? inputErrorClass : inputNormalClass}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                      {errors.timePeriod && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.timePeriod}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="status"
                        id="status"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={inputNormalClass}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Max Capacity <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="maxCapacity"
                        id="maxCapacity"
                        min={1}
                        max={100}
                        value={formData.maxCapacity}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={errors.maxCapacity ? inputErrorClass : inputNormalClass}
                      />
                      {errors.maxCapacity && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.maxCapacity}</p>
                      )}
                    </div>
                  </div>

                  {/* Date Range - side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        id="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        disabled={isLoading}
                        className={errors.startDate ? inputErrorClass : inputNormalClass}
                      />
                      {errors.startDate && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        id="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        min={formData.startDate || undefined}
                        disabled={isLoading}
                        className={errors.endDate ? inputErrorClass : inputNormalClass}
                      />
                      {errors.endDate && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate}</p>
                      )}
                    </div>
                  </div>

                  {/* Clone mode notice */}
                  {mode === 'clone' && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Students from the original group will be copied to the new group.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 sm:mt-5 sm:flex sm:flex-row-reverse sm:gap-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {getSubmitText()}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isLoading}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default GroupForm;
