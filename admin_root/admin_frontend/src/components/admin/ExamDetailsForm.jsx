/**
 * ExamDetailsForm Component
 * Non-editable display of mock exam details with visual enhancements
 */

import StatusBadge from './StatusBadge';
import { format } from 'date-fns';

const ExamDetailsForm = ({ exam }) => {
  if (!exam) return null;

  // Get booking count (API returns either booked_count or total_bookings)
  const bookingCount = exam.booked_count || exam.total_bookings || 0;

  // Calculate capacity percentage
  const capacityPercentage = exam.capacity > 0
    ? Math.round((bookingCount / exam.capacity) * 100)
    : 0;

  // Determine capacity color based on percentage
  const getCapacityColor = (percentage) => {
    if (percentage <= 70) return 'bg-green-500';
    if (percentage <= 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get mock type badge color
  const getMockTypeBadgeColor = (type) => {
    const typeColors = {
      'Situational Judgment': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Clinical Skills': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Mini-mock': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    };
    return typeColors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      // Parse time string (HH:mm:ss or HH:mm)
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Exam Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mock Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mock Type
          </label>
          <div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getMockTypeBadgeColor(exam.mock_type)}`}>
              {exam.mock_type}
            </span>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <div>
            <StatusBadge status={exam.status || (exam.is_active ? 'active' : 'inactive')} />
          </div>
        </div>

        {/* Exam Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Exam Date
          </label>
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            {formatDate(exam.exam_date)}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location
          </label>
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            {exam.location || 'N/A'}
          </div>
        </div>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Time
          </label>
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            {formatTime(exam.start_time)}
          </div>
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Time
          </label>
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            {formatTime(exam.end_time)}
          </div>
        </div>

        {/* Capacity - Full Width */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Capacity
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {bookingCount} / {exam.capacity || 0} booked
              </span>
              <span className={`text-sm font-medium ${
                capacityPercentage <= 70 ? 'text-green-600 dark:text-green-400' :
                capacityPercentage <= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {capacityPercentage}% full
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${getCapacityColor(capacityPercentage)}`}
                style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {exam.notes && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <div className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-md p-3">
              {exam.notes}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="md:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div>
              <span className="font-medium">Created: </span>
              {exam.created_at ? format(new Date(exam.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
            </div>
            {exam.updated_at && (
              <div>
                <span className="font-medium">Last Updated: </span>
                {format(new Date(exam.updated_at), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamDetailsForm;