/**
 * ExamDetailsForm Component
 * Displays mock exam details with support for editable and non-editable modes
 */

import StatusBadge from './StatusBadge';
import { format } from 'date-fns';
import { ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { fieldInfoMessages } from '../../utils/examValidation';

const ExamDetailsForm = ({
  exam,
  isEditing = false,
  formData = {},
  errors = {},
  touched = {},
  onFieldChange,
  onFieldBlur,
  isSaving = false
}) => {
  if (!exam && !formData) return null;

  // Use formData when editing, otherwise use exam data
  const displayData = isEditing ? formData : exam;
  if (!displayData) return null;

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

  // Helper to get field error
  const getFieldError = (fieldName) => {
    return touched[fieldName] ? errors[fieldName] : null;
  };

  // Helper for input field classes
  const getInputClasses = (fieldName) => {
    const hasError = getFieldError(fieldName);
    const baseClasses = 'block w-full rounded-md transition-colors';

    if (!isEditing) {
      return `${baseClasses} bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-gray-100 cursor-not-allowed`;
    }

    if (hasError) {
      return `${baseClasses} border-red-500 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500`;
    }

    return `${baseClasses} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500`;
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Exam Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Mock Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mock Type
          </label>
          {isEditing ? (
            <div>
              <select
                name="mock_type"
                value={displayData.mock_type || ''}
                onChange={(e) => onFieldChange('mock_type', e.target.value)}
                onBlur={() => onFieldBlur('mock_type')}
                disabled={isSaving}
                className={getInputClasses('mock_type')}
              >
                <option value="">Select a type</option>
                <option value="Situational Judgment">Situational Judgment</option>
                <option value="Clinical Skills">Clinical Skills</option>
                <option value="Mini-mock">Mini-mock</option>
              </select>
              {getFieldError('mock_type') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('mock_type')}
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMockTypeBadgeColor(displayData.mock_type)}`}>
                {displayData.mock_type}
              </span>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          {isEditing ? (
            <div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={displayData.is_active !== undefined ? displayData.is_active : true}
                  onChange={(e) => onFieldChange('is_active', e.target.checked)}
                  disabled={isSaving}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {displayData.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
              <StatusBadge status={displayData.status || (displayData.is_active ? 'active' : 'inactive')} />
            </div>
          )}
        </div>

        {/* Exam Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Exam Date
          </label>
          {isEditing ? (
            <div>
              <input
                type="date"
                name="exam_date"
                value={displayData.exam_date || ''}
                onChange={(e) => onFieldChange('exam_date', e.target.value)}
                onBlur={() => onFieldBlur('exam_date')}
                disabled={isSaving}
                className={getInputClasses('exam_date')}
              />
              {getFieldError('exam_date') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('exam_date')}
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              {formatDate(displayData.exam_date)}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Location
          </label>
          {isEditing ? (
            <div>
              <select
                name="location"
                value={displayData.location || ''}
                onChange={(e) => onFieldChange('location', e.target.value)}
                onBlur={() => onFieldBlur('location')}
                disabled={isSaving}
                className={getInputClasses('location')}
              >
                <option value="">Select a location</option>
                <option value="Mississauga">Mississauga</option>
                <option value="Vancouver">Vancouver</option>
                <option value="Montreal">Montreal</option>
                <option value="Calgary">Calgary</option>
                <option value="Richmond Hill">Richmond Hill</option>
              </select>
              {getFieldError('location') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('location')}
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              {displayData.location || 'N/A'}
            </div>
          )}
        </div>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Start Time
          </label>
          {isEditing ? (
            <div>
              <input
                type="time"
                name="start_time"
                value={displayData.start_time || ''}
                onChange={(e) => onFieldChange('start_time', e.target.value)}
                onBlur={() => onFieldBlur('start_time')}
                disabled={isSaving}
                className={getInputClasses('start_time')}
              />
              {getFieldError('start_time') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('start_time')}
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              {formatTime(displayData.start_time)}
            </div>
          )}
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Time
          </label>
          {isEditing ? (
            <div>
              <input
                type="time"
                name="end_time"
                value={displayData.end_time || ''}
                onChange={(e) => onFieldChange('end_time', e.target.value)}
                onBlur={() => onFieldBlur('end_time')}
                disabled={isSaving}
                className={getInputClasses('end_time')}
              />
              {getFieldError('end_time') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('end_time')}
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              {formatTime(displayData.end_time)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExamDetailsForm;