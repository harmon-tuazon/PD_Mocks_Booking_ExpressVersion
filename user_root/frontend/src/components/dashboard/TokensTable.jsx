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
    },
    {
      label: 'CS Credits',
      value: tokens.cs_credits || 0,
    },
    {
      label: 'Mini-mock',
      value: tokens.sjmini_credits || 0,
    },
    {
      label: 'Discussion',
      value: tokens.mock_discussion_token || 0,
    }
  ];

  // Calculate total (excluding discussion tokens)
  const total = (tokens.sj_credits || 0) +
    (tokens.cs_credits || 0) +
    (tokens.sjmini_credits || 0);

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm overflow-hidden border dark:border-dark-border">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <h3 className="font-subheading text-sm font-semibold text-primary-900 dark:text-gray-100">
          Your Tokens
        </h3>
        <p className="font-body text-xs text-primary-600 dark:text-gray-400 mt-0.5">
          Current token balance
        </p>
      </div>

      {/* Token rows */}
      <div className="divide-y dark:divide-dark-border">
        {tokenRows.map((row, index) => (
          <div
            key={row.label}
            className={`px-4 py-2.5 flex items-center justify-between ${
              index % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-gray-50 dark:bg-dark-bg/50'
            }`}
          >
            {/* Label */}
            <span className="font-body text-sm text-gray-700 dark:text-gray-300">
              {row.label}
            </span>

            {/* Value */}
            <span className={`
              font-body text-sm font-semibold px-2 py-0.5 rounded-full
              ${row.value > 0
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'bg-gray-100 dark:bg-dark-hover text-gray-500 dark:text-gray-400'}
            `}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Total row */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-dark-bg">
          <span className="font-subheading text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Mock Tokens
          </span>
          <span className="font-headline text-lg font-bold text-primary-900 dark:text-gray-100">
            {total}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TokensTable;
