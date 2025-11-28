import React, { useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../services/api';
import TokenCard from './shared/TokenCard';
import Logo from './shared/Logo';
import { useCachedCredits } from '../hooks/useCachedCredits';
import { getUserSession } from '../utils/auth';

const BookingConfirmation = () => {
  const { bookingId: urlBookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const bookingData = location.state?.bookingData || {};

  // Import the hook and get user session
  const { credits, loading: creditsLoading, fetchCredits } = useCachedCredits();

  // CRITICAL FIX: Fetch fresh credits on mount WITHOUT dependency on bookingData
  // This ensures credits are ALWAYS refreshed when confirmation page loads
  useEffect(() => {
    const userData = getUserSession();
    if (userData) {
      console.log('🔄 [BookingConfirmation] Fetching fresh credit data on mount for:', {
        studentId: userData.studentId
      });
      // Force refresh to bypass cache and get updated token values
      fetchCredits(userData.studentId, userData.email, true);
    }
  }, []); // Empty dependency array - only run on mount

  // Listen for cache invalidation to refresh token display
  // NOTE: We ONLY listen to creditsInvalidated to avoid duplicate API calls
  // MyBookings dispatches BOTH bookingCancelled AND creditsInvalidated
  // Listening to both would cause 2x API calls and trigger rate limiting
  useEffect(() => {
    const userData = getUserSession();

    const handleCreditsInvalidated = () => {
      console.log('📢 [BookingConfirmation] Received creditsInvalidated event');

      if (userData) {
        console.log('🔄 [BookingConfirmation] Refreshing credits after cache invalidation...');
        // Force refresh to get updated token values
        fetchCredits(userData.studentId, userData.email, true);
      }
    };

    // NOTE: No localStorage signal check needed for BookingConfirmation
    // This page is only reached after booking creation, not cancellation
    // Cancellations happen in MyBookings and are handled by creditsInvalidated event

    // Listen for custom events (only creditsInvalidated)
    // NOTE: bookingCancelled is handled by creditsInvalidated to avoid duplicate calls
    window.addEventListener('creditsInvalidated', handleCreditsInvalidated);

    return () => {
      window.removeEventListener('creditsInvalidated', handleCreditsInvalidated);
    };
  }, [fetchCredits]);

  // Extract fresh credit breakdown from cache
  const freshCreditBreakdown = credits?.[bookingData.mockType]?.credit_breakdown;

  // Use fresh data if available, otherwise fall back to navigation state
  const displayCreditBreakdown = freshCreditBreakdown || bookingData.creditBreakdown;
  const displayRemainingCredits = freshCreditBreakdown
    ? (freshCreditBreakdown.specific_credits + freshCreditBreakdown.shared_credits)
    : bookingData.remainingCredits;

  // Enhanced logging to debug token display issue
  console.log('📊 BookingConfirmation credit data:', {
    navigationState: {
      remainingCredits: bookingData.remainingCredits,
      creditBreakdown: bookingData.creditBreakdown
    },
    freshData: {
      credits: credits,
      freshCreditBreakdown: freshCreditBreakdown,
      displayRemainingCredits: displayRemainingCredits
    },
    mockType: bookingData.mockType,
    isUsingFreshData: !!freshCreditBreakdown
  });

  // Warn if credit breakdown is missing from both sources
  if (displayRemainingCredits !== undefined && !displayCreditBreakdown) {
    console.warn('⚠️ BookingConfirmation: creditBreakdown is missing from both cache and navigation state.');
  }

  // Use backend-generated booking ID from bookingData state, fallback to URL parameter
  const bookingId = bookingData.bookingId || urlBookingId;

  const handleBookAnother = () => {
    console.log('🎯 [BookingConfirmation] Book Another clicked, navigating with refresh flag');
    console.log('🎯 [BookingConfirmation] Available booking data:', bookingData);

    // Also set localStorage signal for extra reliability
    // Note: bookingData has studentId (not student_id) based on useBookingFlow return
    const refreshSignal = {
      studentId: bookingData.studentId || bookingData.student_id,
      email: bookingData.email,
      bookingId: bookingData.bookingId || bookingId,
      timestamp: Date.now()
    };

    if (refreshSignal.studentId && refreshSignal.email) {
      console.log('🎯 [BookingConfirmation] Setting localStorage refresh signal:', refreshSignal);
      localStorage.setItem('bookingCreated', JSON.stringify(refreshSignal));

      // Also dispatch a custom event as backup mechanism
      const event = new CustomEvent('bookingCreated', { detail: refreshSignal });
      window.dispatchEvent(event);
      console.log('📢 [BookingConfirmation] Dispatched custom bookingCreated event');
    } else {
      console.warn('🎯 [BookingConfirmation] Missing studentId or email, cannot set refresh signal');
    }

    navigate('/book/exam-types', { state: { refreshBookings: true } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card">
      <div className="container-app py-12 max-w-2xl">
        {/* Header with Logo */}
        <div className="flex items-center justify-end mb-8">
          <Logo
            variant="horizontal"
            size="large"
            className="transition-opacity duration-300 hover:opacity-80"
            aria-label="PrepDoctors Logo"
          />
        </div>

        <div className="card dark:bg-dark-card dark:border-dark-border text-center animate-fade-in">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-100 dark:bg-teal-900/30 rounded-full">
              <svg className="w-10 h-10 text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Confirmation Message */}
          <h1 className="font-headline text-h2 font-bold text-primary-900 dark:text-gray-100 mb-4">
            Booking Confirmed!
          </h1>
          <p className="font-body text-lg text-teal-700 dark:text-teal-400 mb-8">
            {bookingData.confirmationMessage || 'Your mock exam has been successfully booked.'}
          </p>

          {/* Booking Details */}
          <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-6 text-left mb-8">
            <h2 className="font-subheading text-lg font-semibold text-primary-900 dark:text-gray-100 mb-4">
              Booking Details
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Booking ID</dt>
                <dd className="font-body text-sm font-mono text-primary-900 dark:text-gray-100">{bookingId || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Exam Type</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{bookingData.mockType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Date</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{formatDate(bookingData.examDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Location</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{bookingData.examLocation || 'Mississauga'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Student Name</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{bookingData.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Email</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{bookingData.email}</dd>
              </div>
              {displayRemainingCredits !== undefined && (
                <div className="flex justify-between pt-3 border-t dark:border-dark-border">
                  <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Remaining Tokens</dt>
                  <dd className="font-body text-sm font-semibold text-teal-700 dark:text-teal-400">
                    {creditsLoading && !freshCreditBreakdown ? (
                      <span className="text-gray-500 dark:text-gray-400">Refreshing...</span>
                    ) : (
                      displayRemainingCredits
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Remaining Credits Display */}
          {displayRemainingCredits !== undefined && bookingData.mockType && (
            <div className="mb-8">
              {/* Loading indicator while fetching fresh credits */}
              {creditsLoading && !displayCreditBreakdown && (
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Refreshing credit data...
                </div>
              )}

              {/* Warning only if BOTH sources are missing */}
              {!displayCreditBreakdown && !creditsLoading && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    ⚠️ Credit breakdown data is missing. Token display may not be accurate.
                  </p>
                </div>
              )}

              <TokenCard
                creditBreakdown={displayCreditBreakdown || {
                  specific_credits: displayRemainingCredits || 0,
                  shared_credits: 0  // Fallback if creditBreakdown is not available
                }}
                mockType={bookingData.mockType}
                compact={true}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleBookAnother}
              className="btn-primary w-full"
            >
              Book Another Exam
            </button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-8 border-t dark:border-dark-border text-sm text-gray-500 dark:text-gray-400">
            <p>
              If you need to cancel or modify this booking, please contact PrepDoctors support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;