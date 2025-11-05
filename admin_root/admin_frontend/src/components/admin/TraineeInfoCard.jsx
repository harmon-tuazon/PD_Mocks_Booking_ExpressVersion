import React from 'react';
import { formatDateShort } from '../../utils/dateUtils';

/**
 * TraineeInfoCard Component
 * Displays trainee contact information and token balances in a card format
 * Uses 2-column grid layout for basic info with horizontal token badges below
 */
const TraineeInfoCard = ({ trainee }) => {
  if (!trainee) return null;

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return 'N/A';
    // Remove any non-digits
    const cleaned = phone.replace(/\D/g, '');
    // Format as (XXX) XXX-XXXX if US number
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone || 'N/A';
  };

  // Helper function to display field value or placeholder
  const displayField = (value, placeholder = 'N/A') => {
    return value || placeholder;
  };

  return (
    <div className="bg-white dark:bg-dark-card shadow-sm dark:shadow-gray-900/50 rounded-lg">
      <div className="p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Trainee Information
        </h3>

        {/* 2-Column Grid Layout for Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <div className="text-base text-gray-900 dark:text-gray-100 font-medium">
              {displayField(`${trainee.firstname || ''} ${trainee.lastname || ''}`.trim(), 'N/A')}
            </div>
          </div>

          {/* Student ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Student ID
            </label>
            <div className="text-base text-gray-900 dark:text-gray-100">
              {displayField(trainee.student_id)}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <div className="text-base text-gray-900 dark:text-gray-100">
              {trainee.email ? (
                <a
                  href={`mailto:${trainee.email}`}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {trainee.email}
                </a>
              ) : (
                'N/A'
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <div className="text-base text-gray-900 dark:text-gray-100">
              {formatPhoneNumber(trainee.phone)}
            </div>
          </div>

          {/* NDECC Exam Date */}
          {trainee.ndecc_exam_date && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                NDECC Exam Date
              </label>
              <div className="text-base text-gray-900 dark:text-gray-100">
                {formatDateShort(trainee.ndecc_exam_date)}
              </div>
            </div>
          )}

          {/* HubSpot Contact ID (for debugging/admin purposes) */}
          {trainee.contactId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact ID
              </label>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {trainee.contactId}
              </div>
            </div>
          )}
        </div>

        {/* Token Balances - Horizontal Badges (Option 1) */}
        {trainee.tokens && (
          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Token Balances
            </label>
            <div className="flex flex-wrap gap-3">
              {/* Mock Discussion Badge */}
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Mock Discussion:
                </span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-white bg-blue-600 dark:bg-blue-500 rounded-md">
                  {trainee.tokens.mock_discussion}
                </span>
              </div>

              {/* Clinical Skills Badge */}
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm font-medium text-green-900 dark:text-green-200">
                  Clinical Skills:
                </span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-white bg-green-600 dark:bg-green-500 rounded-md">
                  {trainee.tokens.clinical_skills}
                </span>
              </div>

              {/* Situational Judgment Badge */}
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                  Situational Judgment:
                </span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-white bg-purple-600 dark:bg-purple-500 rounded-md">
                  {trainee.tokens.situational_judgment}
                </span>
              </div>

              {/* Mini-mock Badge */}
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 rounded-lg border border-orange-200 dark:border-orange-800">
                <span className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Mini-mock:
                </span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-white bg-orange-600 dark:bg-orange-500 rounded-md">
                  {trainee.tokens.mini_mock}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraineeInfoCard;