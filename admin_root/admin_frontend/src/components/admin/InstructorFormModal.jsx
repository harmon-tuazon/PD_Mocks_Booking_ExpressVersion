/**
 * InstructorFormModal Component
 * Modal form for creating and editing instructors
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

const InstructorFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData = null, // If provided, we're in edit mode
  mode = 'create' // 'create' or 'edit'
}) => {
  const inputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    instructor_name: '',
    email: ''
  });

  const [errors, setErrors] = useState({});

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          instructor_name: initialData.instructor_name || '',
          email: initialData.email || ''
        });
      } else {
        setFormData({
          instructor_name: '',
          email: ''
        });
      }
      setErrors({});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.instructor_name?.trim()) {
      newErrors.instructor_name = 'Instructor name is required';
    } else if (formData.instructor_name.length > 100) {
      newErrors.instructor_name = 'Name cannot exceed 100 characters';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    return newErrors;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));

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
      instructor_name: formData.instructor_name.trim(),
      email: formData.email.trim().toLowerCase()
    };

    onSubmit(submitData);
  };

  const getTitle = () => {
    return mode === 'edit' ? 'Edit Instructor' : 'Add New Instructor';
  };

  const getSubmitText = () => {
    if (isLoading) return mode === 'edit' ? 'Updating...' : 'Creating...';
    return mode === 'edit' ? 'Update Instructor' : 'Create Instructor';
  };

  const getIcon = () => {
    return mode === 'edit' ? (
      <PencilIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
    ) : (
      <PlusIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
    );
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
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
                      {mode === 'create'
                        ? 'Fill in the details below to add a new instructor.'
                        : 'Update the instructor details below.'}
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {/* Instructor Name */}
                  <div>
                    <label htmlFor="instructor_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instructor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      name="instructor_name"
                      id="instructor_name"
                      value={formData.instructor_name}
                      onChange={handleChange}
                      disabled={isLoading}
                      className={errors.instructor_name ? inputErrorClass : inputNormalClass}
                      placeholder="e.g., John Smith"
                    />
                    {errors.instructor_name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.instructor_name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isLoading}
                      className={errors.email ? inputErrorClass : inputNormalClass}
                      placeholder="e.g., john.smith@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                    )}
                  </div>

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

export default InstructorFormModal;
