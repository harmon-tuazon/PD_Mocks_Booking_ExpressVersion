import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { mockExamsApi } from '../services/adminApi';
import TimeSlotBuilder from '../components/admin/TimeSlotBuilder';
import MockExamPreview from '../components/admin/MockExamPreview';

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
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    mock_type: 'Situational Judgment',
    exam_date: '',
    capacity: 15,
    location: 'Mississauga',
    is_active: true
  });
  const [timeSlots, setTimeSlots] = useState([{ start_time: '', end_time: '' }]);
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
    mutationFn: ({ commonProperties, timeSlots }) =>
      mockExamsApi.createBulk(commonProperties, timeSlots),
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
      // Single session - use the first time slot
      const singleSessionData = {
        ...formData,
        start_time: timeSlots[0].start_time,
        end_time: timeSlots[0].end_time
      };
      createSingleMutation.mutate(singleSessionData);
    } else {
      // Multiple sessions - use bulk creation
      const commonProperties = {
        mock_type: formData.mock_type,
        exam_date: formData.exam_date,
        capacity: formData.capacity,
        location: formData.location,
        is_active: formData.is_active
      };
      createBulkMutation.mutate({ commonProperties, timeSlots });
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
    setTimeSlots([{ start_time: '', end_time: '' }]);
  };

  const isFormValid = () => {
    const commonFieldsValid = formData.mock_type && formData.exam_date && formData.capacity && formData.location;
    
    // Check if all time slots are filled
    const timeSlotsValid = timeSlots.length > 0 && timeSlots.every(slot => slot.start_time && slot.end_time);
    
    return commonFieldsValid && timeSlotsValid;
  };

  const isLoading = createSingleMutation.isPending || createBulkMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        <div className="mb-8">
          <h1 className="font-headline text-h1 font-bold text-navy-900 dark:text-gray-100">Mock Exams Management</h1>
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
            <div className="space-y-6">
              {/* Common Properties */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mock Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.mock_type}
                    onChange={(e) => setFormData({ ...formData, mock_type: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  >
                    {MOCK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Exam Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="block w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded checked:bg-primary-600 checked:border-primary-600"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Active (available for booking)
                </label>
              </div>

              {/* Time Slots - Always show TimeSlotBuilder */}
              <TimeSlotBuilder timeSlots={timeSlots} onChange={setTimeSlots} />

              {/* Preview Section */}
              {showPreview && isFormValid() && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <MockExamPreview
                    mockExamData={formData}
                    timeSlots={timeSlots}
                    mode={timeSlots.length === 1 ? 'single' : 'bulk'}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={!isFormValid() || isLoading}
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