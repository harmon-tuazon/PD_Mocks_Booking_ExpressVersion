/**
 * SlotFormModal Component
 * Modal for creating and editing work check slots
 */

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePickerSelect } from '@/components/ui/time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { instructorsApi, groupsApi } from '../../services/adminApi';

const LOCATIONS = [
  { value: 'Mississauga', label: 'Mississauga' },
  { value: 'Vancouver', label: 'Vancouver' },
  { value: 'Calgary', label: 'Calgary' },
  { value: 'Montreal', label: 'Montreal' },
  { value: 'Richmond Hill', label: 'Richmond Hill' },
  { value: 'Online', label: 'Online' }
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
  { value: 120, label: '120 minutes' }
];

const SlotFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  initialData,
  mode = 'create' // 'create' or 'edit'
}) => {
  // Form state
  const [formData, setFormData] = useState({
    instructor_id: '',
    group_id: [],
    slot_date: '',
    slot_time: '',
    duration_minutes: 30,
    total_slots: 1,
    location: 'Mississauga',
    activation_mode: 'immediate',
    available_from: '',
    auto_approve: true
  });
  const [errors, setErrors] = useState({});

  // Dropdown data
  const [instructors, setInstructors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Fetch dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [instructorsRes, groupsRes] = await Promise.all([
          instructorsApi.getDropdown(),
          groupsApi.list({ limit: 100 })
        ]);
        setInstructors(instructorsRes.data || []);
        setGroups(groupsRes.data || []);
      } catch (error) {
        console.error('Failed to fetch dropdown data:', error);
      } finally {
        setLoadingDropdowns(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData && mode === 'edit') {
        setFormData({
          instructor_id: initialData.instructor_id || '',
          group_id: initialData.group_id || [],
          slot_date: initialData.slot_date || '',
          slot_time: initialData.slot_time?.slice(0, 5) || '', // Remove seconds
          duration_minutes: initialData.duration_minutes || 30,
          total_slots: initialData.total_slots || 1,
          location: initialData.location || 'Mississauga',
          activation_mode: initialData.available_from ? 'scheduled' : 'immediate',
          available_from: initialData.available_from ? new Date(initialData.available_from).toISOString().slice(0, 16) : '',
          auto_approve: initialData.auto_approve !== undefined ? initialData.auto_approve : true
        });
      } else {
        setFormData({
          instructor_id: '',
          group_id: [],
          slot_date: '',
          slot_time: '',
          duration_minutes: 30,
          total_slots: 1,
          location: 'Mississauga',
          activation_mode: 'immediate',
          available_from: '',
          auto_approve: true
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData, mode]);

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Handle group selection (multi-select)
  const handleGroupToggle = (groupId) => {
    setFormData(prev => {
      const currentGroups = prev.group_id || [];
      const isSelected = currentGroups.includes(groupId);

      return {
        ...prev,
        group_id: isSelected
          ? currentGroups.filter(id => id !== groupId)
          : [...currentGroups, groupId]
      };
    });
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.instructor_id) {
      newErrors.instructor_id = 'Instructor is required';
    }

    if (!formData.group_id || formData.group_id.length === 0) {
      newErrors.group_id = 'At least one group is required';
    }

    if (!formData.slot_date) {
      newErrors.slot_date = 'Date is required';
    }

    if (!formData.slot_time) {
      newErrors.slot_time = 'Time is required';
    }

    if (!formData.location) {
      newErrors.location = 'Location is required';
    }

    if (formData.activation_mode === 'scheduled' && !formData.available_from) {
      newErrors.available_from = 'Scheduled activation time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const submitData = {
      instructor_id: formData.instructor_id,
      group_id: formData.group_id,
      slot_date: formData.slot_date,
      slot_time: formData.slot_time,
      duration_minutes: formData.duration_minutes,
      total_slots: formData.total_slots,
      location: formData.location,
      activation_mode: formData.activation_mode,
      available_from: formData.activation_mode === 'scheduled' ? formData.available_from : null,
      auto_approve: formData.auto_approve
    };

    onSubmit(submitData);
  };

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-dark-card p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                >
                  {mode === 'create' ? 'Create Work Check Slot' : 'Edit Work Check Slot'}
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {/* Instructor Select */}
                  <div>
                    <label htmlFor="instructor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Instructor <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.instructor_id || undefined}
                      onValueChange={(value) => handleChange('instructor_id', value)}
                      disabled={loadingDropdowns || mode === 'edit'}
                    >
                      <SelectTrigger className={`mt-1 w-full ${errors.instructor_id ? 'border-red-500' : ''} ${mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder={loadingDropdowns ? 'Loading...' : 'Select an instructor'} />
                      </SelectTrigger>
                      <SelectContent>
                        {instructors.map((instructor) => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.instructor_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.instructor_id && (
                      <p className="mt-1 text-sm text-red-500">{errors.instructor_id}</p>
                    )}
                  </div>

                  {/* Group Multi-Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Groups <span className="text-red-500">*</span>
                    </label>
                    <div className={`border rounded-md p-3 max-h-40 overflow-y-auto ${
                      errors.group_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {loadingDropdowns ? (
                        <p className="text-sm text-gray-500">Loading groups...</p>
                      ) : groups.length === 0 ? (
                        <p className="text-sm text-gray-500">No groups available</p>
                      ) : (
                        <div className="space-y-2">
                          {groups.map((group) => (
                            <label key={group.group_id} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.group_id.includes(group.group_id)}
                                onChange={() => handleGroupToggle(group.group_id)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                {group.group_name || group.group_id}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.group_id && (
                      <p className="mt-1 text-sm text-red-500">{errors.group_id}</p>
                    )}
                    {formData.group_id.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">{formData.group_id.length} group(s) selected</p>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="slot_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        id="slot_date"
                        value={formData.slot_date}
                        onChange={(value) => handleChange('slot_date', value)}
                        placeholder="Select date"
                        className={`mt-1 w-full ${errors.slot_date ? 'border-red-500' : ''}`}
                      />
                      {errors.slot_date && (
                        <p className="mt-1 text-sm text-red-500">{errors.slot_date}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="slot_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Time <span className="text-red-500">*</span>
                      </label>
                      <TimePickerSelect
                        id="slot_time"
                        value={formData.slot_time}
                        onChange={(value) => handleChange('slot_time', value)}
                        placeholder="Select time"
                        className={`mt-1 w-full ${errors.slot_time ? 'border-red-500' : ''}`}
                      />
                      {errors.slot_time && (
                        <p className="mt-1 text-sm text-red-500">{errors.slot_time}</p>
                      )}
                    </div>
                  </div>

                  {/* Duration and Total Slots */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Duration
                      </label>
                      <Select
                        value={String(formData.duration_minutes)}
                        onValueChange={(value) => handleChange('duration_minutes', parseInt(value, 10))}
                      >
                        <SelectTrigger className="mt-1 w-full">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="total_slots" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total Slots
                      </label>
                      <input
                        type="number"
                        id="total_slots"
                        min="1"
                        max="10"
                        value={formData.total_slots}
                        onChange={(e) => handleChange('total_slots', parseInt(e.target.value, 10) || 1)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => handleChange('location', value)}
                    >
                      <SelectTrigger className={`mt-1 w-full ${errors.location ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.location && (
                      <p className="mt-1 text-sm text-red-500">{errors.location}</p>
                    )}
                  </div>

                  {/* Activation Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Activation
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          value="immediate"
                          checked={formData.activation_mode === 'immediate'}
                          onChange={(e) => handleChange('activation_mode', e.target.value)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Activate Immediately</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          value="scheduled"
                          checked={formData.activation_mode === 'scheduled'}
                          onChange={(e) => handleChange('activation_mode', e.target.value)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Schedule Activation</span>
                      </label>
                    </div>
                  </div>

                  {/* Scheduled Activation DateTime */}
                  {formData.activation_mode === 'scheduled' && (
                    <div>
                      <label htmlFor="available_from" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Activation Date & Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        id="available_from"
                        value={formData.available_from}
                        onChange={(e) => handleChange('available_from', e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          errors.available_from ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {errors.available_from && (
                        <p className="mt-1 text-sm text-red-500">{errors.available_from}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Slot will become visible to users at this time
                      </p>
                    </div>
                  )}

                  {/* Auto Approve Toggle */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Auto-Approve Bookings
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          When enabled, bookings for this slot are automatically confirmed
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChange('auto_approve', !formData.auto_approve)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          formData.auto_approve ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formData.auto_approve ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    {!formData.auto_approve && (
                      <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ Bookings will require manual approval by an instructor or admin
                      </p>
                    )}
                  </div>

                  {/* Submit Buttons */}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Saving...' : mode === 'create' ? 'Create Slot' : 'Update Slot'}
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

export default SlotFormModal;
