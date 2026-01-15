import React from 'react';

/**
 * Bulk Bookings Page
 *
 * Placeholder page for bulk booking operations.
 * This page will allow admins to perform bulk booking operations like:
 * - Import bookings from CSV/Excel
 * - Bulk create bookings for multiple trainees
 * - Bulk modify existing bookings
 */
const BulkBookings = () => {
  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bulk Bookings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Perform bulk booking operations for multiple trainees at once.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-primary-600 dark:text-primary-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Coming Soon
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          The Bulk Bookings feature is currently under development. This feature will allow you to:
        </p>
        <ul className="mt-4 text-left max-w-md mx-auto space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Import bookings from CSV or Excel files
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Create multiple bookings for a group of trainees
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Bulk update or cancel existing bookings
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Preview and validate changes before applying
          </li>
        </ul>
      </div>
    </div>
  );
};

export default BulkBookings;
