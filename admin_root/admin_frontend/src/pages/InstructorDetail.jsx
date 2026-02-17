/**
 * InstructorDetail Page
 * Admin view of a specific instructor's analytics
 * Follows the GroupDetail pattern: back button + detail content
 */

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useInstructorDetails } from '../hooks/useInstructorsData';
import InstructorAnalytics from './instructor/InstructorAnalytics';

function InstructorDetail() {
  const { instructorId } = useParams();
  const navigate = useNavigate();

  const {
    data: instructorData,
    isLoading,
    error
  } = useInstructorDetails(instructorId);

  const instructor = instructorData?.data;

  const handleBack = () => {
    navigate('/work-check/instructors');
  };

  if (isLoading) {
    return (
      <div className="container-app py-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {error.message || 'Failed to load instructor details'}
          </p>
          <button
            onClick={handleBack}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500 underline"
          >
            Back to Instructors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Instructors
        </button>
        <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
          {instructor?.instructor_name || 'Instructor'}
        </h1>
        <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
          Analytics &amp; performance overview
        </p>
      </div>

      <InstructorAnalytics instructorId={instructorId} />
    </div>
  );
}

export default InstructorDetail;
