/**
 * CreateBookingModal Component
 * Modal form for admin booking creation
 *
 * Features:
 * - Required fields: student_id, email
 * - Conditional fields based on mock_type:
 *   - attending_location (for Situational Judgment, Mini-mock)
 *   - dominant_hand (for Clinical Skills)
 * - Warning label about bypassing constraints
 * - Toast notifications for success/error
 * - Loading state during submission
 * - Accessibility support (ARIA labels, keyboard navigation)
 */

import { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/adminApi';

const CreateBookingModal = ({ isOpen, onClose, mockExam, onSuccess }) => {
  const inputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    student_id: '',
    email: '',
    attending_location: '',
    dominant_hand: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        student_id: '',
        email: '',
        attending_location: '',
        dominant_hand: null
      });
      setErrors({});
      // Auto-focus student_id input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Determine if conditional fields are required
  const requiresLocation = mockExam?.mock_type === 'Situational Judgment' || mockExam?.mock_type === 'Mini-mock';
  const requiresHand = mockExam?.mock_type === 'Clinical Skills';

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    // Student ID validation
    if (!formData.student_id) {
      newErrors.student_id = 'Student ID is required';
    } else if (!/^[A-Z0-9]+$/.test(formData.student_id)) {
      newErrors.student_id = 'Student ID must be uppercase letters and numbers only';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Conditional validation
    if (requiresLocation && !formData.attending_location) {
      newErrors.attending_location = 'Attending location is required';
    }

    if (requiresHand && formData.dominant_hand === null) {
      newErrors.dominant_hand = 'Dominant hand selection is required';
    }

    return newErrors;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Auto-uppercase student_id
    if (name === 'student_id') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle dominant hand selection
  const handleDominantHandChange = (value) => {
    setFormData(prev => ({ ...prev, dominant_hand: value }));
    if (errors.dominant_hand) {
      setErrors(prev => ({ ...prev, dominant_hand: '' }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Prepare request payload
      const payload = {
        mock_exam_id: mockExam.id,
        student_id: formData.student_id,
        email: formData.email.toLowerCase(),
        mock_type: mockExam.mock_type,
        exam_date: mockExam.exam_date
      };

      // Add conditional fields
      if (requiresLocation) {
        payload.attending_location = formData.attending_location;
      }

      if (requiresHand) {
        payload.dominant_hand = formData.dominant_hand;
      }

      // Call API
      const result = await adminApi.createBookingFromExam(payload);

      if (result.success) {
        toast.success(
          `Booking created successfully for ${result.data.contact_details.name}`,
          { duration: 4000 }
        );

        onSuccess(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Failed to create booking:', error);

      // User-friendly error messages
      const errorMessage = error.message || error.error?.message || 'Unknown error';

      if (errorMessage.includes('CONTACT_NOT_FOUND') || errorMessage.includes('No contact found')) {
        toast.error('Contact not found. Please verify the student ID and email.', {
          duration: 6000
        });
      } else if (errorMessage.includes('DUPLICATE_BOOKING') || errorMessage.includes('already has a booking')) {
        toast.error('This trainee already has a booking for this exam.', {
          duration: 6000
        });
      } else if (errorMessage.includes('EXAM_NOT_ACTIVE')) {
        toast.error('Cannot create booking for inactive mock exam.', {
          duration: 6000
        });
      } else {
        toast.error(`Booking creation failed: ${errorMessage}`, {
          duration: 6000
        });
      }

      // Don't close modal on error - allow retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle escape key
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => !isSubmitting && onClose()}
        onKeyDown={handleEscapeKey}
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
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
        </Transition.Child>

        {/* Modal container */}
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  Create Booking
                </Dialog.Title>

                {/* Close button */}
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>

                {/* Exam info */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {mockExam?.mock_type}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {mockExam?.exam_date} • {mockExam?.location}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Student ID */}
                  <div>
                    <label
                      htmlFor="student_id"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Student ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      id="student_id"
                      name="student_id"
                      value={formData.student_id}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      placeholder="e.g., ABC123"
                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.student_id
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      autoComplete="off"
                    />
                    {errors.student_id && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.student_id}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      placeholder="trainee@example.com"
                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.email
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      autoComplete="email"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Conditional: Attending Location */}
                  {requiresLocation && (
                    <div>
                      <label
                        htmlFor="attending_location"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Attending Location <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="attending_location"
                        name="attending_location"
                        value={formData.attending_location}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.attending_location
                            ? 'border-red-300 dark:border-red-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <option value="">Select location...</option>
                        <option value="Mississauga">Mississauga</option>
                        <option value="Calgary">Calgary</option>
                        <option value="Vancouver">Vancouver</option>
                        <option value="Montreal">Montreal</option>
                        <option value="Richmond Hill">Richmond Hill</option>
                      </select>
                      {errors.attending_location && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.attending_location}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Conditional: Dominant Hand */}
                  {requiresHand && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dominant Hand <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => handleDominantHandChange(true)}
                          disabled={isSubmitting}
                          className={`flex-1 px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                            formData.dominant_hand === true
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          Right-handed
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDominantHandChange(false)}
                          disabled={isSubmitting}
                          className={`flex-1 px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                            formData.dominant_hand === false
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          Left-handed
                        </button>
                      </div>
                      {errors.dominant_hand && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.dominant_hand}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Warning Section */}
                  <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                          Admin Override Warning
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Creating a booking will bypass token constraints and generate an email to the trainee being booked by the admin.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </>
                      ) : (
                        'Create Booking'
                      )}
                    </button>
                  </div>
                </form>

                {/* Keyboard hint */}
                <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
                  Press Escape to cancel
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateBookingModal;
