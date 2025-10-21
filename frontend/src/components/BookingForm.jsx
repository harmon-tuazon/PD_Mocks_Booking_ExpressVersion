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
import { formatDate } from '../services/api';

import { getUserSession, clearUserSession } from '../utils/auth';
const BookingForm = () => {
  const { mockExamId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const mockType = location.state?.mockType || 'Situational Judgment';
  const examDate = location.state?.examDate || '';
  const examLocation = location.state?.location || 'Mississauga';

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
    verifyCredits,
    submitBooking,
    updateBookingData,
    clearError,
    canProceed,
  } = useBookingFlow(mockExamId, mockType);

  const [dominantHand, setDominantHand] = useState(null);
  const [attendingLocation, setAttendingLocation] = useState(null);

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

  // Update booking data with exam details
  useEffect(() => {
    updateBookingData({
      mockExamId,
      mockType,
      examDate,
    });
  }, [mockExamId, mockType, examDate, updateBookingData]);

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
          <p className="text-body font-body text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if we should show the insufficient credits card instead of the booking form
  const showInsufficientCreditsCard = step === 'verify' && error && (
    error.toLowerCase().includes('credit') ||
    error.toLowerCase().includes('insufficient') ||
    error.toLowerCase().includes('0 credits available')
  );

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
            <div className="card-brand-primary dark:bg-gray-800 dark:border-gray-700">
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
        {error && (
          <ErrorDisplay
            error={error}
            onDismiss={clearError}
            className="mb-6"
            showAction={true}
          />
        )}

        {/* Token validation and booking flow */}
        {step === 'verify' && (
          <div className="card-brand dark:bg-gray-800 dark:border-gray-700 animate-fade-in">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
              <p className="text-body font-body text-gray-700 dark:text-gray-300">Verifying your tokens...</p>
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
            <div className="card-brand dark:bg-gray-800 dark:border-gray-700">
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
                          className="form-radio h-4 w-4 text-primary-600 dark:text-primary-400 focus-brand dark:bg-gray-700 dark:border-gray-600"
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
                          className="form-radio h-4 w-4 text-primary-600 dark:text-primary-400 focus-brand dark:bg-gray-700 dark:border-gray-600"
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
          <div className="card-brand dark:bg-gray-800 dark:border-gray-700 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mb-4"></div>
            <p className="text-body font-body text-gray-700 dark:text-gray-300">Processing your booking...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingForm;