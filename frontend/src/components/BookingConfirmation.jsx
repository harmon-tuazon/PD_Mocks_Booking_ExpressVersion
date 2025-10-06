import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../services/api';
import TokenCard from './shared/TokenCard';
import Logo from './shared/Logo';

const BookingConfirmation = () => {
  const { bookingId: urlBookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const bookingData = location.state?.bookingData || {};


  // Use backend-generated booking ID from bookingData state, fallback to URL parameter
  const bookingId = bookingData.bookingId || urlBookingId;

  const handleBookAnother = () => {
    navigate('/book/exam-types', { state: { refreshBookings: true } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-teal-50">
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

        <div className="card text-center animate-fade-in">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-100 rounded-full">
              <svg className="w-10 h-10 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Confirmation Message */}
          <h1 className="font-headline text-h2 font-bold text-primary-900 mb-4">
            Booking Confirmed!
          </h1>
          <p className="font-body text-lg text-teal-700 mb-8">
            {bookingData.confirmationMessage || 'Your mock exam has been successfully booked.'}
          </p>

          {/* Booking Details */}
          <div className="bg-gray-50 rounded-lg p-6 text-left mb-8">
            <h2 className="font-subheading text-lg font-semibold text-primary-900 mb-4">
              Booking Details
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Booking ID</dt>
                <dd className="font-body text-sm font-mono text-primary-900">{bookingId || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Exam Type</dt>
                <dd className="font-body text-sm text-primary-900">{bookingData.mockType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Date</dt>
                <dd className="font-body text-sm text-primary-900">{formatDate(bookingData.examDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Location</dt>
                <dd className="font-body text-sm text-primary-900">{bookingData.examLocation || 'Mississauga'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Student Name</dt>
                <dd className="font-body text-sm text-primary-900">{bookingData.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-body text-sm font-medium text-primary-600">Email</dt>
                <dd className="font-body text-sm text-primary-900">{bookingData.email}</dd>
              </div>
              {bookingData.remainingCredits !== undefined && (
                <div className="flex justify-between pt-3 border-t">
                  <dt className="font-body text-sm font-medium text-primary-600">Remaining Tokens</dt>
                  <dd className="font-body text-sm font-semibold text-teal-700">{bookingData.remainingCredits}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Remaining Credits Display */}
          {bookingData.remainingCredits !== undefined && bookingData.mockType && (
            <div className="mb-8">
              <TokenCard
                creditBreakdown={{
                  specific_credits: bookingData.remainingCredits || 0,
                  shared_credits: 0  // We don't have breakdown data in confirmation, so just show remaining as specific
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
          <div className="mt-8 pt-8 border-t text-sm text-gray-500">
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