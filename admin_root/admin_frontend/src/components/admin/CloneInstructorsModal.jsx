import { Fragment, useState, useEffect, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentDuplicateIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { instructorsApi } from '../../services/adminApi';

/**
 * Modal for cloning instructors
 *
 * Features:
 * - Clone one or more instructors with new email suffix
 * - Pre-populates form for single instructor selection
 * - Shows preview of instructors to be cloned
 */
const CloneInstructorsModal = ({
  isOpen,
  onClose,
  selectedInstructors,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    instructorName: '',
    emailSuffix: '_copy',
    isActive: true
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Clone mutation - handles multiple instructors sequentially
  const cloneMutation = useMutation({
    mutationFn: async ({ instructors, overrides }) => {
      const results = [];
      const errors = [];

      for (const instructor of instructors) {
        try {
          // Build clone data for this instructor
          const cloneData = {
            instructorName: instructors.length === 1 && overrides.instructorName
              ? overrides.instructorName
              : `${instructor.instructor_name} (Copy)`,
            emailSuffix: overrides.emailSuffix || '_copy',
            isActive: overrides.isActive
          };

          const result = await instructorsApi.clone(instructor.id || instructor.instructor_id, cloneData);
          results.push({ instructor: instructor.id || instructor.instructor_id, success: true, data: result });
        } catch (error) {
          errors.push({ instructor: instructor.id || instructor.instructor_id, success: false, error: error.message });
        }
      }

      return { results, errors, total: instructors.length };
    },
    onSuccess: (data) => {
      const successCount = data.results.length;
      const errorCount = data.errors.length;

      if (errorCount === 0) {
        toast.success(`Successfully cloned ${successCount} instructor${successCount !== 1 ? 's' : ''}`);
      } else if (successCount === 0) {
        toast.error(`Failed to clone all ${errorCount} instructor${errorCount !== 1 ? 's' : ''}`);
      } else {
        toast.success(`Cloned ${successCount} of ${data.total} instructors. ${errorCount} failed.`);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to clone instructors');
    }
  });

  // Pre-populate form when single instructor selected
  useEffect(() => {
    if (!isOpen) return;

    if (selectedInstructors.length === 1) {
      const source = selectedInstructors[0];
      setFormData({
        instructorName: `${source.instructor_name} (Copy)`,
        emailSuffix: '_copy',
        isActive: true
      });
    } else {
      // Multiple instructors - start with default values
      setFormData({
        instructorName: '',
        emailSuffix: '_copy',
        isActive: true
      });
    }

    setValidationErrors({});
  }, [isOpen, selectedInstructors]);

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

    // Email suffix is required and must be valid
    if (!formData.emailSuffix || !formData.emailSuffix.trim()) {
      errors.emailSuffix = 'Email suffix is required to generate unique emails';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.emailSuffix)) {
      errors.emailSuffix = 'Email suffix can only contain letters, numbers, dots, dashes, and underscores';
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
      instructorName: formData.instructorName?.trim() || null,
      emailSuffix: formData.emailSuffix?.trim() || '_copy',
      isActive: formData.isActive
    };

    try {
      await cloneMutation.mutateAsync({ instructors: selectedInstructors, overrides });

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

  // Get preview instructors (first 10)
  const previewInstructors = useMemo(() => {
    return selectedInstructors.slice(0, 10);
  }, [selectedInstructors]);

  const remainingCount = selectedInstructors.length - previewInstructors.length;

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl sm:p-6">
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
                      Clone Instructors
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                      {/* Instructor count info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-primary-600 dark:text-primary-400">
                            {selectedInstructors.length}
                          </span>{' '}
                          instructor{selectedInstructors.length !== 1 ? 's' : ''} will be cloned
                        </p>
                      </div>

                      {/* Edit Fields Section */}
                      <div className="space-y-4 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Clone Settings
                        </h4>

                        {/* Instructor Name - Only show for single instructor clone */}
                        {selectedInstructors.length === 1 && (
                          <div>
                            <label htmlFor="instructorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              New Instructor Name
                            </label>
                            <input
                              type="text"
                              id="instructorName"
                              value={formData.instructorName}
                              onChange={(e) => handleFieldChange('instructorName', e.target.value)}
                              disabled={cloneMutation.isPending}
                              placeholder="Leave empty to use default name"
                              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                          </div>
                        )}

                        {/* Email Suffix - Required */}
                        <div>
                          <label htmlFor="emailSuffix" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email Suffix <span className="text-red-500">*</span>
                          </label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm">
                              original@email.com →
                            </span>
                            <input
                              type="text"
                              id="emailSuffix"
                              value={formData.emailSuffix}
                              onChange={(e) => handleFieldChange('emailSuffix', e.target.value)}
                              disabled={cloneMutation.isPending}
                              placeholder="_copy"
                              className="flex-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-none rounded-r-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Example: john@email.com → john{formData.emailSuffix || '_copy'}@email.com
                          </p>
                          {validationErrors.emailSuffix && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                              <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                              {validationErrors.emailSuffix}
                            </p>
                          )}
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center">
                          <input
                            id="isActive"
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                            disabled={cloneMutation.isPending}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            Set cloned instructors as active
                          </label>
                        </div>
                      </div>

                      {/* Instructor Preview Table */}
                      {previewInstructors.length > 0 && (
                        <>
                          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                {previewInstructors.map((instructor) => (
                                  <tr key={instructor.id || instructor.instructor_id} className="bg-primary-50 dark:bg-primary-900/20">
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{instructor.instructor_name}</td>
                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{instructor.email}</td>
                                    <td className="px-3 py-2 text-xs">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        instructor.is_active
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                      }`}>
                                        {instructor.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Remaining count */}
                          {remainingCount > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                              ...and {remainingCount} more instructor{remainingCount !== 1 ? 's' : ''}
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
                    disabled={!formData.emailSuffix || cloneMutation.isPending}
                    className={`inline-flex w-full justify-center items-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto transition-colors ${
                      !formData.emailSuffix || cloneMutation.isPending
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
                      `Clone ${selectedInstructors.length} Instructor${selectedInstructors.length !== 1 ? 's' : ''}`
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

export default CloneInstructorsModal;
