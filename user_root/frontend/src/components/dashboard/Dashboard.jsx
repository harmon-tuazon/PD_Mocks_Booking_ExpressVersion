/**
 * Dashboard.jsx (Mobile-First Redesign v2.0)
 * Main dashboard page with quick actions and compact tables
 * Inspired by Uber Eats mobile patterns with PrepDoctors styling
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../../utils/auth';
import { useDashboard } from '../../hooks/useDashboard';
import QuickActionButtons from './QuickActionButtons';
import ActivitiesTable from './ActivitiesTable';
import TokensTable from './TokensTable';

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
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {/* Compact Header - Mobile first */}
        <div className="mb-4 md:mb-6">
          <h1 className="font-headline text-2xl md:text-3xl font-bold text-primary-900 dark:text-gray-100">
            Welcome back, {data.user.firstname}!
          </h1>
          <p className="font-body text-sm text-primary-700 dark:text-gray-400 mt-1">
            Here's what's happening this week.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <QuickActionButtons
          tokens={data.tokens}
          groupCount={data.groups?.length || 0}
        />

        {/* Main Content: Activities & Tokens */}
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
          {/* Activities Table (First on mobile) */}
          <ActivitiesTable
            activities={data.activities?.this_week || []}
          />

          {/* Tokens Table (Second on mobile) */}
          <TokensTable
            tokens={data.tokens}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Mobile-first skeleton loader
 */
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
      {/* Header skeleton */}
      <div className="mb-4 md:mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
      </div>

      {/* Quick actions section header */}
      <div className="flex items-center justify-between mb-3 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 hidden sm:block"></div>
      </div>

      {/* Quick actions skeleton */}
      <div className="mb-6 flex gap-3 overflow-hidden md:grid md:grid-cols-4 md:gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-24 md:w-auto h-24 md:h-28 bg-gray-200 dark:bg-gray-700 rounded-xl flex-shrink-0 animate-pulse"
          />
        ))}
      </div>

      {/* Tables skeleton */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {[1, 2].map(i => (
          <div key={i} className="bg-white dark:bg-dark-card rounded-lg shadow-sm animate-pulse">
            <div className="px-4 py-3 border-b dark:border-dark-border">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            </div>
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24 mb-1"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-16"></div>
                  </div>
                  <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Error display component
 */
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-dark-card shadow rounded-lg p-8 text-center max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 dark:bg-red-900/30 rounded-full mb-4">
          <svg className="w-8 h-8 text-coral-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 font-headline">
          Unable to load dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 font-body">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
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
