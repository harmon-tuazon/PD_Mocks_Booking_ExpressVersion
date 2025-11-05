import React from 'react';
import { formatDateShort } from '../../utils/dateUtils';

/**
 * TraineeInfoCard Component
 * Displays trainee contact information and token balances in a card format
 * Uses 3-column grid layout: Column 1 (Basic Info), Column 2 (Contact Details), Column 3 (Tokens)
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

        {/* 3-Column Grid Layout - Column 1: Basic Info, Column 2: Contact Details, Column 3: Tokens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
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

          {/* Token Balances - Column 3 */}
          {trainee.tokens && (
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Balances
              </label>
              <div className="space-y-2">
                {/* Mock Discussion Token */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Mock Discussion</span>
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {trainee.tokens.mock_discussion}
                  </span>
                </div>

                {/* Clinical Skills Token */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Clinical Skills</span>
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {trainee.tokens.clinical_skills}
                  </span>
                </div>

                {/* Situational Judgment Token */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Situational Judgment</span>
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {trainee.tokens.situational_judgment}
                  </span>
                </div>

                {/* Mini-mock Token */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Mini-mock</span>
                  <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {trainee.tokens.mini_mock}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraineeInfoCard;