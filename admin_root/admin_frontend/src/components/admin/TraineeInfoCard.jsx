import React from 'react';
import { formatDateShort } from '../../utils/dateUtils';

/**
 * TraineeInfoCard Component
 * Displays trainee contact information in a card format
 * Follows the same pattern as ExamDetailsForm with 2-column grid layout
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

        {/* 2-Column Grid Layout - Matches ExamDetailsForm pattern */}
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
      </div>
    </div>
  );
};

export default TraineeInfoCard;