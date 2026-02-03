/**
 * GroupForm Component
 * Modal form for creating and editing groups
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const GroupForm = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData = null, // If provided, we're in edit mode
  mode = 'create' // 'create', 'edit', or 'clone'
}) => {
  const inputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    groupName: '',
    description: '',
    timePeriod: 'AM',
    startDate: '',
    endDate: '',
    maxCapacity: 20
  });

  const [errors, setErrors] = useState({});

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          groupName: mode === 'clone' ? `${initialData.group_name} - Copy` : initialData.group_name || '',
          description: initialData.description || '',
          timePeriod: initialData.time_period || 'AM',
          startDate: initialData.start_date || '',
          endDate: initialData.end_date || '',
          maxCapacity: initialData.max_capacity || 20
        });
      } else {
        setFormData({
          groupName: '',
          description: '',
          timePeriod: 'AM',
          startDate: '',
          endDate: '',
          maxCapacity: 20
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

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    if (!formData.timePeriod) {
      newErrors.timePeriod = 'Time period is required';
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
      description: formData.description?.trim() || null,
      timePeriod: formData.timePeriod,
      startDate: formData.startDate,
      endDate: formData.endDate || null,
      maxCapacity: formData.maxCapacity
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

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-dark-card px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100">
                    {getTitle()}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-dark-card text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  {/* Group Name */}
                  <div>
                    <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      name="groupName"
                      id="groupName"
                      value={formData.groupName}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.groupName
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                      } dark:bg-gray-800 dark:text-gray-100`}
                      placeholder="e.g., Group 1"
                    />
                    {errors.groupName && (
                      <p className="mt-1 text-sm text-red-600">{errors.groupName}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      name="description"
                      id="description"
                      rows={2}
                      value={formData.description}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.description
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                      } dark:bg-gray-800 dark:text-gray-100`}
                      placeholder="Optional description..."
                    />
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                    )}
                  </div>

                  {/* Time Period and Max Capacity - side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="timePeriod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Time Period <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="timePeriod"
                        id="timePeriod"
                        value={formData.timePeriod}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.timePeriod
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                        } dark:bg-gray-800 dark:text-gray-100`}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                      {errors.timePeriod && (
                        <p className="mt-1 text-sm text-red-600">{errors.timePeriod}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="maxCapacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.maxCapacity
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                        } dark:bg-gray-800 dark:text-gray-100`}
                      />
                      {errors.maxCapacity && (
                        <p className="mt-1 text-sm text-red-600">{errors.maxCapacity}</p>
                      )}
                    </div>
                  </div>

                  {/* Date Range - side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        id="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.startDate
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                        } dark:bg-gray-800 dark:text-gray-100`}
                      />
                      {errors.startDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        id="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        min={formData.startDate || undefined}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          errors.endDate
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
                        } dark:bg-gray-800 dark:text-gray-100`}
                      />
                      {errors.endDate && (
                        <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                      )}
                    </div>
                  </div>

                  {/* Clone mode notice */}
                  {mode === 'clone' && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Students from the original group will be copied to the new group.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isLoading}
                      className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {getSubmitText()}
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
