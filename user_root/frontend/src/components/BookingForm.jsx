import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import useBookingFlow from '../hooks/useBookingFlow';
import CreditAlert from './shared/CreditAlert';
import SessionTimer from './shared/SessionTimer';
import Logo from './shared/Logo';
import InsufficientCreditsCard from './shared/InsufficientCreditsCard';
import LoggedInUserCard from './shared/LoggedInUserCard';
import LocationSelector from './shared/LocationSelector';
import ErrorDisplay from './shared/ErrorDisplay';
import TimeConflictWarning from './shared/TimeConflictWarning';
import { formatDate } from '../services/api';
import { invalidateCreditsCache } from '../hooks/useCachedCredits';

import { getUserSession, clearUserSession } from '../utils/auth';

// API base URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Convert timestamp to relative time (e.g., "just now", "5 seconds ago")
 */
const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;

  return 'a while ago';
};

const BookingForm = () => {
  const { mockExamId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const mockType = location.state?.mockType || 'Situational Judgment';
  const examDate = location.state?.examDate || '';
  const examLocation = location.state?.location || 'Mississauga';
  const startTime = location.state?.startTime || location.state?.start_time || null;
  const endTime = location.state?.endTime || location.state?.end_time || null;

  // Get user session data
  const [userSession, setUserSession] = useState(null);

  // Ref to track if credits have been verified (prevents circular dependency)
  const creditsVerifiedRef = useRef(false);

  const {
    step,
    bookingData,
    error,
    loading,
    validationErrors,
    timeConflicts,
    verifyCredits,
    submitBooking,
    updateBookingData,
    clearError,
    goBack,
    canProceed,
  } = useBookingFlow(mockExamId, mockType);

  const [dominantHand, setDominantHand] = useState(null);
  const [attendingLocation, setAttendingLocation] = useState(null);

  // Capacity polling state
  const [lastCapacityCheck, setLastCapacityCheck] = useState(null);
  const [capacityCheckInterval, setCapacityCheckInterval] = useState(null);

  // Determine which field is needed based on exam type
  const isClinicalSkills = mockType === 'Clinical Skills';
  const isLocationBased = ['Situational Judgment', 'Mini-mock'].includes(mockType);

  // Load user session on component mount
  useEffect(() => {
    // Prevent running verifyCredits multiple times (breaks circular dependency)
    if (creditsVerifiedRef.current) return;

    const userData = getUserSession();
    if (userData) {
      setUserSession(userData);

      // Auto-verify credits using session data
      verifyCredits(userData.studentId, userData.email);
      creditsVerifiedRef.current = true;
    } else {
      // No session found, redirect to login
      navigate('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Update booking data with exam details including times
  useEffect(() => {
    updateBookingData({
      mockExamId,
      mockType,
      examDate,
      startTime,
      endTime,
    });
  }, [mockExamId, mockType, examDate, startTime, endTime, updateBookingData]);

  // Background polling for capacity updates (every 10 seconds)
  useEffect(() => {
    // Only poll when on details step (after credits verified)
    if (step !== 'details' || !mockExamId) {
      return;
    }

    const checkCapacity = async () => {
      try {
        const response = await fetch(`${API_BASE}/mock-exams/${mockExamId}/capacity`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Capacity check failed:', response.status);
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setLastCapacityCheck(new Date());

          // If session became full, alert user and navigate back
          if (result.data.is_full) {
            alert('This session just became full. Please select another date.');
            navigate(`/book/exams?type=${encodeURIComponent(mockType)}`);
          }
        }
      } catch (error) {
        // Silently log errors, don't disrupt UX
        console.error('Background capacity check error:', error);
      }
    };

    // Initial check
    checkCapacity();

    // Set up polling interval (every 10 seconds)
    const interval = setInterval(checkCapacity, 10000);
    setCapacityCheckInterval(interval);

    // Cleanup on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [step, mockExamId, mockType, navigate]);

  const handleSubmitBooking = async (e) => {
    e.preventDefault();

    // Validate based on exam type
    if (isClinicalSkills && dominantHand === null) {
      alert('Please select your dominant hand');
      return;
    }

    if (isLocationBased && !attendingLocation) {
      alert('Please select your attending location');
      return;
    }

    // PRE-SUBMISSION CAPACITY CHECK: Final validation before booking
    try {
      const capacityResponse = await fetch(`${API_BASE}/mock-exams/${mockExamId}/capacity`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (capacityResponse.ok) {
        const capacityResult = await capacityResponse.json();

        if (capacityResult.success && capacityResult.data?.is_full) {
          alert('This session just became full. Please select another date.');
          navigate(`/book/exams?type=${encodeURIComponent(mockType)}`);
          return;
        }
      } else {
        console.warn('Pre-submission capacity check failed:', capacityResponse.status);
        // Continue with booking - backend will catch it
      }
    } catch (capacityError) {
      console.error('Pre-submission capacity check error:', capacityError);
      // Continue with booking - backend will catch it
    }

    // Create booking payload with all required information
    const bookingPayload = {
      name: userSession?.studentName || 'Student',
      studentId: userSession?.studentId || '',
      email: userSession?.email || ''
    };

    // Add conditional field based on exam type
    if (isClinicalSkills) {
      bookingPayload.dominant_hand = dominantHand;
    } else if (isLocationBased) {
      bookingPayload.attending_location = attendingLocation;
    }

    // Debug logging to trace the flow
    console.log('🎯 handleSubmitBooking - Payload prepared:', {
      mockType,
      isClinicalSkills,
      isLocationBased,
      attendingLocation,
      dominantHand,
      bookingPayload
    });

    // Pass the payload directly to submitBooking instead of relying on state updates
    const result = await submitBooking(bookingPayload);
    if (result) {
      console.log('🎯 Booking created successfully:', result);

      // Signal to ExistingBookingsCard that a new booking was created
      const refreshSignal = {
        studentId: userSession?.studentId,
        email: userSession?.email,
        bookingId: result.bookingId,
        timestamp: Date.now()
      };

      console.log('🎯 Setting localStorage refresh signal:', refreshSignal);
      localStorage.setItem('bookingCreated', JSON.stringify(refreshSignal));

      // Also dispatch a custom event as backup mechanism
      const event = new CustomEvent('bookingCreated', { detail: refreshSignal });
      window.dispatchEvent(event);
      console.log('📢 Dispatched custom bookingCreated event');

      // CRITICAL: Invalidate credits cache before navigation
      // This ensures ExamTypeSelector and other components fetch fresh data
      // Backend has already invalidated Redis cache, now we clear frontend cache
      invalidateCreditsCache();
      console.log('🔄 [BookingForm] Credits cache invalidated before navigation');

      // Use a fallback booking ID if the one from the result is undefined
      const fallbackBookingId = result.bookingId || `booking-${Date.now()}`;

      navigate(`/booking/confirmation/${encodeURIComponent(fallbackBookingId)}`, {
        state: { bookingData: result }
      });
    }
  };

  const handleSessionExpire = () => {
    alert('Your session has expired. Please start over.');
    clearUserSession();
    navigate('/login');
  };

  if (!userSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
          <p className="text-body font-body text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // FIX: Check if we should show the insufficient credits card instead of the booking form
  // Handle both string and object error formats for backward compatibility
  const showInsufficientCreditsCard = step === 'verify' && error && (
    // Check error code first (preferred method for object errors)
    error?.code === 'INSUFFICIENT_CREDITS' ||
    // Fallback to string checks for legacy string errors
    (typeof error === 'string' && (
      error.toLowerCase().includes('credit') ||
      error.toLowerCase().includes('insufficient') ||
      error.toLowerCase().includes('0 credits available')
    )) ||
    // Check error message property for object errors
    (error?.message && (
      error.message.toLowerCase().includes('credit') ||
      error.message.toLowerCase().includes('insufficient') ||
      error.message.toLowerCase().includes('0 credits available')
    ))
  );

  // Check if we have a duplicate booking error
  const isDuplicateBookingError = step === 'verify' && error && (
    error?.code === 'DUPLICATE_BOOKING' ||
    (typeof error === 'string' && error.toLowerCase().includes('duplicate')) ||
    (error?.message && error.message.toLowerCase().includes('duplicate'))
  );

  // Check if we have a time conflict error
  const isTimeConflictError = error && error.code === 'TIME_CONFLICT';

  if (showInsufficientCreditsCard) {
    return (
      <InsufficientCreditsCard
        mockType={mockType}
        onContactSupport={() => {
          window.open('https://ca.prepdoctors.com/academic-advisors', '_blank');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <SessionTimer
        expiryMinutes={15}
        onExpire={handleSessionExpire}
        onExtend={() => console.log('Session extended')}
      />

      <div className="container-brand-sm py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to sessions
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

          {/* User & Exam Info Grid */}
          <div className="grid-cards-2 gap-brand mb-6">
            {/* User Info */}
            <LoggedInUserCard userSession={userSession} />

            {/* Exam Details Card */}
            <div className="card-brand-primary dark:bg-dark-card dark:border-dark-border">
              <h2 className="text-lg font-headline font-semibold text-primary-900 dark:text-primary-400 mb-2">Selected Exam</h2>
              <div className="space-brand-small text-sm font-body text-primary-700 dark:text-gray-300">
                <div className="form-field-even">
                  <span className="font-medium">Type:</span>
                  <span>{mockType}</span>
                </div>
                <div className="form-field-even">
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(examDate)}</span>
                </div>
                <div className="form-field-even">
                  <span className="font-medium">Location:</span>
                  <span>{examLocation}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display with User-Friendly Messages */}
        {error && !isTimeConflictError && (
          <ErrorDisplay
            error={error}
            onDismiss={clearError}
            className="mb-6"
            showAction={true}
          />
        )}

        {/* Time Conflict Warning Modal */}
        {isTimeConflictError && timeConflicts && timeConflicts.length > 0 && (
          <TimeConflictWarning
            conflicts={timeConflicts}
            onViewBookings={() => {
              navigate('/my-bookings');
              clearError();
            }}
            onChooseDifferent={() => {
              navigate(`/book/exams?type=${encodeURIComponent(mockType)}`);
              clearError();
            }}
            onClose={clearError}
          />
        )}

        {/* Token validation and booking flow */}
        {step === 'verify' && !isDuplicateBookingError && (
          <div className="card-brand dark:bg-dark-card dark:border-dark-border animate-fade-in">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
              <p className="text-body font-body text-gray-700 dark:text-gray-300">Verifying your tokens...</p>
            </div>
          </div>
        )}

        {/* Duplicate Booking Error Card */}
        {isDuplicateBookingError && (
          <div className="card-brand dark:bg-dark-card dark:border-dark-border animate-fade-in text-center">
            {/* Warning Icon */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <svg className="w-10 h-10 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Main Message */}
            <h2 className="font-headline text-h2 font-bold text-yellow-800 dark:text-yellow-400 mb-4">
              Duplicate Booking Detected
            </h2>
            <p className="font-body text-lg text-yellow-700 dark:text-yellow-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              {error?.message || 'You already have a booking for this exam on this date. Each student can only book one session per exam date.'}
            </p>

            {/* Action Buttons */}
            <div className="space-y-4 max-w-md mx-auto">
              <button
                onClick={() => navigate('/my-bookings')}
                className="btn-brand-primary w-full text-white"
                aria-label="View your existing bookings"
              >
                <svg className="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                View My Bookings
              </button>

              <button
                onClick={() => navigate(-1)}
                className="btn-brand-secondary dark:bg-dark-hover dark:border-dark-border dark:text-gray-200 dark:hover:bg-dark-card w-full"
                aria-label="Go back to session selection"
              >
                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Sessions
              </button>
            </div>

            {/* Information Box */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-subheading font-semibold text-primary-800 dark:text-primary-200 text-sm mb-1">
                      Why am I seeing this?
                    </h3>
                    <p className="font-body text-sm text-primary-700 dark:text-primary-300 leading-relaxed">
                      Our system detected that you already have a booking for this exam type on the selected date. Please view your existing bookings or choose a different date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Booking Details - after tokens verified */}
        {step === 'details' && (
          <div className="space-y-6 animate-fade-in">
            {/* Credit Alert */}
            <CreditAlert
              credits={bookingData.credits}
              creditBreakdown={bookingData.creditBreakdown}
              mockType={mockType}
              variant={bookingData.credits > 0 ? 'success' : 'error'}
            />

            {/* Booking Form */}
            <div className="card-brand dark:bg-dark-card dark:border-dark-border">
              <h2 className="text-xl font-headline font-semibold text-navy-900 dark:text-gray-100 mb-6">
                Complete Your Booking
              </h2>

              <form onSubmit={handleSubmitBooking} className="space-brand">
                {/* Conditional Field: Dominant Hand for Clinical Skills */}
                {isClinicalSkills && (
                  <div className="form-field">
                    <label className="text-sm font-subheading font-medium text-navy-700 dark:text-gray-300 mb-1 block">
                      Which is your dominant hand? *
                    </label>
                    <div className="flex flex-col space-y-3">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="dominantHand"
                          value="true"
                          checked={dominantHand === true}
                          onChange={() => setDominantHand(true)}
                          className="form-radio h-4 w-4 text-primary-600 dark:text-primary-400 focus-brand dark:bg-dark-hover dark:border-dark-border"
                          required
                        />
                        <span className="ml-2 text-body font-body text-gray-800 dark:text-gray-200">Right-handed</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="dominantHand"
                          value="false"
                          checked={dominantHand === false}
                          onChange={() => setDominantHand(false)}
                          className="form-radio h-4 w-4 text-primary-600 dark:text-primary-400 focus-brand dark:bg-dark-hover dark:border-dark-border"
                          required
                        />
                        <span className="ml-2 text-body font-body text-gray-800 dark:text-gray-200">Left-handed</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Conditional Field: Location for SJ/Mini-mock */}
                {isLocationBased && (
                  <div className="w-full">
                    <LocationSelector
                      value={attendingLocation}
                      onChange={setAttendingLocation}
                      required
                    />
                  </div>
                )}

                {/* Availability Check Indicator */}
                {lastCapacityCheck && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center">
                    <svg className="w-4 h-4 mr-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Last availability check: {getTimeAgo(lastCapacityCheck)}
                    </span>
                  </div>
                )}

                <div className="pt-4 col-span-full">
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !canProceed ||
                      (isClinicalSkills && dominantHand === null) ||
                      (isLocationBased && !attendingLocation)
                    }
                    className="btn-brand-primary w-full"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
          </div>
        )}

        {/* Confirming State */}
        {step === 'confirming' && (
          <div className="card-brand dark:bg-dark-card dark:border-dark-border text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
            <p className="text-body font-body text-gray-700 dark:text-gray-300">Processing your booking...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingForm;