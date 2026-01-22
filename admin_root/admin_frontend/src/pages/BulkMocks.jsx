import React from 'react';

/**
 * Bulk Mocks Page (Preview)
 *
 * Placeholder page for bulk mock exam import functionality.
 * This feature will allow admins to create multiple mock exams by uploading a CSV file.
 */

const BulkMocks = () => {
  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bulk Mocks Import
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Create multiple mock exams by uploading a CSV file.
        </p>
      </div>

      {/* Main Content - Preview Placeholder */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-12 text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Coming Soon
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            The bulk mock exam import feature is currently under development.
            This will allow you to create multiple mock exams at once using a CSV file.
          </p>

          {/* Planned Features */}
          <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-6 text-left max-w-md mx-auto">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 text-sm">
              Planned Features
            </h3>
            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>CSV upload for batch mock exam creation</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Preview and validation before creation</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Support for all mock exam types (SJ, CS, Mini, MD)</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Error reporting with downloadable CSV</span>
              </li>
            </ul>
          </div>

          {/* Back Link */}
          <div className="mt-8">
            <a
              href="/data-management/bulk-bookings"
              className="text-primary-600 dark:text-primary-400 hover:underline text-sm flex items-center gap-2 justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Go to Bulk Bookings Import
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkMocks;
