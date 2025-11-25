import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService, { transformLoginCreditsToCache } from '../services/api';
import { ResponsiveLogo } from './shared/Logo';
import { setUserSession } from '../utils/auth';

const LoginForm = () => {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use new login endpoint that returns ALL credit types in one call
      const response = await apiService.user.login(studentId, email);

      if (response.success) {
        const profileData = response.data;

        // Store user data in localStorage for persistence across page reloads
        const userData = {
          studentId: studentId.toUpperCase(),
          email: email.toLowerCase(),
          contactId: profileData.contact_id,
          studentName: profileData.name,
          ndeccExamDate: profileData.ndecc_exam_date
        };

        setUserSession(userData);

        // Transform and pre-populate credit cache for instant ExamTypeSelector rendering
        const transformedCredits = transformLoginCreditsToCache(profileData);

        // Store transformed credits in localStorage for useCachedCredits hook
        localStorage.setItem('creditCache', JSON.stringify({
          data: transformedCredits,
          timestamp: Date.now(),
          studentId: studentId.toUpperCase(),
          email: email.toLowerCase()
        }));

        // Redirect to exam type selection
        navigate('/book/exam-types');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.message.includes('not found') || err.message.includes('STUDENT_NOT_FOUND')) {
        setError('No user found with this Student ID. Please check your Student ID and try again.');
      } else if (err.message.includes('Email does not match') || err.message.includes('EMAIL_MISMATCH')) {
        setError('The email address does not match our records for this Student ID.');
      } else {
        setError('An error occurred while verifying your information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-dark-bg dark:via-dark-card dark:to-dark-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header with PrepDoctors Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <ResponsiveLogo
              size="xl"
              className="transition-opacity duration-300 hover:opacity-80"
              priority={true}
            />
          </div>
          <h1 className="font-headline text-h2 font-bold text-primary-900 dark:text-gray-100 mb-2">
            Prep Doctors Booking
          </h1>
          <p className="font-body text-lg text-primary-700 dark:text-gray-300">
            Enter your details to access the booking system.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-error-50 dark:bg-red-900/20 border border-error-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-error-400 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-subheading text-sm font-medium text-error-800 dark:text-red-200">
                  Authentication Error
                </h3>
                <div className="mt-2 font-body text-sm text-error-700 dark:text-red-300">
                  {error}
                </div>
              </div>
              <button
                onClick={clearError}
                className="ml-auto flex-shrink-0 text-error-400 hover:text-error-500 dark:text-red-400 dark:hover:text-red-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        <div className="card dark:bg-dark-card dark:border-dark-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="studentId" className="label dark:text-gray-200">
                Student ID
              </label>
              <input
                type="text"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                className="input dark:bg-dark-hover dark:border-dark-border dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-primary-400"
                placeholder="e.g., STU123456"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="label dark:text-gray-200">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input dark:bg-dark-hover dark:border-dark-border dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-primary-400"
                placeholder="john.doe@example.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !studentId || !email}
              className="btn-primary w-full dark:bg-primary-600 dark:hover:bg-primary-700"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center font-body text-sm text-primary-600 dark:text-gray-400">
          <p>
            Need help? Contact support at <span className="font-medium text-primary-700 dark:text-primary-400">info@prepdoctors.com</span> if you're having trouble accessing your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
