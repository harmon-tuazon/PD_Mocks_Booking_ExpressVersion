/**
 * WorkCheckBookingPage.jsx
 * Main work check booking page with 2-step flow
 * Step 1: Select work check slot
 * Step 2: Confirmation
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkCheckBooking } from '../../hooks/useWorkCheckBooking';
import WorkCheckSlotSelector from './WorkCheckSlotSelector';
import WorkCheckConfirmation from './WorkCheckConfirmation';

const WorkCheckBookingPage = () => {
  const navigate = useNavigate();
  const {
    step,
    loading,
    error,
    userData,
    groups,
    existingBookingDates,
    availableSlots,
    selectedSlot,
    selectedGroupFilter,
    bookingResult,
    setSelectedGroupFilter,
    selectSlot,
    clearSelectedSlot,
    submitBooking,
    refreshSlots,
    reset,
    clearError
  } = useWorkCheckBooking();

  // Loading state
  if (step === 'loading' || (loading && step !== 'confirming')) {
    return <LoadingState />;
  }

  // Error state (initial load failure)
  if (step === 'error' && !userData) {
    return (
      <ErrorState
        error={error}
        onBack={() => navigate('/dashboard')}
      />
    );
  }

  // Confirmation step
  if (step === 'confirmed' && bookingResult) {
    return (
      <WorkCheckConfirmation
        bookingResult={bookingResult}
        onBookAnother={reset}
        onViewBookings={() => navigate('/my-work-checks')}
      />
    );
  }

  // Select step (main flow)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-gray-900 dark:text-gray-100">
            Book Work Check
          </h1>
          {userData && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-body">
              Welcome, {userData.firstName} {userData.lastName} ({userData.studentCode})
            </p>
          )}
        </div>

        {/* Groups display */}
        {groups.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">My Groups:</span>
              {groups.map(group => (
                <span
                  key={group.group_id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                >
                  {group.group_id}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={clearError}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing booking warning */}
        {existingBookingDates.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You have existing work checks on {existingBookingDates.length} date(s).
                Slots on those dates are highlighted.
              </p>
            </div>
          </div>
        )}

        {/* Slot selector */}
        <WorkCheckSlotSelector
          slots={availableSlots}
          groups={groups}
          selectedSlot={selectedSlot}
          selectedGroupFilter={selectedGroupFilter}
          existingBookingDates={existingBookingDates}
          loading={loading}
          onSelectSlot={selectSlot}
          onClearSlot={clearSelectedSlot}
          onGroupFilterChange={setSelectedGroupFilter}
          onRefresh={refreshSlots}
        />

        {/* Book button */}
        {selectedSlot && (
          <div className="mt-6 sticky bottom-4">
            <button
              onClick={submitBooking}
              disabled={loading}
              className={`
                w-full flex items-center justify-center gap-2
                px-6 py-4 rounded-xl font-semibold text-white
                transition-all duration-200
                ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'}
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Booking...
                </>
              ) : (
                <>
                  Confirm Booking
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Loading state component
 */
const LoadingState = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
    <div className="text-center">
      <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p className="text-gray-600 dark:text-gray-400">Loading work check slots...</p>
    </div>
  </div>
);

/**
 * Error state component
 */
const ErrorState = ({ error, onBack }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-8 text-center max-w-md">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 font-headline">
        Unable to Load
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 font-body">
        {error || 'Something went wrong. Please try again.'}
      </p>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>
    </div>
  </div>
);

export default WorkCheckBookingPage;
