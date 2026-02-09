/**
 * CloneWorkCheckBookingsModal Component
 * Modal for cloning work check bookings to new slots
 */

import { useState, useEffect } from 'react';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { workCheckSlotsApi } from '../../services/adminApi';

const CloneWorkCheckBookingsModal = ({
  isOpen,
  onClose,
  selectedBookings,
  onConfirm,
  isCloning
}) => {
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [preserveStatus, setPreserveStatus] = useState(false);
  const [preserveType, setPreserveType] = useState(true);

  const bookingCount = selectedBookings?.length || 0;

  // Fetch available slots
  useEffect(() => {
    const fetchSlots = async () => {
      if (!isOpen) return;

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
  }, [isOpen]);

  const handleSlotToggle = (slotId) => {
    setSelectedSlotIds(prev =>
      prev.includes(slotId)
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleConfirm = () => {
    if (selectedSlotIds.length > 0 && onConfirm) {
      onConfirm({
        ids: selectedBookings.map(b => b.id || b),
        target_slot_ids: selectedSlotIds,
        preserve_status: preserveStatus,
        preserve_type: preserveType
      });
    }
  };

  const handleClose = () => {
    setSelectedSlotIds([]);
    setPreserveStatus(false);
    setPreserveType(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={handleClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-dark-card shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Clone Bookings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Clone {bookingCount} booking{bookingCount !== 1 ? 's' : ''} to new slots
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Source bookings preview */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Bookings ({bookingCount})
            </h4>
            <div className="max-h-24 overflow-y-auto">
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {selectedBookings?.slice(0, 5).map((booking, index) => (
                  <li key={booking.id || index} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    {booking.student_name || booking.student_id || `Booking ${index + 1}`}
                  </li>
                ))}
                {selectedBookings?.length > 5 && (
                  <li className="text-gray-500">...and {selectedBookings.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>

          {/* Target slots selection */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Slots <span className="text-red-500">*</span> ({selectedSlotIds.length} selected)
            </h4>
            {selectedSlotIds.length === 0 && !loadingSlots && slots.length > 0 && (
              <p className="text-sm text-red-500 mb-2">
                Please select at least one target slot to clone bookings to
              </p>
            )}
            {loadingSlots ? (
              <div className="flex items-center justify-center p-4">
                <svg className="animate-spin h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-2 text-gray-500">Loading slots...</span>
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">
                No active slots available
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                {slots.map((slot) => (
                  <label
                    key={slot.id}
                    className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      selectedSlotIds.includes(slot.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSlotIds.includes(slot.id)}
                      onChange={() => handleSlotToggle(slot.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="ml-3 text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {slot.slot_date} at {slot.slot_time}
                      </span>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">
                        {slot.location} - {slot.instructor_name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="mb-6 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Clone Options
            </h4>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preserveStatus}
                onChange={(e) => setPreserveStatus(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                Preserve original status (otherwise based on slot's auto-approve setting)
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preserveType}
                onChange={(e) => setPreserveType(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                Preserve original type (otherwise defaults to "Work Check")
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCloning}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedSlotIds.length === 0 || isCloning}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCloning ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cloning...
                </span>
              ) : (
                `Clone to ${selectedSlotIds.length} Slot${selectedSlotIds.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloneWorkCheckBookingsModal;
