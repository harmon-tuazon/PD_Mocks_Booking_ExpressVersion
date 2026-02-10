/**
 * Dashboard.jsx
 * Main dashboard page - new home after login
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../../utils/auth';
import { useDashboard } from '../../hooks/useDashboard';
import ThisWeekActivities from './ThisWeekActivities';
import BookingWizard from './BookingWizard';

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboard();

  // Redirect if not authenticated
  useEffect(() => {
    const session = getUserSession();
    if (!session) {
      navigate('/login');
    }
  }, [navigate]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refresh} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, {data.user.firstname}!
          </h1>
          <p className="font-body text-base sm:text-lg text-gray-600 dark:text-gray-300 mt-2">
            Here's what's happening this week.
          </p>
        </div>

        {/* This Week's Activities */}
        <ThisWeekActivities
          activities={data.activities.this_week}
          hasToday={data.activities.has_today}
        />

        {/* Booking Wizard */}
        <BookingWizard
          tokens={data.tokens}
          groups={data.groups}
          hasActiveGroups={data.has_active_groups}
        />
      </div>
    </div>
  );
};

const DashboardSkeleton = () => (
  <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Header skeleton */}
      <div className="mb-8 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-3"></div>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
      </div>

      {/* Activities section skeleton */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 mb-8 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking wizard skeleton */}
      <div className="mb-8 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ErrorDisplay = ({ error, onRetry }) => (
  <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="bg-white dark:bg-dark-card border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Unable to load dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>
    </div>
  </div>
);

export default Dashboard;
