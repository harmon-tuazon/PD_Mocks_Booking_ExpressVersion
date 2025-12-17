import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mockExamsApi } from '../services/adminApi';
import TimeSlotBuilder from '../components/admin/TimeSlotBuilder';
import MockExamPreview from '../components/admin/MockExamPreview';
import { ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { convertTorontoToUTC, formatTorontoDateTime } from '../utils/dateTimeUtils';
import {
  MOCK_TYPES,
  LOCATIONS,
  DEFAULT_LOCATION,
  MOCK_SET_OPTIONS,
  MOCK_SET_APPLICABLE_TYPES
} from '../constants/examConstants';

function MockExams() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    mock_type: MOCK_TYPES[0], // Default to first mock type
    mock_set: '', // Optional: A-H or empty
    exam_date: '',
    capacity: '',
    location: DEFAULT_LOCATION,
    is_active: 'true', // String values: 'true' | 'false' | 'scheduled' (matching HubSpot)
    activation_mode: 'immediate', // NEW: 'immediate' | 'scheduled'
    scheduled_activation_datetime: null // NEW: ISO datetime string in UTC
  });
  const [capacityMode, setCapacityMode] = useState('global'); // 'global' or 'per-slot'
  const [timeSlots, setTimeSlots] = useState([{ start_time: '', end_time: '', capacity: '' }]);

  // Mutation for single creation
  const createSingleMutation = useMutation({
    mutationFn: (data) => mockExamsApi.createSingle(data),
    onSuccess: (data) => {
      toast.success(`Successfully created mock exam (ID: ${data.mockExam.id})`, {
        duration: 4000
      });
      setShowPreview(false);
      resetForm();

      // Invalidate dashboard queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['mockExams'] });
      queryClient.invalidateQueries({ queryKey: ['mock-exam-aggregates'] });
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create mock exam', {
        duration: 6000
      });
    }
  });

  // Mutation for bulk creation
  const createBulkMutation = useMutation({
    mutationFn: ({ commonProperties, timeSlots, capacityMode }) =>
      mockExamsApi.createBulk(commonProperties, timeSlots, capacityMode),
    onSuccess: (data) => {
      toast.success(
        `Successfully created ${data.created_count} mock exam${data.created_count > 1 ? 's' : ''}`,
        { duration: 4000 }
      );
      setShowPreview(false);
      resetForm();

      // Invalidate dashboard queries to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['mockExams'] });
      queryClient.invalidateQueries({ queryKey: ['mock-exam-aggregates'] });
      queryClient.invalidateQueries({ queryKey: ['mockExamsMetrics'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create mock exams', {
        duration: 6000
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare scheduled activation datetime if needed
    let scheduledDateTime = null;
    if (formData.activation_mode === 'scheduled' && formData.scheduled_activation_datetime) {
      // Convert Toronto time to UTC for backend
      scheduledDateTime = convertTorontoToUTC(formData.scheduled_activation_datetime);
    }

    // Automatically detect single vs bulk based on time slots count
    if (timeSlots.length === 1) {
      // Single session - determine capacity based on mode
      const singleSessionData = {
        ...formData,
        start_time: timeSlots[0].start_time,
        end_time: timeSlots[0].end_time,
        capacity: capacityMode === 'per-slot' ? timeSlots[0].capacity : formData.capacity,
        // Set is_active based on activation mode
        is_active: formData.activation_mode === 'scheduled' ? 'scheduled' : formData.is_active,
        // Include scheduled datetime if applicable
        scheduled_activation_datetime: scheduledDateTime
      };
      createSingleMutation.mutate(singleSessionData);
    } else {
      // Multiple sessions - pass capacity mode to backend
      const commonProperties = {
        mock_type: formData.mock_type,
        exam_date: formData.exam_date,
        location: formData.location,
        is_active: formData.activation_mode === 'scheduled' ? 'scheduled' : formData.is_active,
        scheduled_activation_datetime: scheduledDateTime,
        // Only include capacity in commonProperties if global mode
        ...(capacityMode === 'global' && { capacity: formData.capacity })
      };
      createBulkMutation.mutate({
        commonProperties,
        timeSlots,
        capacityMode
      });
    }
  };

  const resetForm = () => {
    setFormData({
      mock_type: MOCK_TYPES[0], // Default to first mock type
      mock_set: '', // Optional: A-H or empty
      exam_date: '',
      capacity: '',
      location: DEFAULT_LOCATION,
      is_active: 'true', // String value matching HubSpot
      activation_mode: 'immediate',
      scheduled_activation_datetime: null
    });
    setTimeSlots([{ start_time: '', end_time: '', capacity: '' }]);
    setCapacityMode('global');
  };

  const isFormValid = () => {
    const commonFieldsValid = formData.mock_type && formData.exam_date && formData.location;

    // Check capacity based on mode
    const capacityValid = capacityMode === 'global'
      ? formData.capacity > 0
      : timeSlots.every(slot => slot.capacity && slot.capacity > 0);

    // Check if all time slots are filled
    const timeSlotsValid = timeSlots.length > 0 && timeSlots.every(slot => slot.start_time && slot.end_time);

    // Check scheduled activation datetime if in scheduled mode
    const scheduledDateTimeValid = formData.activation_mode === 'scheduled'
      ? !!formData.scheduled_activation_datetime
      : true;

    return commonFieldsValid && capacityValid && timeSlotsValid && scheduledDateTimeValid;
  };

  const handleBack = () => {
    navigate('/mock-exams');
  };

  const isLoading = createSingleMutation.isPending || createBulkMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
          <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">Mock Exams Management</h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">Create single or multiple mock exam sessions</p>
        </div>

        {/* Form Container with max-width */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
              {/* Basic Information Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Basic Information</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Row 1, Column 1: Mock Type */}
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Mock Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.mock_type}
                      onValueChange={(value) => setFormData({ ...formData, mock_type: value, mock_set: '' })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a mock type" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 1, Column 2: Exam Date */}
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Exam Date <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      value={formData.exam_date}
                      onChange={(value) => setFormData({ ...formData, exam_date: value })}
                      placeholder="Select exam date"
                      required
                    />
                  </div>

                  {/* Row 2, Column 1: Mock Set */}
                  <div>
                    <Label className={`${!MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      Mock Set {MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type) ? '(Optional)' : ''}
                    </Label>
                    <Select
                      value={formData.mock_set || '__none__'}
                      onValueChange={(value) => setFormData({ ...formData, mock_set: value === '__none__' ? '' : value })}
                      disabled={!MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type)}
                    >
                      <SelectTrigger className={!MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type) ? 'opacity-50 cursor-not-allowed' : ''}>
                        <SelectValue placeholder={MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type) ? 'Select a mock set (optional)' : 'Not applicable'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {MOCK_SET_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {MOCK_SET_APPLICABLE_TYPES.includes(formData.mock_type)
                        ? 'Identifies which set of cases/stations this exam uses'
                        : `Mock sets only apply to: ${MOCK_SET_APPLICABLE_TYPES.join(', ')}`}
                    </p>
                  </div>

                  {/* Row 2, Column 2: Location */}
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Location <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
            </div>

            {/* Activation Settings Section - Moved above Capacity */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Activation Settings</h3>

              {/* Activation Mode Radio Buttons */}
              <div className="space-y-4">
                <div className="flex items-start">
                  <input
                    type="radio"
                    id="immediate_activation"
                    name="activation_mode"
                    value="immediate"
                    checked={formData.activation_mode === 'immediate'}
                    onChange={(e) => setFormData({
                      ...formData,
                      activation_mode: 'immediate',
                      is_active: 'true', // String value for HubSpot
                      scheduled_activation_datetime: null
                    })}
                    className="mt-1 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <label htmlFor="immediate_activation" className="ml-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Activate Immediately
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Session becomes active as soon as it's created
                    </p>
                  </label>
                </div>

                <div className="flex items-start">
                  <input
                    type="radio"
                    id="scheduled_activation"
                    name="activation_mode"
                    value="scheduled"
                    checked={formData.activation_mode === 'scheduled'}
                    onChange={(e) => setFormData({
                      ...formData,
                      activation_mode: 'scheduled',
                      is_active: 'scheduled', // Keep as 'scheduled' string for scheduled mode
                      scheduled_activation_datetime: null
                    })}
                    className="mt-1 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <label htmlFor="scheduled_activation" className="ml-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Schedule Activation
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Session activates automatically at scheduled time
                    </p>
                  </label>
                </div>
              </div>

              {/* Scheduled DateTime Picker (Conditional) */}
              {formData.activation_mode === 'scheduled' && (
                <div className="mt-6 pl-7">
                  <Label htmlFor="scheduled_activation_datetime" className="text-gray-700 dark:text-gray-300">
                    Activation Date & Time <span className="text-red-500">*</span>
                  </Label>
                  <DateTimePicker
                    id="scheduled_activation_datetime"
                    value={formData.scheduled_activation_datetime || ''}
                    minDateTime={new Date().toISOString().slice(0, 16)} // Prevent past dates
                    onChange={(value) => setFormData({
                      ...formData,
                      scheduled_activation_datetime: value
                    })}
                    placeholder="Select activation date and time"
                    className="mt-1 w-full"
                    disabled={false}
                  />
                  <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    <span>Time zone: America/Toronto (EST/EDT)</span>
                  </div>
                  {formData.scheduled_activation_datetime && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Session will activate at: {formatTorontoDateTime(formData.scheduled_activation_datetime)}
                    </p>
                  )}
                </div>
              )}

              {/* Active status dropdown - only show if immediate mode */}
              {formData.activation_mode === 'immediate' && (
                <div className="mt-6">
                  <Label htmlFor="is_active" className="text-gray-700 dark:text-gray-300">
                    Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.is_active} // Already a string ('true' or 'false')
                    onValueChange={(value) => setFormData({ ...formData, is_active: value })} // Keep as string
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Active
                        </span>
                      </SelectItem>
                      <SelectItem value="false">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                          Inactive
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Active sessions are available for booking immediately
                  </p>
                </div>
              )}
            </div>

            {/* Capacity Settings Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Capacity Settings</h3>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Capacity <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  required
                  disabled={capacityMode === 'per-slot'}
                  className={capacityMode === 'per-slot' ? 'opacity-50 cursor-not-allowed' : ''}
                />

                {/* Helper text - moved directly under capacity input */}
                {capacityMode === 'global' && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    This capacity will be applied to all time slots
                  </p>
                )}
                {capacityMode === 'per-slot' && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Set individual capacity for each time slot below
                  </p>
                )}

                {/* Capacity mode checkbox */}
                <div className="flex items-center space-x-2 mt-3">
                  <Checkbox
                    id="per-slot-capacity"
                    checked={capacityMode === 'per-slot'}
                    onCheckedChange={(checked) => {
                      setCapacityMode(checked ? 'per-slot' : 'global');
                      if (checked) {
                        // Clear global capacity when switching to per-slot mode
                        setFormData({ ...formData, capacity: '' });
                      }
                    }}
                  />
                  <label
                    htmlFor="per-slot-capacity"
                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Set capacity per time slot
                  </label>
                </div>
              </div>
            </div>

            {/* Sessions Information Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Sessions Information</h3>
              <TimeSlotBuilder
                timeSlots={timeSlots}
                onChange={setTimeSlots}
                capacityMode={capacityMode}
                globalCapacity={formData.capacity}
              />
            </div>

            {/* Preview Section */}
            {showPreview && isFormValid() && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Preview</h3>
                <MockExamPreview
                  mockExamData={formData}
                  timeSlots={timeSlots}
                  mode={timeSlots.length === 1 ? 'single' : 'bulk'}
                  capacityMode={capacityMode}
                />
              </div>
            )}

            {/* Action Buttons - placed within form after Preview Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={isLoading}
                  className="inline-flex items-center px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isLoading}
                    className="inline-flex items-center px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isFormValid() || isLoading}
                    className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        Create {timeSlots.length} {timeSlots.length === 1 ? 'Session' : 'Sessions'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MockExams;