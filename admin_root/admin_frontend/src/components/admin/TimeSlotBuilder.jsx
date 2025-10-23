/**
 * TimeSlotBuilder Component
 * Allows dynamic addition and removal of time slots for bulk mock exam creation
 */

import { useState } from 'react';

const TimeSlotBuilder = ({ timeSlots, onChange }) => {
  const [errors, setErrors] = useState({});

  /**
   * Add a new empty time slot
   */
  const addTimeSlot = () => {
    onChange([...timeSlots, { start_time: '', end_time: '' }]);
  };

  /**
   * Remove a time slot by index
   */
  const removeTimeSlot = (index) => {
    const newSlots = timeSlots.filter((_, i) => i !== index);
    onChange(newSlots);

    // Clear errors for removed slot
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  };

  /**
   * Update a specific time slot
   */
  const updateTimeSlot = (index, field, value) => {
    const newSlots = timeSlots.map((slot, i) => {
      if (i === index) {
        return { ...slot, [field]: value };
      }
      return slot;
    });
    onChange(newSlots);

    // Validate the updated slot
    validateTimeSlot(index, newSlots[index]);
  };

  /**
   * Validate a single time slot
   */
  const validateTimeSlot = (index, slot) => {
    const newErrors = { ...errors };

    if (slot.start_time && slot.end_time) {
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);

      if (end <= start) {
        newErrors[index] = 'End time must be after start time';
      } else {
        delete newErrors[index];
      }
    } else {
      delete newErrors[index];
    }

    setErrors(newErrors);
  };

  /**
   * Convert time string to minutes for comparison
   */
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  /**
   * Check if there are any overlapping time slots
   */
  const checkOverlaps = () => {
    const overlaps = [];

    for (let i = 0; i < timeSlots.length; i++) {
      for (let j = i + 1; j < timeSlots.length; j++) {
        const slot1 = timeSlots[i];
        const slot2 = timeSlots[j];

        if (slot1.start_time && slot1.end_time && slot2.start_time && slot2.end_time) {
          const start1 = timeToMinutes(slot1.start_time);
          const end1 = timeToMinutes(slot1.end_time);
          const start2 = timeToMinutes(slot2.start_time);
          const end2 = timeToMinutes(slot2.end_time);

          // Check if slots overlap
          if ((start1 < end2 && end1 > start2)) {
            if (!overlaps.includes(i)) overlaps.push(i);
            if (!overlaps.includes(j)) overlaps.push(j);
          }
        }
      }
    }

    return overlaps;
  };

  const overlappingSlots = checkOverlaps();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">
          Time Slots <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={addTimeSlot}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-primary-600 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
        >
          + Add Time Slot
        </button>
      </div>

      {timeSlots.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
          <p className="text-gray-500">No time slots added yet</p>
          <button
            type="button"
            onClick={addTimeSlot}
            className="mt-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            Add your first time slot
          </button>
        </div>
      )}

      {timeSlots.length > 0 && (
        <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
          <div className="space-y-3">
            {timeSlots.map((slot, index) => (
          <div
            key={index}
            className={`flex gap-3 items-start p-3 border rounded-md ${
              overlappingSlots.includes(index)
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={slot.start_time}
                  onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)}
                  className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)}
                  className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeTimeSlot(index)}
              className="mt-7 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              title="Remove time slot"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {errors[index] && (
              <div className="col-span-2 text-sm text-red-600">
                {errors[index]}
              </div>
            )}

            {overlappingSlots.includes(index) && !errors[index] && (
              <div className="col-span-2 text-sm text-red-600">
                This time slot overlaps with another slot
              </div>
            )}
          </div>
        ))}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            {timeSlots.length} time slot{timeSlots.length > 1 ? 's' : ''} will create {timeSlots.length} mock exam session{timeSlots.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {overlappingSlots.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">
            Some time slots are overlapping. Please adjust them before proceeding.
          </p>
        </div>
      )}
    </div>
  );
};

export default TimeSlotBuilder;