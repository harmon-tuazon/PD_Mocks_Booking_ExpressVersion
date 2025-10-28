/**
 * ExamDetailsForm Component
 * Displays mock exam details with support for editable and non-editable modes
 */

import StatusBadge from './StatusBadge';
import { ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { fieldInfoMessages } from '../../utils/examValidation';
import { formatTime } from '../../utils/timeFormatters';
import { formatDateLong } from '../../utils/dateUtils';

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
      'Mini-mock': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'Mock Discussion': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    };
    return typeColors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };


  // Format time for display - uses production formatter from timeFormatters.js
  // Accepts Unix timestamps (milliseconds) or ISO strings
  const formatTimeDisplay = (timestamp) => {
    if (!timestamp) return 'N/A';
    return formatTime(timestamp);
  };

  // Helper to get field error
  const getFieldError = (fieldName) => {
    return touched[fieldName] ? errors[fieldName] : null;
  };

  // Helper for input field classes
  const getInputClasses = (fieldName) => {
    const hasError = getFieldError(fieldName);
    const baseClasses = 'block w-full rounded-md shadow-sm transition-colors duration-150 px-3 py-2 text-sm focus:outline-none focus:ring-2';

    if (!isEditing) {
      return `${baseClasses} bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-gray-100 cursor-not-allowed`;
    }

    if (hasError) {
      return `${baseClasses} border-2 border-red-500 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500`;
    }

    return `${baseClasses} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-primary-500`;
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Exam Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                <option value="Mock Discussion">Mock Discussion</option>
              </select>
              {getFieldError('mock_type') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('mock_type')}
                </p>
              )}
            </div>
          ) : (
            <div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getMockTypeBadgeColor(displayData.mock_type)}`}>
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
            <div>
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
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {formatDateLong(displayData.exam_date)}
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
                <option value="Mississauga - B9">Mississauga - B9</option>
                <option value="Mississauga - Lab D">Mississauga - Lab D</option>
                <option value="Vancouver">Vancouver</option>
                <option value="Montreal">Montreal</option>
                <option value="Calgary">Calgary</option>
                <option value="Richmond Hill">Richmond Hill</option>
                <option value="Online">Online</option>
              </select>
              {getFieldError('location') && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                  {getFieldError('location')}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-900 dark:text-gray-100 font-medium">
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
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {formatTimeDisplay(displayData.start_time)}
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
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {formatTimeDisplay(displayData.end_time)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExamDetailsForm;