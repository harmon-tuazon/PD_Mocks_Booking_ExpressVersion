/**
 * CloneSlotsModal Component
 * Modal for cloning work check slots to different instructor/groups/dates
 */

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { instructorsApi, groupsApi } from '../../services/adminApi';
import { useWorkCheckSlotMutations } from '../../hooks/useWorkCheckSlotMutations';

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const CloneSlotsModal = ({
  isOpen,
  onClose,
  selectedSlots = [],
  onSuccess
}) => {
  // Form state
  const [targetInstructor, setTargetInstructor] = useState('');
  const [targetGroups, setTargetGroups] = useState([]);
  const [dateOffset, setDateOffset] = useState(7);
  const [copyActivation, setCopyActivation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dropdown data
  const [instructors, setInstructors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const { cloneSlots } = useWorkCheckSlotMutations();

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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetInstructor('');
      setTargetGroups([]);
      setDateOffset(7);
      setCopyActivation(false);
    }
  }, [isOpen]);

  // Handle group toggle
  const handleGroupToggle = (groupId) => {
    setTargetGroups(prev => {
      const isSelected = prev.includes(groupId);
      return isSelected
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];
    });
  };

  // Handle clone
  const handleClone = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const cloneData = {
        ids: selectedSlots.map(slot => slot.id),
        date_offset_days: dateOffset,
        copy_activation_settings: copyActivation
      };

      // Only include target instructor if specified
      if (targetInstructor) {
        cloneData.target_instructor_id = targetInstructor;
      }

      // Only include target groups if specified
      if (targetGroups.length > 0) {
        cloneData.target_groups = targetGroups;
      }

      const result = await cloneSlots.mutateAsync(cloneData);

      const { created_count } = result.data || {};
      toast.success(`Successfully cloned ${created_count} slot(s)`);

      onSuccess?.();
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message || 'Failed to clone slots';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-dark-card p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <DocumentDuplicateIcon className="h-6 w-6 text-primary-500" />
                    Clone Work Check Slots
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </Dialog.Title>

                <div className="mt-4 space-y-4">
                  {/* Source slots summary */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cloning {selectedSlots.length} slot(s):
                    </p>
                    <ul className="space-y-1 max-h-24 overflow-y-auto">
                      {selectedSlots.slice(0, 3).map((slot) => (
                        <li key={slot.id} className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(slot.slot_date)} - {slot.instructor_name || 'Unknown'}
                        </li>
                      ))}
                      {selectedSlots.length > 3 && (
                        <li className="text-xs text-gray-500 italic">
                          ...and {selectedSlots.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Date offset */}
                  <div>
                    <label htmlFor="date-offset" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date Offset (days)
                    </label>
                    <input
                      type="number"
                      id="date-offset"
                      value={dateOffset}
                      onChange={(e) => setDateOffset(parseInt(e.target.value, 10) || 0)}
                      min="-365"
                      max="365"
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Positive = future, Negative = past. New slots will be dated {dateOffset} day(s) from originals.
                    </p>
                  </div>

                  {/* Target instructor (optional) */}
                  <div>
                    <label htmlFor="target-instructor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Instructor (optional)
                    </label>
                    <Select
                      value={targetInstructor || 'keep-original'}
                      onValueChange={(value) => setTargetInstructor(value === 'keep-original' ? '' : value)}
                      disabled={loadingDropdowns}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={loadingDropdowns ? 'Loading...' : 'Keep original instructor'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keep-original">Keep original instructor</SelectItem>
                        {instructors.map((instructor) => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.instructor_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target groups (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Groups (optional)
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-32 overflow-y-auto">
                      {loadingDropdowns ? (
                        <p className="text-sm text-gray-500">Loading groups...</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 mb-2">
                            Leave all unchecked to keep original groups
                          </p>
                          {groups.map((group) => (
                            <label key={group.group_id} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={targetGroups.includes(group.group_id)}
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
                    {targetGroups.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">{targetGroups.length} group(s) selected</p>
                    )}
                  </div>

                  {/* Copy activation settings */}
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyActivation}
                        onChange={(e) => setCopyActivation(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Copy activation settings
                      </span>
                    </label>
                    <p className="ml-6 text-xs text-gray-500">
                      If unchecked, cloned slots will be inactive (draft state)
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClone}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Cloning...' : `Clone ${selectedSlots.length} Slot(s)`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CloneSlotsModal;
