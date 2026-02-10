/**
 * TokensTable.jsx
 * Compact table showing token balances
 * Mobile-first design following PrepDoctors styling
 */
import React from 'react';

const TokensTable = ({ tokens = {} }) => {
  const tokenRows = [
    {
      label: 'SJ Credits',
      value: tokens.sj_credits || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
      textColor: 'text-primary-600 dark:text-primary-400'
    },
    {
      label: 'CS Credits',
      value: tokens.cs_credits || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      textColor: 'text-teal-600 dark:text-teal-400'
    },
    {
      label: 'Mini-mock',
      value: tokens.sjmini_credits || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      label: 'Shared',
      value: tokens.shared_mock_credits || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'Discussion',
      value: tokens.mock_discussion_token || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ),
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      textColor: 'text-orange-600 dark:text-orange-400'
    }
  ];

  // Calculate total (excluding discussion tokens)
  const total = (tokens.sj_credits || 0) +
    (tokens.cs_credits || 0) +
    (tokens.sjmini_credits || 0) +
    (tokens.shared_mock_credits || 0);

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Your Tokens
        </h3>
      </div>

      {/* Token rows */}
      <div className="divide-y dark:divide-dark-border">
        {tokenRows.map(row => (
          <div
            key={row.label}
            className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {/* Icon */}
              <div className={`
                w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0
                ${row.bgColor}
              `}>
                <span className={row.textColor}>
                  {row.icon}
                </span>
              </div>

              {/* Label */}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {row.label}
              </span>
            </div>

            {/* Value */}
            <span className={`
              text-sm font-semibold
              ${row.value > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}
            `}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Total row */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-dark-bg">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Mock Tokens
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {total}
          </span>
        </div>
      </div>

      {/* Footer helper text */}
      <div className="px-4 py-2 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Shared tokens can be used for SJ or CS exams
        </p>
      </div>
    </div>
  );
};

export default TokensTable;
