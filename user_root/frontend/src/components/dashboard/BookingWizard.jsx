/**
 * BookingWizard.jsx
 * Two-card wizard for booking Mock Exams or Work Checks
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import MockExamCard from './MockExamCard';
import WorkCheckCard from './WorkCheckCard';

const BookingWizard = ({ tokens, groups, hasActiveGroups }) => {
  const navigate = useNavigate();

  const handleBookMockExam = () => {
    navigate('/book/exam-types');
  };

  const handleBookWorkCheck = () => {
    navigate('/book/work-check');
  };

  const totalTokens = (tokens?.sj_credits || 0) + (tokens?.cs_credits || 0) +
                      (tokens?.sjmini_credits || 0) + (tokens?.shared_mock_credits || 0);

  return (
    <div className="mb-8">
      <h2 className="font-headline text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Book a Session
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MockExamCard
          tokens={tokens}
          totalTokens={totalTokens}
          onBook={handleBookMockExam}
        />
        <WorkCheckCard
          groups={groups}
          hasActiveGroups={hasActiveGroups}
          onBook={handleBookWorkCheck}
        />
      </div>
    </div>
  );
};

export default BookingWizard;
