/**
 * WorkCheckBookingFormModal Component
 * Modal for editing work check booking properties
 */

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

const TYPE_OPTIONS = [
  { value: 'Work Check', label: 'Work Check' },
  { value: 'Demo', label: 'Demo' },
  { value: 'Supervised Session', label: 'Supervised Session' }
];

const WorkCheckBookingFormModal = ({
  isOpen,
  onClose,
  booking,
  onSubmit,
  isSubmitting
}) => {
  const [formData, setFormData] = useState({
    status: 'pending',
    type: 'Work Check'
  });

  // Initialize form data when booking changes
  useEffect(() => {
    if (booking) {
      setFormData({
        status: booking.status || 'pending',
        type: booking.type || 'Work Check'
      });
    }
  }, [booking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(booking.id, formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-lg p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-dark-card shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit Booking
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Booking Info (Read-only) */}
          {booking && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Booking Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Student:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.student_name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Student ID:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.student_id}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Instructor:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.instructor_name || booking.slot?.instructor_name || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Location:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.slot?.location || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Date:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.slot?.slot_date || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Time:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {booking.slot?.slot_time || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkCheckBookingFormModal;
