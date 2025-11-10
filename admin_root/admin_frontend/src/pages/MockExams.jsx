import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { mockExamsApi } from '../services/adminApi';
import TimeSlotBuilder from '../components/admin/TimeSlotBuilder';
import MockExamPreview from '../components/admin/MockExamPreview';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const MOCK_TYPES = [
  'Situational Judgment',
  'Clinical Skills',
  'Mini-mock',
  'Mock Discussion'
];

const LOCATIONS = [
  'Mississauga',
  'Mississauga - B9',
  'Mississauga - Lab D',
  'Calgary',
  'Vancouver',
  'Montreal',
  'Richmond Hill',
  'Online'
];

function MockExams() {
  const navigate = useNavigate();

  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    mock_type: 'Situational Judgment',
    exam_date: '',
    capacity: 15,
    location: 'Mississauga',
    is_active: true
  });
  const [capacityMode, setCapacityMode] = useState('global'); // 'global' or 'per-slot'
  const [timeSlots, setTimeSlots] = useState([{ start_time: '', end_time: '', capacity: 15 }]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Mutation for single creation
  const createSingleMutation = useMutation({
    mutationFn: (data) => mockExamsApi.createSingle(data),
    onSuccess: (data) => {
      setSuccessMessage(`Successfully created mock exam (ID: ${data.mockExam.id})`);
      setErrorMessage('');
      setShowPreview(false);
      resetForm();
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to create mock exam');
      setSuccessMessage('');
    }
  });

  // Mutation for bulk creation
  const createBulkMutation = useMutation({
    mutationFn: ({ commonProperties, timeSlots, capacityMode }) =>
      mockExamsApi.createBulk(commonProperties, timeSlots, capacityMode),
    onSuccess: (data) => {
      setSuccessMessage(
        `Successfully created ${data.created_count} mock exam${data.created_count > 1 ? 's' : ''}`
      );
      setErrorMessage('');
      setShowPreview(false);
      resetForm();
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Failed to create mock exams');
      setSuccessMessage('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Automatically detect single vs bulk based on time slots count
    if (timeSlots.length === 1) {
      // Single session - determine capacity based on mode
      const singleSessionData = {
        ...formData,
        start_time: timeSlots[0].start_time,
        end_time: timeSlots[0].end_time,
        capacity: capacityMode === 'per-slot' ? timeSlots[0].capacity : formData.capacity
      };
      createSingleMutation.mutate(singleSessionData);
    } else {
      // Multiple sessions - pass capacity mode to backend
      const commonProperties = {
        mock_type: formData.mock_type,
        exam_date: formData.exam_date,
        location: formData.location,
        is_active: formData.is_active,
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
      mock_type: 'Situational Judgment',
      exam_date: '',
      capacity: 15,
      location: 'Mississauga',
      is_active: true
    });
    setTimeSlots([{ start_time: '', end_time: '', capacity: 15 }]);
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

    return commonFieldsValid && capacityValid && timeSlotsValid;
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

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400 dark:text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</p>
              </div>
              <div className="ml-auto pl-3">
                <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{errorMessage}</p>
              </div>
              <div className="ml-auto pl-3">
                <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg">
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Common Properties */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>
                    Mock Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.mock_type}
                    onValueChange={(value) => setFormData({ ...formData, mock_type: value })}
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

                <div>
                  <Label>
                    Exam Date <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={formData.exam_date}
                    onChange={(value) => setFormData({ ...formData, exam_date: value })}
                    placeholder="Select exam date"
                    required
                  />
                </div>

                <div>
                  <Label>
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

                  {/* Capacity mode checkbox */}
                  <div className="flex items-center space-x-2 mt-1.5">
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

                  {/* Active status checkbox */}
                  <div className="flex items-center space-x-2 mt-1.5">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      Active (available for booking)
                    </label>
                  </div>

                  {/* Helper text */}
                  {capacityMode === 'global' && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      This capacity will be applied to all time slots
                    </p>
                  )}
                  {capacityMode === 'per-slot' && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Set individual capacity for each time slot below
                    </p>
                  )}
                </div>

                <div>
                  <Label>
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

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700"></div>

              {/* Time Slots - Always show TimeSlotBuilder */}
              <TimeSlotBuilder
                timeSlots={timeSlots}
                onChange={setTimeSlots}
                capacityMode={capacityMode}
                globalCapacity={formData.capacity}
              />

              {/* Preview Section */}
              {showPreview && isFormValid() && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <MockExamPreview
                    mockExamData={formData}
                    timeSlots={timeSlots}
                    mode={timeSlots.length === 1 ? 'single' : 'bulk'}
                    capacityMode={capacityMode}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
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
                    type="submit"
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
          </form>
        </div>
      </div>
    </div>
  );
}

export default MockExams;