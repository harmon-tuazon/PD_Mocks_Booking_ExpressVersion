import React, { useState, useEffect } from 'react';
import { formatDateShort } from '../../utils/dateUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useTokenEditMutation } from '../../hooks/useTokenEditMutation';

/**
 * TraineeInfoCard Component
 * Displays trainee contact information and token balances in a card format
 * Uses 2-column grid layout for basic info with horizontal token badges below
 */
const TraineeInfoCard = ({ trainee }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTokens, setEditedTokens] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Import the token edit mutation hook
  const tokenEditMutation = useTokenEditMutation(trainee?.contactId);

  // Initialize edited tokens when trainee changes or edit mode is entered
  useEffect(() => {
    if (trainee?.tokens) {
      setEditedTokens({
        mock_discussion: trainee.tokens.mock_discussion || 0,
        clinical_skills: trainee.tokens.clinical_skills || 0,
        situational_judgment: trainee.tokens.situational_judgment || 0,
        mini_mock: trainee.tokens.mini_mock || 0,
        shared_mock: trainee.tokens.shared_mock || 0
      });
    }
  }, [trainee, isEditMode]);

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

  // Check if there are any changes
  const hasChanges = () => {
    if (!trainee?.tokens) return false;

    // Convert empty strings to 0 for comparison
    const normalizeValue = (val) => val === '' ? 0 : val;

    return (
      normalizeValue(editedTokens.mock_discussion) !== trainee.tokens.mock_discussion ||
      normalizeValue(editedTokens.clinical_skills) !== trainee.tokens.clinical_skills ||
      normalizeValue(editedTokens.situational_judgment) !== trainee.tokens.situational_judgment ||
      normalizeValue(editedTokens.mini_mock) !== trainee.tokens.mini_mock ||
      normalizeValue(editedTokens.shared_mock) !== (trainee.tokens.shared_mock || 0)
    );
  };

  // Handle save tokens
  const handleSaveTokens = async () => {
    setIsSubmitting(true);
    try {
      // Normalize empty strings to 0 before sending
      const normalizedTokens = {
        mock_discussion: editedTokens.mock_discussion === '' ? 0 : editedTokens.mock_discussion,
        clinical_skills: editedTokens.clinical_skills === '' ? 0 : editedTokens.clinical_skills,
        situational_judgment: editedTokens.situational_judgment === '' ? 0 : editedTokens.situational_judgment,
        mini_mock: editedTokens.mini_mock === '' ? 0 : editedTokens.mini_mock,
        shared_mock: editedTokens.shared_mock === '' ? 0 : editedTokens.shared_mock
      };

      await tokenEditMutation.mutateAsync(normalizedTokens);
      setIsEditMode(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Failed to save tokens:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditMode(false);
    // Reset edited tokens to original values
    if (trainee?.tokens) {
      setEditedTokens({
        mock_discussion: trainee.tokens.mock_discussion || 0,
        clinical_skills: trainee.tokens.clinical_skills || 0,
        situational_judgment: trainee.tokens.situational_judgment || 0,
        mini_mock: trainee.tokens.mini_mock || 0,
        shared_mock: trainee.tokens.shared_mock || 0
      });
    }
  };

  // Handle token input change
  const handleTokenChange = (tokenType, value) => {
    // Handle empty string - allow it temporarily during typing
    if (value === '' || value === null || value === undefined) {
      setEditedTokens(prev => ({
        ...prev,
        [tokenType]: ''
      }));
      return;
    }

    // Parse and clamp the value
    const parsedValue = parseInt(value, 10);

    // If parsing fails or results in NaN, set to 0
    if (isNaN(parsedValue)) {
      setEditedTokens(prev => ({
        ...prev,
        [tokenType]: 0
      }));
      return;
    }

    // Ensure non-negative
    const clampedValue = Math.max(0, parsedValue);
    setEditedTokens(prev => ({
      ...prev,
      [tokenType]: clampedValue
    }));
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

        {/* Token Balances - With Inline Editing */}
        {trainee.tokens && (
          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Token Balances
              </label>
              
              {/* Edit/Save/Cancel Buttons */}
              <div className="flex items-center gap-2">
                {!isEditMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                    disabled={isSubmitting}
                  >
                    Edit Tokens
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSaveTokens}
                      disabled={isSubmitting || !hasChanges()}
                      size="sm"
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Token Fields - Always show as inputs in edit mode */}
            <div className="flex flex-wrap gap-3">
              {/* Mock Discussion */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mock Discussion:
                </label>
                {isEditMode ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedTokens.mock_discussion}
                    onChange={(e) => handleTokenChange('mock_discussion', e.target.value)}
                    className="w-20 h-8 text-sm"
                    disabled={isSubmitting}
                  />
                ) : (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded-md">
                    {trainee.tokens.mock_discussion}
                  </span>
                )}
              </div>

              {/* Clinical Skills */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Clinical Skills:
                </label>
                {isEditMode ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedTokens.clinical_skills}
                    onChange={(e) => handleTokenChange('clinical_skills', e.target.value)}
                    className="w-20 h-8 text-sm"
                    disabled={isSubmitting}
                  />
                ) : (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded-md">
                    {trainee.tokens.clinical_skills}
                  </span>
                )}
              </div>

              {/* Situational Judgment */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Situational Judgment:
                </label>
                {isEditMode ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedTokens.situational_judgment}
                    onChange={(e) => handleTokenChange('situational_judgment', e.target.value)}
                    className="w-20 h-8 text-sm"
                    disabled={isSubmitting}
                  />
                ) : (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded-md">
                    {trainee.tokens.situational_judgment}
                  </span>
                )}
              </div>

              {/* Mini-mock */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mini-mock:
                </label>
                {isEditMode ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedTokens.mini_mock}
                    onChange={(e) => handleTokenChange('mini_mock', e.target.value)}
                    className="w-20 h-8 text-sm"
                    disabled={isSubmitting}
                  />
                ) : (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded-md">
                    {trainee.tokens.mini_mock}
                  </span>
                )}
              </div>

              {/* Shared Mock */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Shared Mock:
                </label>
                {isEditMode ? (
                  <Input
                    type="number"
                    min="0"
                    value={editedTokens.shared_mock}
                    onChange={(e) => handleTokenChange('shared_mock', e.target.value)}
                    className="w-20 h-8 text-sm"
                    disabled={isSubmitting}
                  />
                ) : (
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded-md">
                    {trainee.tokens.shared_mock || 0}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraineeInfoCard;