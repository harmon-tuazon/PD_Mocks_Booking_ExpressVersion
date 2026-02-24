import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../utils/auth';
import useCachedCredits from '../hooks/useCachedCredits';
import ExistingBookingsCard from './shared/ExistingBookingsCard';

const ExamTypeSelector = () => {
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState(null);
  const { credits, loading, fetchCredits } = useCachedCredits();

  const examTypes = [
    {
      type: 'Situational Judgment',
      description: 'Test your situational decision-making skills with scenario-based simulations.',
      icon: '/assets/SJ-icon.svg',
      color: 'primary',
      duration: '2 hours and 30 mins',
    },
    {
      type: 'Clinical Skills',
      description: 'Demonstrate your practical clinical abilities skills in simulated cases.',
      icon: '/assets/CS-icon.svg',
      color: 'success',
      duration: '8 hours and 30 mins',
    },
    {
      type: 'Mini-mock',
      description: 'Quick practice session to test your knowledge and prepare for full-length exams.',
      icon: '/assets/minimock-icon.svg',
      color: 'warning',
      duration: '1 hour and 30 mins',
    },
  ];

  // Load user session and fetch credit information
  // Credits refresh on mount - no events needed (navigation causes remount)
  useEffect(() => {
    const userData = getUserSession();
    if (userData) {
      setUserSession(userData);
      // Fetch fresh credits on mount
      fetchCredits(userData.studentId, userData.email);
    }
  }, []);

  const handleSelectType = (type) => {
    navigate(`/book/exams?type=${encodeURIComponent(type)}`);
  };

  const handleViewAllBookings = () => {
    navigate('/my-bookings');
  };

  // Calculate shared mock credits from the credits data
  const getSharedMockCredits = () => {
    if (!credits) return 0;
    // Get shared mock credits from non-Mini-mock exam types
    // (Mini-mock doesn't use shared credits, so we need to get it from SJ or CS)
    for (const examType of ['Situational Judgment', 'Clinical Skills']) {
      if (credits[examType]?.credit_breakdown?.shared_credits) {
        return credits[examType].credit_breakdown.shared_credits;
      }
    }
    return 0;
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
      <div className="container-brand py-4 md:py-8 lg:py-12">
        {/* Header - Left aligned */}
        <div className="mb-6 md:mb-12 animate-fade-in">
          <h1 className="font-headline text-2xl md:text-3xl font-bold text-primary-900 dark:text-gray-100 mb-1 md:mb-2">
            Book Your Mock Exam
          </h1>
          <p className="font-body text-xs md:text-sm text-primary-700 dark:text-gray-300">
            Choose the type of mock exam you'd like to book.
          </p>
        </div>

        {/* Exam Type Cards - Compact on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8 content-width-lg mb-6 md:mb-12">
          {examTypes.map((exam, index) => (
            <div
              key={exam.type}
              className="card-hover dark:bg-dark-card dark:border-dark-border dark:hover:border-dark-border animate-slide-up p-4 md:p-6"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleSelectType(exam.type)}
            >
              <div className="text-center">
                {/* Icon - smaller on mobile */}
                <div className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 md:mb-4 flex items-center justify-center">
                  <img
                    src={exam.icon}
                    alt={`${exam.type} icon`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>

                {/* Title - smaller on mobile */}
                <h3 className="font-subheading text-base md:text-xl font-semibold text-primary-900 dark:text-gray-100 mb-1.5 md:mb-3">
                  {exam.type}
                </h3>

                {/* Description - hidden on mobile, shown on tablet+ */}
                <p className="hidden md:block font-body text-primary-700 dark:text-gray-300 mb-6 leading-relaxed">
                  {exam.description}
                </p>

                {/* Duration - compact on mobile */}
                <div className="mb-3 md:mb-6 font-body text-xs md:text-sm text-primary-600 dark:text-gray-400">
                  <div className="flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>{exam.duration}</span>
                  </div>
                </div>

                {/* Button - compact on mobile */}
                <button className="btn-primary w-full text-xs md:text-sm py-2 md:py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700">
                  View Sessions
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1.5 md:ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* User Info Cards - Now below exam cards with fixed positioning */}
        {userSession && (
          <div className="content-width-lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Existing Bookings Card - Always on the LEFT */}
              <ExistingBookingsCard
                studentId={userSession.studentId}
                email={userSession.email}
                maxItems={3}
                onViewAll={handleViewAllBookings}
                className="h-full"
              />

              {/* Tokens Overview Table - Always on the RIGHT */}
              {credits && (
                <div className="bg-white dark:bg-dark-card border dark:border-dark-border rounded-lg overflow-hidden shadow-sm">
                  <div className="px-3 py-2 border-b dark:border-dark-border">
                    <h3 className="font-subheading text-sm font-semibold text-primary-900 dark:text-gray-100">Available Tokens</h3>
                    <p className="font-body text-xs text-primary-600 dark:text-gray-400 mt-0.5">Your current token balance</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-dark-bg">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Exam Type
                          </th>
                          <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                        {examTypes.map((examType, index) => {
                          const examCredits = credits?.[examType.type];
                          return (
                            <tr key={examType.type} className={index % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-gray-50 dark:bg-dark-bg/50'}>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                  {examType.type}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                                  (examCredits?.credit_breakdown?.specific_credits || 0) > 0
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-gray-100 dark:bg-dark-hover text-gray-800 dark:text-gray-300'
                                }`}>
                                  {loading ? '...' : (examCredits?.credit_breakdown?.specific_credits || 0)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Add standalone Shared Mock Tokens row */}
                        <tr className={examTypes.length % 2 === 0 ? 'bg-white dark:bg-dark-card' : 'bg-gray-50 dark:bg-dark-bg/50'}>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              Shared Mock Tokens
                            </div>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-center">
                            <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              getSharedMockCredits() > 0
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-dark-hover text-gray-800 dark:text-gray-300'
                            }`}>
                              {loading ? '...' : getSharedMockCredits()}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="px-2 py-1 bg-gray-50 dark:bg-dark-bg text-xs text-gray-500 dark:text-gray-400">
                    Specific tokens are for each exam type. Shared tokens can be used for SJ or CS exams.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ExamTypeSelector;
