/**
 * WorkCheckSuccessPage.jsx
 * Success page shown after work check booking is confirmed
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../shared/Logo';

const WorkCheckSuccessPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const bookingResult = location.state?.bookingResult;
  const slot = location.state?.slot;
  const userData = location.state?.userData;
  const workCheckType = location.state?.workCheckType;

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

  // Redirect if no booking data
  if (!bookingResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-4">No booking data found</p>
          <button
            onClick={() => navigate('/book/work-check')}
            className="btn-primary"
          >
            Book a Work Check
          </button>
        </div>
      </div>
    );
  }

  const slotData = bookingResult.slot || slot;

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
            {bookingResult.auto_approved ? 'Booking Confirmed!' : 'Booking Submitted!'}
          </h1>
          <p className="font-body text-lg text-teal-700 dark:text-teal-400 mb-8">
            {bookingResult.message || (bookingResult.auto_approved
              ? 'Your work check has been successfully booked.'
              : 'Your booking request has been submitted and is pending confirmation.'
            )}
          </p>

          {/* Status Badge */}
          <div className="mb-6">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              bookingResult.status === 'confirmed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {bookingResult.status === 'confirmed' ? (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Confirmed
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Pending Confirmation
                </>
              )}
            </span>
          </div>

          {/* Booking Details */}
          <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-6 text-left mb-8">
            <h2 className="font-subheading text-lg font-semibold text-primary-900 dark:text-gray-100 mb-4">
              Booking Details
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Booking ID</dt>
                <dd className="font-body text-sm font-mono text-primary-900 dark:text-gray-100">
                  {bookingResult.booking_id?.substring(0, 8) || 'N/A'}...
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Type</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                  {workCheckType || bookingResult.work_check_type}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Date</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                  {formatDate(slotData?.slot_date)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Time</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                  {formatTime(slotData?.slot_time)}
                  {slotData?.end_time && ` - ${formatTime(slotData.end_time)}`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Instructor</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                  {slotData?.instructor_name || 'TBD'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Group</dt>
                <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                  {slotData?.group_name || slotData?.group_id}
                </dd>
              </div>
              {slotData?.location && (
                <div className="flex justify-between">
                  <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Location</dt>
                  <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{slotData.location}</dd>
                </div>
              )}
              {userData && (
                <>
                  <div className="flex justify-between pt-3 border-t dark:border-dark-border">
                    <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Student Name</dt>
                    <dd className="font-body text-sm text-primary-900 dark:text-gray-100">
                      {userData.firstName} {userData.lastName}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-body text-sm font-medium text-primary-600 dark:text-primary-400">Email</dt>
                    <dd className="font-body text-sm text-primary-900 dark:text-gray-100">{userData.email}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/book/work-check')}
              className="btn-primary w-full"
            >
              Book Another Work Check
            </button>
            <button
              onClick={() => navigate('/my-work-checks')}
              className="w-full px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              View My Work Checks
            </button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-8 border-t dark:border-dark-border text-sm text-gray-500 dark:text-gray-400">
            <p>
              {bookingResult.status === 'pending'
                ? 'You will receive a notification when your booking is confirmed by the instructor.'
                : 'If you need to cancel or modify this booking, please visit My Work Checks.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkCheckSuccessPage;
