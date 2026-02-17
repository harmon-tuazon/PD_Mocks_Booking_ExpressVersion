/**
 * WorkCheckConfirmPage.jsx
 * Confirmation page for work check booking
 * Similar to BookingForm for mock exams
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../shared/Logo';
import apiService from '../../services/api';
import { getUserSession } from '../../utils/auth';

// Work check type options
const WORK_CHECK_TYPES = [
  { value: 'Demo', label: 'Demo', description: 'Demonstration session with instructor feedback' },
  { value: 'Work Check', label: 'Work Check', description: 'Standard work check assessment' },
  { value: 'Supervised Session', label: 'Supervised Session', description: 'Supervised practice session' }
];

// Valid lab values
const VALID_LABS = ['A', 'B', 'C', 'D', 'E', 'B9'];

const WorkCheckConfirmPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get slot and user data from navigation state
  const slot = location.state?.slot;
  const userData = location.state?.userData;

  // Local state
  const [workCheckType, setWorkCheckType] = useState(null);
  const [lab, setLab] = useState('');
  const [seat, setSeat] = useState('');
  const [labError, setLabError] = useState('');
  const [seatError, setSeatError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if no slot data
  useEffect(() => {
    if (!slot || !userData) {
      navigate('/book/work-check');
    }
  }, [slot, userData, navigate]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  // Format time range
  const formatTimeRange = (slot) => {
    if (!slot?.slot_time) return '';
    const startTime = formatTime(slot.slot_time);
    const endTime = slot.end_time ? formatTime(slot.end_time) : '';
    return endTime ? `${startTime} - ${endTime}` : startTime;
  };

  // Validate lab input on blur (auto-uppercase)
  const handleLabBlur = () => {
    if (lab.trim()) {
      const uppercased = lab.trim().toUpperCase();
      setLab(uppercased);
      if (!VALID_LABS.includes(uppercased)) {
        setLabError('Invalid lab. Valid options: A, B, C, D, E, B9');
      } else {
        setLabError('');
      }
    } else {
      setLabError('');
    }
  };

  // Validate seat input on blur
  const handleSeatBlur = () => {
    if (seat !== '') {
      const seatNum = parseInt(seat, 10);
      if (isNaN(seatNum) || seatNum < 1 || seatNum > 50) {
        setSeatError('Seat number must be between 1 and 50');
      } else {
        setSeatError('');
      }
    } else {
      setSeatError('');
    }
  };

  // Handle booking submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!workCheckType) {
      setError('Please select a work check type');
      return;
    }

    // Validate lab if provided
    let hasValidationError = false;
    if (lab.trim()) {
      const uppercased = lab.trim().toUpperCase();
      if (!VALID_LABS.includes(uppercased)) {
        setLabError('Invalid lab. Valid options: A, B, C, D, E, B9');
        hasValidationError = true;
      } else {
        setLabError('');
      }
    } else {
      setLabError('');
    }

    // Validate seat if provided
    if (seat !== '') {
      const seatNum = parseInt(seat, 10);
      if (isNaN(seatNum) || seatNum < 1 || seatNum > 50) {
        setSeatError('Seat number must be between 1 and 50');
        hasValidationError = true;
      } else {
        setSeatError('');
      }
    } else {
      setSeatError('');
    }

    if (hasValidationError) return;

    setLoading(true);
    setError(null);

    try {
      const session = getUserSession();
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }

      const response = await apiService.workChecks.create(
        session.studentId,
        session.email,
        slot.slot_id,
        workCheckType,
        lab || undefined,
        seat ? parseInt(seat) : undefined
      );

      if (response.success) {
        // Navigate to success/confirmation page
        navigate('/book/work-check/success', {
          state: {
            bookingResult: response.data,
            slot,
            userData,
            workCheckType
          }
        });
      } else {
        throw new Error(response.error?.message || 'Booking failed');
      }
    } catch (err) {
      console.error('Work check booking failed:', err);
      const errorMessage = err.response?.data?.error?.message ||
                          err.message ||
                          'Failed to create booking';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!slot || !userData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4 mx-auto"></div>
          <p className="text-body font-body text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-brand-sm py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/book/work-check')}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to slots
          </button>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-h2 font-headline font-bold text-navy-900 dark:text-gray-100">
              Complete Your Booking
            </h1>
            <Logo
              variant="horizontal"
              size="large"
              className="ml-4"
              aria-label="PrepDoctors Logo"
            />
          </div>

          {/* User & Slot Info Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* User Info Card */}
            <div className="card-brand-primary dark:bg-dark-card dark:border-dark-border">
              <h2 className="text-lg font-headline font-semibold text-primary-900 dark:text-primary-400 mb-2">Logged in as</h2>
              <div className="space-y-2 text-sm font-body text-primary-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{userData.firstName} {userData.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Student ID:</span>
                  <span>{userData.studentCode || userData.studentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Email:</span>
                  <span className="break-words text-right">{userData.email}</span>
                </div>
              </div>
            </div>

            {/* Slot Details Card */}
            <div className="card-brand-primary dark:bg-dark-card dark:border-dark-border">
              <h2 className="text-lg font-headline font-semibold text-primary-900 dark:text-primary-400 mb-2">Selected Slot</h2>
              <div className="space-y-2 text-sm font-body text-primary-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(slot.slot_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Time:</span>
                  <span>{formatTimeRange(slot)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Instructor:</span>
                  <span>{slot.instructor_name || 'TBD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Group:</span>
                  <span>{slot.group_name || slot.group_id}</span>
                </div>
                {slot.location && (
                  <div className="flex justify-between">
                    <span className="font-medium">Location:</span>
                    <span>{slot.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Booking Form */}
        <div className="card-brand dark:bg-dark-card dark:border-dark-border">
          <h2 className="text-xl font-headline font-semibold text-navy-900 dark:text-gray-100 mb-6">
            Complete Your Booking
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Work Check Type Selection */}
            <div>
              <label className="block text-sm font-subheading font-medium text-navy-700 dark:text-gray-300 mb-3">
                Please select the type of work check <span className="text-red-500">*</span>
              </label>
              <div className="grid gap-3">
                {WORK_CHECK_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`
                      relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${workCheckType === type.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-dark-hover'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="workCheckType"
                      value={type.value}
                      checked={workCheckType === type.value}
                      onChange={() => setWorkCheckType(type.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <div className={`
                        w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center flex-shrink-0
                        ${workCheckType === type.value
                          ? 'border-primary-500 dark:border-primary-400'
                          : 'border-gray-300 dark:border-gray-500'
                        }
                      `}>
                        {workCheckType === type.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-500 dark:bg-primary-400"></div>
                        )}
                      </div>
                      <div>
                        <span className={`
                          font-medium text-sm
                          ${workCheckType === type.value
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-gray-900 dark:text-gray-100'
                          }
                        `}>
                          {type.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Lab Field */}
            <div>
              <label className="block text-sm font-subheading font-medium text-navy-700 dark:text-gray-300 mb-2">
                Lab (e.g., A, B, C, D, E, B9) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lab}
                onChange={(e) => {
                  setLab(e.target.value);
                  if (labError) setLabError('');
                }}
                onBlur={handleLabBlur}
                placeholder="Enter lab (A, B, C, D, E, or B9)"
                className={`
                  w-full px-4 py-2.5 rounded-lg border text-sm
                  bg-white dark:bg-dark-hover
                  text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
                  ${labError
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-200 dark:border-gray-600'
                  }
                `}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Valid options: A, B, C, D, E, B9
              </p>
              {labError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{labError}</p>
              )}
            </div>

            {/* Seat Field */}
            <div>
              <label className="block text-sm font-subheading font-medium text-navy-700 dark:text-gray-300 mb-2">
                Seat Number <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={seat}
                onChange={(e) => {
                  setSeat(e.target.value);
                  if (seatError) setSeatError('');
                }}
                onBlur={handleSeatBlur}
                min={1}
                max={50}
                placeholder="Enter seat number (1-50)"
                className={`
                  w-full px-4 py-2.5 rounded-lg border text-sm
                  bg-white dark:bg-dark-hover
                  text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
                  ${seatError
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-200 dark:border-gray-600'
                  }
                `}
              />
              {seatError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{seatError}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !workCheckType}
                className={`
                  w-full flex items-center justify-center gap-2
                  px-6 py-3 rounded-lg font-semibold text-white
                  transition-all duration-200
                  ${loading || !workCheckType
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 shadow-lg hover:shadow-xl'
                  }
                `}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Booking...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            If you need to cancel or modify this booking after confirmation, please visit My Work Checks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkCheckConfirmPage;
