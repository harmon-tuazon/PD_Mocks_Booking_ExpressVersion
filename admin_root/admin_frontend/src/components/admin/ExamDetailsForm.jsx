/**
 * ExamDetailsForm Component
 * Displays mock exam details with support for editable and non-editable modes
 */

import StatusBadge from './StatusBadge';
import PrerequisiteExamSelector from './PrerequisiteExamSelector';
import PrerequisiteExamsList from './PrerequisiteExamsList';
import { ExclamationCircleIcon, InformationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { fieldInfoMessages } from '../../utils/examValidation';
import { formatTime } from '../../utils/timeFormatters';
import { formatDateLong } from '../../utils/dateUtils';
import { formatTorontoDateTime, convertUTCToToronto, convertTorontoToUTC } from '../../utils/dateTimeUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { TimePickerSelect } from '@/components/ui/time-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

function ExamDetailsForm({
  examData,
  isEditing,
  isSaving,
  onFieldChange,
  onFieldBlur,
  getFieldError,
  displayData,
  availableExams
}) {
  const getErrorClass = (fieldName) => {
    return getFieldError(fieldName) ? 'border-red-500' : '';
  };

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

  return (
    <div>
      {/* Exam Information Card - Compact All-in-One */}
      <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg">
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Exam Information
          </h3>

          {/* 2-Column Grid Layout - Compact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Mock Type */}
          <div>
            <Label>Mock Type</Label>
            {isEditing ? (
              <div>
                <Select
                  name="mock_type"
                  value={displayData.mock_type || ''}
                  onValueChange={(value) => {
                    onFieldChange('mock_type', value);
                    onFieldBlur('mock_type');
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className={getErrorClass('mock_type')}>
                    <SelectValue placeholder="Select a mock type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Situational Judgment">Situational Judgment</SelectItem>
                    <SelectItem value="Clinical Skills">Clinical Skills</SelectItem>
                    <SelectItem value="Mock Discussion">Mock Discussion</SelectItem>
                    <SelectItem value="Mini-mock">Mini-mock</SelectItem>
                  </SelectContent>
                </Select>
                {getFieldError('mock_type') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                    {getFieldError('mock_type')}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMockTypeBadgeColor(displayData.mock_type)}`}>
                  {displayData.mock_type || 'N/A'}
                </span>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            {isEditing ? (
              <div>
                <Select
                  name="is_active"
                  value={displayData.is_active} // Already a string: 'true', 'false', or 'scheduled'
                  onValueChange={(value) => {
                    // Keep values as strings for HubSpot
                    onFieldChange('is_active', value);
                    // Clear scheduled datetime if changing away from scheduled
                    if (value !== 'scheduled' && displayData.scheduled_activation_datetime) {
                      onFieldChange('scheduled_activation_datetime', null);
                    }
                    onFieldBlur('is_active');
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className={getErrorClass('is_active')}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
                {getFieldError('is_active') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                    {getFieldError('is_active')}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <StatusBadge status={
                  displayData.status ||
                  (displayData.is_active === 'true' ? 'active' :
                   displayData.is_active === 'scheduled' ? 'scheduled' : 'inactive')
                } />
                {/* Show scheduled datetime when status is scheduled */}
                {displayData.is_active === 'scheduled' && displayData.scheduled_activation_datetime && (
                  <div className="mt-1 text-sm text-blue-600 dark:text-blue-400 flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Activates: {formatTorontoDateTime(displayData.scheduled_activation_datetime)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Exam Date */}
          <div>
            <Label>Exam Date</Label>
            {isEditing ? (
              <div>
                <DatePicker
                  id="exam_date"
                  name="exam_date"
                  value={displayData.exam_date || ''}
                  onChange={(value) => {
                    onFieldChange('exam_date', value);
                    onFieldBlur('exam_date');
                  }}
                  placeholder="Select exam date"
                  disabled={isSaving}
                  className={getFieldError('exam_date') ? 'border-red-500' : ''}
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
            <Label>Location</Label>
            {isEditing ? (
              <div>
                <Select
                  name="location"
                  value={displayData.location || ''}
                  onValueChange={(value) => {
                    onFieldChange('location', value);
                    onFieldBlur('location');
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger className={getErrorClass('location')}>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mississauga">Mississauga</SelectItem>
                    <SelectItem value="Mississauga - B9">Mississauga - B9</SelectItem>
                    <SelectItem value="Mississauga - Lab D">Mississauga - Lab D</SelectItem>
                    <SelectItem value="Vancouver">Vancouver</SelectItem>
                    <SelectItem value="Montreal">Montreal</SelectItem>
                    <SelectItem value="Calgary">Calgary</SelectItem>
                    <SelectItem value="Richmond Hill">Richmond Hill</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
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
            <Label>Start Time</Label>
            {isEditing ? (
              <div>
                <TimePickerSelect
                  id="start_time"
                  name="start_time"
                  value={displayData.start_time || ''}
                  onChange={(value) => {
                    onFieldChange('start_time', value);
                    onFieldBlur('start_time');
                  }}
                  placeholder="Select start time"
                  disabled={isSaving}
                  minuteStep={15}
                  startHour={6}
                  endHour={23}
                  className={getFieldError('start_time') ? 'border-red-500' : ''}
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
            <Label>End Time</Label>
            {isEditing ? (
              <div>
                <TimePickerSelect
                  id="end_time"
                  name="end_time"
                  value={displayData.end_time || ''}
                  onChange={(value) => {
                    onFieldChange('end_time', value);
                    onFieldBlur('end_time');
                  }}
                  placeholder="Select end time"
                  disabled={isSaving}
                  minuteStep={15}
                  startHour={6}
                  endHour={23}
                  className={getFieldError('end_time') ? 'border-red-500' : ''}
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

          {/* Total Capacity */}
          <div>
            <Label>Total Capacity</Label>
            {isEditing ? (
              <div>
                <Input
                  type="number"
                  name="capacity"
                  value={displayData.capacity || ''}
                  onChange={(e) => onFieldChange('capacity', e.target.value)}
                  onBlur={() => onFieldBlur('capacity')}
                  disabled={isSaving}
                  placeholder="Maximum number of participants"
                  min="0"
                  className={getErrorClass('capacity')}
                />
                {getFieldError('capacity') && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                    <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                    {getFieldError('capacity')}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-gray-900 dark:text-gray-100 font-medium">
                {displayData.capacity || 'N/A'}
              </div>
            )}
          </div>

          {/* System Record ID */}
          <div>
            <Label>System Record ID</Label>
            <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
              {displayData.id || 'N/A'}
            </div>
          </div>

          {/* Scheduled Activation DateTime - Only when status is scheduled */}
          {displayData.is_active === 'scheduled' && (
            <div className="col-span-2">
              <Label>Scheduled Activation DateTime</Label>
              {isEditing ? (
                <div>
                  <DateTimePicker
                    id="scheduled_activation_datetime"
                    name="scheduled_activation_datetime"
                    value={displayData.scheduled_activation_datetime
                      ? convertUTCToToronto(displayData.scheduled_activation_datetime)
                      : ''}
                    onChange={(value) => {
                      // Convert to UTC for backend
                      const utcValue = value ? convertTorontoToUTC(value) : null;
                      onFieldChange('scheduled_activation_datetime', utcValue);
                      onFieldBlur('scheduled_activation_datetime');
                    }}
                    placeholder="Select activation date and time"
                    disabled={isSaving}
                    minDateTime={new Date().toISOString()}
                    className={getErrorClass('scheduled_activation_datetime')}
                  />
                  {getFieldError('scheduled_activation_datetime') && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                      <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                      {getFieldError('scheduled_activation_datetime')}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <InformationCircleIcon className="h-4 w-4 mr-1" />
                    The exam will automatically activate at this time
                  </p>
                </div>
              ) : (
                <div className="text-gray-900 dark:text-gray-100 font-medium flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  {displayData.scheduled_activation_datetime
                    ? formatTorontoDateTime(displayData.scheduled_activation_datetime)
                    : 'Not set'}
                </div>
              )}
            </div>
          )}

          {/* Prerequisite Exams - Only for Mock Discussion */}
          {displayData.mock_type === 'Mock Discussion' && (
            <div className="col-span-2">
              <Label className="flex items-center">
                Prerequisite Exams (Optional)
                <InformationCircleIcon className="h-4 w-4 ml-1 text-gray-400" title="Required exams for Mock Discussion" />
              </Label>
              {isEditing ? (
                <PrerequisiteExamSelector
                  mockExamId={displayData.id || examData?.id}
                  discussionExamDate={displayData.exam_date}
                  currentAssociations={displayData.prerequisite_exam_ids || []}
                  onChange={(selectedIds) => onFieldChange('prerequisite_exam_ids', selectedIds)}
                  disabled={isSaving}
                />
              ) : (
                <PrerequisiteExamsList exams={displayData.prerequisite_exams || []} />
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Additional Information Section - Notes (if present) */}
      {!isEditing && displayData.notes && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
            Notes
          </h3>
          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
            {displayData.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// Helper function for time display
function formatTimeDisplay(time) {
  if (!time) return 'N/A';
  return formatTime(time);
}

export default ExamDetailsForm;