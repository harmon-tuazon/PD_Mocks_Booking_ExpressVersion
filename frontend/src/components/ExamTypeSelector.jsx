import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../utils/auth';
import useCachedCredits from '../hooks/useCachedCredits';
import { ResponsiveLogo } from './shared/Logo';
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
      duration: '2 hours',
    },
    {
      type: 'Clinical Skills',
      description: 'Demonstrate your practical clinical abilities skills in simulated cases.',
      icon: '/assets/CS-icon.svg',
      color: 'success',
      duration: '3 hours',
    },
    {
      type: 'Mini-mock',
      description: 'Quick practice session to test your knowledge and prepare for full-length exams.',
      icon: '/assets/minimock-icon.svg',
      color: 'warning',
      duration: '1 hour',
    },
  ];

  // Load user session and fetch credit information
  useEffect(() => {
    const userData = getUserSession();
    if (userData) {
      setUserSession(userData);
      // Fetch credit info using the cached hook
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
    <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50 min-h-full">
      <div className="container-brand py-8 lg:py-12">
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-4 mb-6">
            <ResponsiveLogo
              size="large"
              className="transition-opacity duration-300 hover:opacity-80 !h-16 sm:!h-14 lg:!h-16"
            />
            <h1 className="font-headline text-h1 font-bold text-primary-900">
              Book Your Mock Exam
            </h1>
          </div>
          <p className="font-body text-lg text-primary-700 content-width-md">
            Choose the type of mock exam you'd like to book. Check your available tokens below.
          </p>
        </div>

        {/* Exam Type Cards - Now at the top */}
        <div className="grid-exam-cards-large content-width-lg mb-12">
          {examTypes.map((exam, index) => (
            <div
              key={exam.type}
              className="card-hover animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleSelectType(exam.type)}
            >
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <img
                    src={exam.icon}
                    alt={`${exam.type} icon`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>

                <h3 className="font-subheading text-xl font-semibold text-primary-900 mb-3">
                  {exam.type}
                </h3>

                <p className="font-body text-primary-700 mb-6 leading-relaxed">
                  {exam.description}
                </p>

                <div className="space-brand-small mb-6 font-body text-sm text-primary-600">
                  <div className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>Duration: {exam.duration}</span>
                  </div>
                </div>

                <button className="btn-primary w-full">
                  View Available Sessions
                  <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                  <div className="px-3 py-2 border-b">
                    <h3 className="font-subheading text-sm font-medium text-primary-900">Available Tokens</h3>
                    <p className="font-body text-xs text-primary-600 mt-0.5">Your current token balance</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Exam Type
                          </th>
                          <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {examTypes.map((examType, index) => {
                          const examCredits = credits?.[examType.type];
                          return (
                            <tr key={examType.type} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <div className="text-xs font-medium text-gray-900">
                                  {examType.type}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                                  (examCredits?.credit_breakdown?.specific_credits || 0) > 0
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {loading ? '...' : (examCredits?.credit_breakdown?.specific_credits || 0)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Add standalone Shared Mock Tokens row */}
                        <tr className={examTypes.length % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <div className="text-xs font-medium text-gray-900">
                              Shared Mock Tokens
                            </div>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-center">
                            <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              getSharedMockCredits() > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {loading ? '...' : getSharedMockCredits()}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="px-2 py-1 bg-gray-50 text-xs text-gray-500">
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