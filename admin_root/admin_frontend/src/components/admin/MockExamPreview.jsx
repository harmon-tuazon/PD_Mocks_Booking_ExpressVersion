/**
 * MockExamPreview Component
 * Shows a preview of mock exam(s) that will be created
 */

import { formatDateLong } from '../../utils/dateUtils';
import { formatTorontoDateTime } from '../../utils/dateTimeUtils';
import { ClockIcon } from '@heroicons/react/24/outline';

const MockExamPreview = ({ mockExamData, timeSlots, mode, capacityMode = 'global' }) => {

  /**
   * Get preview items based on mode
   */
  const getPreviewItems = () => {
    if (mode === 'single') {
      return [{
        ...mockExamData,
        start_time: timeSlots[0].start_time,
        end_time: timeSlots[0].end_time,
        capacity: capacityMode === 'per-slot' ? timeSlots[0].capacity : mockExamData.capacity
      }];
    } else {
      // Bulk mode - combine common properties with each time slot
      return timeSlots.map((slot, index) => ({
        ...mockExamData,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: capacityMode === 'per-slot' ? slot.capacity : mockExamData.capacity,
        index: index + 1
      }));
    }
  };

  const previewItems = getPreviewItems();

  if (previewItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No mock exams to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Preview ({previewItems.length} session{previewItems.length > 1 ? 's' : ''})
        </h3>
        {mode === 'bulk' && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
            Bulk Creation
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {previewItems.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-750 shadow-sm hover:shadow-md dark:hover:shadow-xl transition-shadow"
          >
            {mode === 'bulk' && (
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Session {item.index}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 block">
                  {item.mock_type}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Mock Exam Type</span>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Date:</span>{' '}
                  {formatDateLong(item.exam_date)}
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Start:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{item.start_time}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">End:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{item.end_time}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm border-t border-gray-100 dark:border-gray-700 pt-2">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Location:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{item.location}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Capacity:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{item.capacity}</span>
                </div>
              </div>

              <div className="flex items-center text-xs pt-1">
                {/* Show scheduled activation if applicable */}
                {item.activation_mode === 'scheduled' && item.scheduled_activation_datetime ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Scheduled: {formatTorontoDateTime(item.scheduled_activation_datetime)}
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full ${
                    item.is_active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {item.is_active ? '● Active' : '○ Inactive'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-primary-400 dark:text-primary-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-primary-800 dark:text-primary-300">
              Review before creating
            </h3>
            <div className="mt-2 text-sm text-primary-700 dark:text-primary-400">
              <p>
                {mode === 'single'
                  ? 'You are about to create 1 mock exam session.'
                  : `You are about to create ${previewItems.length} mock exam sessions with the same properties but different time slots.`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockExamPreview;