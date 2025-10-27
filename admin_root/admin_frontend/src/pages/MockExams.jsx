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
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    mock_type: 'Situational Judgment',
    exam_date: '',
    capacity: 15,
    location: 'Mississauga',
    is_active: true,
    start_time: '',
    end_time: ''
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

    if (mode === 'single') {
      createSingleMutation.mutate(formData);
    } else {
      // Bulk mode
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
      is_active: true,
      start_time: '',
      end_time: ''
    });
    setTimeSlots([{ start_time: '', end_time: '' }]);
  };

  const isFormValid = () => {
    const commonFieldsValid = formData.mock_type && formData.exam_date && formData.capacity && formData.location;

    if (mode === 'single') {
      return commonFieldsValid && formData.start_time && formData.end_time;
    } else {
      // Bulk mode - check if all time slots are filled
      return commonFieldsValid && timeSlots.length > 0 && timeSlots.every(slot => slot.start_time && slot.end_time);
    }
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
          <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
              <div className="ml-auto pl-3">
                <button onClick={() => setSuccessMessage('')} className="text-green-500 hover:text-green-700">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{errorMessage}</p>
              </div>
              <div className="ml-auto pl-3">
                <button onClick={() => setErrorMessage('')} className="text-red-500 hover:text-red-700">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg">
          {/* Mode Toggle */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setMode('single');
                  setShowPreview(false);
                }}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === 'single'
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Single Session
              </button>
              <button
                onClick={() => {
                  setMode('bulk');
                  setShowPreview(false);
                }}
                className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === 'bulk'
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Multiple Sessions
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Common Properties */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mock Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.mock_type}
                    onChange={(e) => setFormData({ ...formData, mock_type: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exam Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
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
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded checked:bg-primary-600 checked:border-primary-600"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                  Active (available for booking)
                </label>
              </div>

              {/* Time Slots - Different UI for single vs bulk */}
              {mode === 'single' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Time Slots <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
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
                          value={formData.end_time}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          className="block w-full px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                          required
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-500">1 time slot will create 1 mock exam session</p>
                  </div>
                </div>
              ) : (
                <TimeSlotBuilder timeSlots={timeSlots} onChange={setTimeSlots} />
              )}

              {/* Preview Section */}
              {showPreview && isFormValid() && (
                <div className="border-t border-gray-200 pt-6">
                  <MockExamPreview
                    mockExamData={formData}
                    timeSlots={timeSlots}
                    mode={mode}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={!isFormValid() || isLoading}
                  className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isLoading}
                    className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                        {mode === 'single' ? 'Create 1 Session' : `Create ${timeSlots.length} Sessions`}
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