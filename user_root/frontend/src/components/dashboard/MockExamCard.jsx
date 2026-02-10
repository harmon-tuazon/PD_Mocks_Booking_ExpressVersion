/**
 * MockExamCard.jsx
 * Card for booking mock exams with token display
 */
import React from 'react';

const MockExamCard = ({ tokens, totalTokens, onBook }) => {
  const hasTokens = totalTokens > 0;

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
          <svg className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100">
          Mock Exams
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Practice your clinical and situational skills with full mock exams.
      </p>

      {hasTokens ? (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Available Tokens
            </p>
            <div className="space-y-1.5 text-sm">
              {tokens.sj_credits > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Situational Judgment:</span>
                  <span className="font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                    {tokens.sj_credits}
                  </span>
                </div>
              )}
              {tokens.cs_credits > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Clinical Skills:</span>
                  <span className="font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                    {tokens.cs_credits}
                  </span>
                </div>
              )}
              {tokens.sjmini_credits > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Mini-mock:</span>
                  <span className="font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                    {tokens.sjmini_credits}
                  </span>
                </div>
              )}
              {tokens.shared_mock_credits > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Shared:</span>
                  <span className="font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                    {tokens.shared_mock_credits}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onBook}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-card"
          >
            Book Mock Exam
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-3 font-medium">
            You don't have any tokens available.
          </p>
          <button className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Purchase Tokens
          </button>
        </div>
      )}
    </div>
  );
};

export default MockExamCard;
