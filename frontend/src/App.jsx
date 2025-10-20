import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ProtectedRoute from './components/ProtectedRoute';
import ExamTypeSelector from './components/ExamTypeSelector';
import ExamSessionsList from './components/ExamSessionsList';
import BookingForm from './components/BookingForm';
import BookingConfirmation from './components/BookingConfirmation';
import MyBookings from './components/MyBookings';
import MockDiscussions from './pages/MockDiscussions';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
import { ResponsiveLogo } from './components/shared/Logo';

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <MainLayout>
          <Routes>
            {/* Root redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Login page - no authentication required */}
            <Route path="/login" element={<LoginForm />} />

            {/* Protected booking flow - requires authentication */}
            <Route path="/book/exam-types" element={
              <ProtectedRoute>
                <ExamTypeSelector />
              </ProtectedRoute>
            } />
            <Route path="/book/exams" element={
              <ProtectedRoute>
                <ExamSessionsList />
              </ProtectedRoute>
            } />
            <Route path="/book/:mockExamId" element={
              <ProtectedRoute>
                <BookingForm />
              </ProtectedRoute>
            } />
            <Route path="/booking/confirmation/:bookingId" element={
              <ProtectedRoute>
                <BookingConfirmation />
              </ProtectedRoute>
            } />

            {/* Mock Discussions page - requires authentication */}
            <Route path="/book/discussions" element={
              <ProtectedRoute>
                <MockDiscussions />
              </ProtectedRoute>
            } />
            <Route path="/book/mock-discussion/:mockExamId" element={
              <ProtectedRoute>
                <BookingForm />
              </ProtectedRoute>
            } />

            {/* My Bookings page - requires authentication */}
            <Route path="/my-bookings" element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            } />

            {/* Error pages - no authentication required */}
            <Route path="/book/error/insufficient-credits" element={<InsufficientCreditsError />} />
            <Route path="/book/error/exam-full" element={<ExamFullError />} />
            <Route path="/book/session-expired" element={<SessionExpiredError />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </ErrorBoundary>
    </Router>
  );
}

const InsufficientCreditsError = () => (
  <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-coral-50 flex items-center justify-center">
    <div className="card max-w-md text-center">
      <div className="flex justify-center mb-6">
        <ResponsiveLogo
          size="medium"
          className="transition-opacity duration-300 hover:opacity-80"
        />
      </div>
      <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 rounded-full mb-4">
        <svg className="w-8 h-8 text-coral-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <h1 className="font-headline text-h3 font-semibold text-primary-900 mb-2">Insufficient Credits</h1>
      <p className="font-body text-base text-primary-700 mb-6">
        You don't have enough credits to book this exam. Please purchase additional credits or contact support for assistance.
      </p>
      <div className="space-y-3">
        <button className="btn-primary w-full">Purchase Credits</button>
        <a href="/book/exam-types" className="btn-outline w-full block">
          View Other Exam Types
        </a>
      </div>
    </div>
  </div>
);

const ExamFullError = () => (
  <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-coral-50 flex items-center justify-center">
    <div className="card max-w-md text-center">
      <div className="flex justify-center mb-6">
        <ResponsiveLogo
          size="medium"
          className="transition-opacity duration-300 hover:opacity-80"
        />
      </div>
      <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 rounded-full mb-4">
        <svg className="w-8 h-8 text-coral-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <h1 className="font-headline text-h3 font-semibold text-primary-900 mb-2">Exam Session Full</h1>
      <p className="font-body text-base text-primary-700 mb-6">
        Sorry, this exam session has reached capacity. Please select another available date.
      </p>
      <a href="/book/exams" className="btn-primary">
        View Other Available Dates
      </a>
    </div>
  </div>
);

const SessionExpiredError = () => (
  <div className="min-h-screen bg-gradient-to-br from-coral-50 via-white to-coral-50 flex items-center justify-center">
    <div className="card max-w-md text-center">
      <div className="flex justify-center mb-6">
        <ResponsiveLogo
          size="medium"
          className="transition-opacity duration-300 hover:opacity-80"
        />
      </div>
      <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 rounded-full mb-4">
        <svg className="w-8 h-8 text-coral-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </div>
      <h1 className="font-headline text-h3 font-semibold text-primary-900 mb-2">Session Expired</h1>
      <p className="font-body text-base text-primary-700 mb-6">
        Your booking session has expired for security reasons. Please start over to continue with your booking.
      </p>
      <a href="/login" className="btn-primary">
        Start Over
      </a>
    </div>
  </div>
);

const NotFound = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center">
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <ResponsiveLogo
          size="medium"
          className="transition-opacity duration-300 hover:opacity-80"
        />
      </div>
      <h1 className="font-headline text-6xl font-bold text-primary-300 mb-4">404</h1>
      <h2 className="font-headline text-h3 font-semibold text-primary-900 mb-2">Page Not Found</h2>
      <p className="font-body text-base text-primary-700 mb-6">
        The page you're looking for doesn't exist.
      </p>
      <a href="/login" className="btn-primary">
        Go to Login
      </a>
    </div>
  </div>
);

export default App;