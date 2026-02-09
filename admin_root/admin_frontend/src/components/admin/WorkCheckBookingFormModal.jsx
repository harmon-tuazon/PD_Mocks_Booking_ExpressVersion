/**
 * WorkCheckBookingFormModal Component
 * Modal for creating and editing work check bookings
 */

import { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { workCheckSlotsApi, studentsApi } from '../../services/adminApi';

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

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const WorkCheckBookingFormModal = ({
  isOpen,
  onClose,
  booking = null, // null for create mode, object for edit mode
  onSubmit,
  isSubmitting
}) => {
  const isEditMode = !!booking;

  // Form state
  const [formData, setFormData] = useState({
    slot_id: '',
    student_id: '',
    status: 'pending',
    type: 'Work Check'
  });

  // Dropdown data
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Student search
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Selected slot info
  const selectedSlot = useMemo(() => {
    return slots.find(s => s.id === formData.slot_id) || null;
  }, [slots, formData.slot_id]);

  // Fetch slots for create mode
  useEffect(() => {
    const fetchSlots = async () => {
      if (!isOpen || isEditMode) return;

      try {
        setLoadingSlots(true);
        const response = await workCheckSlotsApi.list({
          is_active: 'true',
          limit: 100,
          sort_by: 'slot_date',
          sort_order: 'asc'
        });
        setSlots(response.data || []);
      } catch (error) {
        console.error('Failed to fetch slots:', error);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [isOpen, isEditMode]);

  // Search students with debounce
  useEffect(() => {
    const searchStudents = async () => {
      if (!isOpen || isEditMode) return;
      if (studentSearch.length < 2) {
        setStudents([]);
        return;
      }

      try {
        setLoadingStudents(true);
        const response = await studentsApi.search({
          q: studentSearch,
          limit: 20
        });
        setStudents(response.data || []);
      } catch (error) {
        console.error('Failed to search students:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    const debounceTimer = setTimeout(searchStudents, 300);
    return () => clearTimeout(debounceTimer);
  }, [studentSearch, isOpen, isEditMode]);

  // Initialize form data when booking changes (edit mode)
  useEffect(() => {
    if (booking) {
      setFormData({
        slot_id: booking.slot_id || '',
        student_id: booking.student_id || '',
        status: booking.status || 'pending',
        type: booking.type || 'Work Check'
      });
      setSelectedStudent({
        id: booking.student_id,
        full_name: booking.student_name || 'Unknown',
        email: booking.student_email
      });
    } else {
      // Reset for create mode
      setFormData({
        slot_id: '',
        student_id: '',
        status: 'pending',
        type: 'Work Check'
      });
      setSelectedStudent(null);
      setStudentSearch('');
      setStudents([]);
    }
  }, [booking, isOpen]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, student_id: student.id }));
    setStudentSearch('');
    setStudents([]);
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setFormData(prev => ({ ...prev, student_id: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onSubmit) return;

    if (isEditMode) {
      // Edit mode - only send status and type
      onSubmit(booking.id, {
        status: formData.status,
        type: formData.type
      });
    } else {
      // Create mode - send slot_id, student_id, type
      onSubmit(null, {
        slot_id: formData.slot_id,
        student_id: formData.student_id,
        type: formData.type
      });
    }
  };

  const canSubmit = isEditMode
    ? true
    : (formData.slot_id && formData.student_id);

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
              {isEditMode ? 'Edit Booking' : 'Create Booking'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Edit Mode - Booking Info (Read-only) */}
          {isEditMode && booking && (
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
              {/* Create Mode - Slot Selection */}
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slot <span className="text-red-500">*</span>
                  </label>
                  {loadingSlots ? (
                    <div className="flex items-center text-sm text-gray-500">
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading slots...
                    </div>
                  ) : (
                    <Select
                      value={formData.slot_id || 'placeholder'}
                      onValueChange={(value) => value !== 'placeholder' && setFormData({ ...formData, slot_id: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a slot" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>Select a slot</SelectItem>
                        {slots.map((slot) => (
                          <SelectItem key={slot.id} value={slot.id}>
                            {formatDate(slot.slot_date)} at {slot.slot_time} - {slot.location}
                            {slot.instructor_name && ` (${slot.instructor_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Auto-approve indicator */}
                  {selectedSlot && (
                    <div className={`mt-2 flex items-center text-sm ${
                      selectedSlot.auto_approve !== false
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {selectedSlot.auto_approve !== false ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Booking will be auto-confirmed
                        </>
                      ) : (
                        <>
                          <ClockIcon className="h-4 w-4 mr-1" />
                          Booking will require approval (pending)
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Create Mode - Student Search */}
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Student <span className="text-red-500">*</span>
                  </label>

                  {selectedStudent ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {selectedStudent.full_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedStudent.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearStudent}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search by name, email, or student ID..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />

                      {/* Search Results Dropdown */}
                      {(students.length > 0 || loadingStudents) && studentSearch.length >= 2 && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                          {loadingStudents ? (
                            <div className="p-3 text-sm text-gray-500 text-center">
                              Searching...
                            </div>
                          ) : (
                            students.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => handleSelectStudent(student)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                              >
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {student.full_name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {student.email} {student.student_id && `• ${student.student_id}`}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Status (Edit mode only) */}
              {isEditMode && (
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
              )}

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

            {/* Validation message for create mode */}
            {!isEditMode && !canSubmit && (
              <p className="mt-4 text-sm text-red-500">
                Please select both a slot and a student to create a booking.
              </p>
            )}

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
                disabled={isSubmitting || !canSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </span>
                ) : (
                  isEditMode ? 'Save Changes' : 'Create Booking'
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
