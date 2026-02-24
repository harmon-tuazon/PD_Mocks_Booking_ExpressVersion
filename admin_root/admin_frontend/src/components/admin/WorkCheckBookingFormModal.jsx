/**
 * WorkCheckBookingFormModal Component
 * Modal for creating and editing work check bookings
 */

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
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
  { value: 'marked', label: 'Marked' },
  { value: 'completed', label: 'Completed' },
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
    type: 'Work Check',
    lab: '',
    seat: ''
  });

  // Dropdown data
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Student search - button triggered pattern (like GroupDetail)
  const [studentSearch, setStudentSearch] = useState('');
  const [submittedStudentSearch, setSubmittedStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Selected slot info
  const selectedSlot = useMemo(() => {
    return slots.find(s => s.id === formData.slot_id) || null;
  }, [slots, formData.slot_id]);

  // Fetch slots for create mode (only upcoming slots)
  useEffect(() => {
    const fetchSlots = async () => {
      if (!isOpen || isEditMode) return;

      try {
        setLoadingSlots(true);
        // Get today's date in YYYY-MM-DD format for filtering
        const today = new Date().toISOString().split('T')[0];
        const response = await workCheckSlotsApi.list({
          is_active: 'true',
          date_from: today,  // Only show upcoming slots (today and future)
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

  // Fetch students only when search is submitted (button clicked)
  useEffect(() => {
    const fetchStudents = async () => {
      if (!isOpen || isEditMode) return;
      if (!submittedStudentSearch || submittedStudentSearch.length < 2) {
        setStudents([]);
        return;
      }

      try {
        setLoadingStudents(true);
        const response = await studentsApi.search({
          q: submittedStudentSearch,
          limit: 20
        });
        setStudents(response.data || []);
      } catch (error) {
        console.error('Failed to search students:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [submittedStudentSearch, isOpen, isEditMode]);

  // Initialize form data when booking changes (edit mode)
  useEffect(() => {
    if (booking) {
      setFormData({
        slot_id: booking.slot_id || '',
        student_id: booking.student_id || '',
        status: booking.status || 'pending',
        type: booking.type || 'Work Check',
        lab: booking.lab || '',
        seat: booking.seat || ''
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
        type: 'Work Check',
        lab: '',
        seat: ''
      });
      setSelectedStudent(null);
      setStudentSearch('');
      setSubmittedStudentSearch('');
      setStudents([]);
    }
  }, [booking, isOpen]);

  // Handle search button click
  const handleSearchStudents = (e) => {
    e.preventDefault();
    if (studentSearch.trim().length >= 2) {
      setSubmittedStudentSearch(studentSearch.trim());
      setSelectedStudent(null);
    }
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, student_id: student.id }));
    // Don't clear the search - keep showing results
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
        type: formData.type,
        lab: formData.lab || null,
        seat: formData.seat ? parseInt(formData.seat) : null
      });
    } else {
      // Create mode - send slot_id, student_id, type
      onSubmit(null, {
        slot_id: formData.slot_id,
        student_id: formData.student_id,
        type: formData.type,
        lab: formData.lab || null,
        seat: formData.seat ? parseInt(formData.seat) : null
      });
    }
  };

  const canSubmit = isEditMode
    ? true
    : (formData.slot_id && formData.student_id);

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-dark-card p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                >
                  {isEditMode ? 'Edit Booking' : 'Create Booking'}
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                {/* Edit Mode - Booking Info (Read-only) */}
                {isEditMode && booking && (
                  <div className="mt-6 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Lab:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {booking.lab || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Seat:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {booking.seat || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-6">
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

                    {/* Create Mode - Student Search with Button */}
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
                          <>
                            {/* Search Form with Button */}
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                  type="text"
                                  value={studentSearch}
                                  onChange={(e) => setStudentSearch(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSearchStudents(e);
                                    }
                                  }}
                                  placeholder="Search by name, email, or student ID..."
                                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleSearchStudents}
                                disabled={studentSearch.trim().length < 2}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Search
                              </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Type at least 2 characters and click Search
                            </p>

                            {/* Search Results - Only show after search is submitted */}
                            {submittedStudentSearch && (
                              <div className="mt-3">
                                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                  {loadingStudents ? (
                                    'Searching...'
                                  ) : students.length === 0 ? (
                                    'No students found.'
                                  ) : (
                                    `Found ${students.length} student(s)`
                                  )}
                                </div>
                                {!loadingStudents && students.length > 0 && (
                                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                                    {students.map((student) => (
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
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
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

                    {/* Lab */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lab <span className="text-xs text-gray-400">(A, B, C, D, E, B9)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.lab}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setFormData({ ...formData, lab: val });
                        }}
                        placeholder="e.g., A, B, C, D, E, B9"
                        maxLength={2}
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                      {formData.lab && !['A', 'B', 'C', 'D', 'E', 'B9'].includes(formData.lab) && (
                        <p className="mt-1 text-xs text-red-500">Must be one of: A, B, C, D, E, B9</p>
                      )}
                    </div>

                    {/* Seat */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Seat <span className="text-xs text-gray-400">(1-50)</span>
                      </label>
                      <input
                        type="number"
                        value={formData.seat}
                        onChange={(e) => setFormData({ ...formData, seat: e.target.value })}
                        placeholder="1-50"
                        min={1}
                        max={50}
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                      {formData.seat && (parseInt(formData.seat) < 1 || parseInt(formData.seat) > 50) && (
                        <p className="mt-1 text-xs text-red-500">Must be between 1 and 50</p>
                      )}
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default WorkCheckBookingFormModal;
