import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import apiService, { formatDate, formatTime, formatTimeRange } from '../services/api';
import CapacityBadge from '../components/shared/CapacityBadge';
import TokenCard from '../components/shared/TokenCard';
import CalendarView from '../components/shared/CalendarView';
import Logo from '../components/shared/Logo';
import InsufficientTokensError from '../components/shared/InsufficientTokensError';
import PrerequisiteWarningModal from '../components/shared/PrerequisiteWarningModal';
import { getUserSession } from '../utils/auth';
import useCachedCredits from '../hooks/useCachedCredits';
import LocationFilter from '../components/shared/LocationFilter';
import { checkPrerequisites, getMissingPrerequisites } from '../utils/prerequisiteHelpers';

const MockDiscussions = () => {
  const navigate = useNavigate();
  const mockType = 'Mock Discussion'; // Fixed type for discussions

  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'list' or 'calendar' - Default to calendar
  const [userSession, setUserSession] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [showInsufficientTokensError, setShowInsufficientTokensError] = useState(false);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [currentPrereqData, setCurrentPrereqData] = useState(null);
  const [userBookings, setUserBookings] = useState([]);

  // Helper function to check if a discussion has unmet prerequisites
  const hasUnmetPrerequisites = (discussion) => {
    if (!discussion.prerequisite_exam_ids || discussion.prerequisite_exam_ids.length === 0) {
      return false;
    }
    return !checkPrerequisites(discussion.prerequisite_exam_ids, userBookings);
  };

  // Use the cached credits hook
  const { credits, loading: creditsLoading, fetchCredits } = useCachedCredits();

  // Extract mock discussion token data
  const mockDiscussionData = credits?.['Mock Discussion'];
  const mockDiscussionTokens = mockDiscussionData?.credit_breakdown?.total_credits || 0;

  // Filter discussions based on selected location
  const filteredDiscussions = useMemo(() => {
    if (selectedLocation === 'all') return discussions;
    return discussions.filter(discussion => discussion.location === selectedLocation);
  }, [discussions, selectedLocation]);

  // Combined loading state
  const isLoading = loading || creditsLoading;

  useEffect(() => {
    fetchDiscussions();
    // Fetch credits using the hook
    const userData = getUserSession();
    if (userData) {
      setUserSession(userData);
      fetchCredits(userData.studentId, userData.email); // This already fetches Mock Discussion credits
      fetchUserBookings(userData.studentId, userData.email); // Fetch user bookings for prerequisite validation
    }
  }, []);

  const fetchDiscussions = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.mockDiscussions.getAvailable(true);

      if (result.success) {
        // Filter out past discussions (only show today and future)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        const upcomingDiscussions = (result.data || []).filter(discussion => {
          // Handle missing or invalid dates gracefully
          if (!discussion.exam_date) {
            console.warn('Discussion missing exam_date:', discussion);
            return false;
          }

          try {
            const discussionDate = new Date(discussion.exam_date);
            discussionDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
            return discussionDate >= today; // Keep today's and future discussions
          } catch (error) {
            console.error('Invalid discussion date format:', discussion.exam_date, error);
            return false; // Exclude discussions with invalid dates
          }
        });

        // Filter out full sessions (available_slots <= 0)
        const availableDiscussions = upcomingDiscussions.filter(discussion => discussion.available_slots > 0);

        // Log filtering statistics for debugging
        const pastDiscussionsCount = (result.data || []).length - upcomingDiscussions.length;
        const fullSessionsCount = upcomingDiscussions.length - availableDiscussions.length;

        if (pastDiscussionsCount > 0) {
          console.log(`Filtered out ${pastDiscussionsCount} past discussion(s) from ${(result.data || []).length} total discussion(s)`);
        }
        if (fullSessionsCount > 0) {
          console.log(`Filtered out ${fullSessionsCount} full session(s) from ${upcomingDiscussions.length} upcoming discussion(s)`);
        }

        setDiscussions(availableDiscussions);
      } else {
        throw new Error(result.error || 'Failed to fetch mock discussions');
      }
    } catch (err) {
      console.error('Error fetching mock discussions:', err);
      setError(err.message || 'An error occurred while loading mock discussions');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBookings = async (studentId, email) => {
    try {
      const result = await apiService.bookings.list({
        student_id: studentId,
        email: email
      });

      if (result.success && result.data?.bookings) {
        setUserBookings(result.data.bookings);
      } else {
        console.warn('Failed to fetch user bookings for prerequisite validation:', result.error);
        setUserBookings([]); // Set empty array to prevent blocking
      }
    } catch (err) {
      console.error('Error fetching user bookings:', err);
      setUserBookings([]); // Set empty array to prevent blocking
    }
  };


  const handleSelectDiscussion = (discussion) => {
    if (discussion.available_slots === 0) {
      alert('This mock discussion session is full. Please select another date.');
      return;
    }

    if (mockDiscussionTokens === 0) {
      setShowInsufficientTokensError(true);
      return;
    }

    // Check prerequisites if discussion has prerequisite_exam_ids
    if (discussion.prerequisite_exam_ids && discussion.prerequisite_exam_ids.length > 0) {
      const meetsPrerequisites = checkPrerequisites(
        discussion.prerequisite_exam_ids,
        userBookings
      );

      if (!meetsPrerequisites) {
        // Get missing prerequisites details
        const missingPrereqs = getMissingPrerequisites(
          discussion.prerequisite_exam_ids,
          userBookings,
          discussions // Use all discussions as the source of exam details
        );

        // Set prerequisite data and show modal
        setCurrentPrereqData({
          examName: `Mock Discussion - ${formatDate(discussion.exam_date)}`,
          examDate: discussion.exam_date,
          prerequisiteExams: missingPrereqs
        });
        setShowPrereqModal(true);
        return; // Don't proceed to booking
      }
    }

    // Proceed with booking
    navigate(`/book/mock-discussion/${discussion.mock_exam_id}`, {
      state: {
        mockType: 'Mock Discussion',
        examDate: discussion.exam_date,
        location: discussion.location
      }
    });
  };

  const LocationIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );

  const CalendarIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );

  const ClockIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );

  const SortArrowUp = () => (
    <svg className="w-3 h-3 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );

  const SortArrowDown = () => (
    <svg className="w-3 h-3 inline ml-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  // Sorting function
  const sortDiscussions = (discussionsToSort, config) => {
    const sorted = [...discussionsToSort].sort((a, b) => {
      let aValue, bValue;

      switch (config.key) {
        case 'date':
          aValue = new Date(a.exam_date);
          bValue = new Date(b.exam_date);
          break;
        case 'time':
          aValue = a.start_time;
          bValue = b.start_time;
          break;
        case 'location':
          aValue = a.location.toLowerCase();
          bValue = b.location.toLowerCase();
          break;
        case 'capacity':
          aValue = a.available_slots;
          bValue = b.available_slots;
          break;
        default:
          return 0;
      }

      if (config.key === 'location') {
        // String comparison
        if (aValue < bValue) return config.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return config.direction === 'asc' ? 1 : -1;
        return 0;
      } else {
        // Numeric/Date comparison
        if (config.direction === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
    });

    return sorted;
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedDiscussions = () => {
    if (viewMode === 'list') {
      return sortDiscussions(filteredDiscussions, sortConfig);
    }
    return filteredDiscussions;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
            <p className="mt-4 text-body font-body text-gray-700 dark:text-gray-300">Loading available mock discussion sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 dark:bg-coral-900/30 rounded-full mb-4 border-2 border-coral-200 dark:border-coral-700">
              <svg className="w-8 h-8 text-coral-600 dark:text-coral-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-h3 font-headline font-bold text-navy-900 dark:text-gray-100 mb-2">Error Loading Mock Discussions</h2>
            <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-6">{error}</p>
            <button onClick={fetchDiscussions} className="btn-brand-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show InsufficientTokensError when user attempts to book with 0 tokens
  if (showInsufficientTokensError) {
    return (
      <InsufficientTokensError
        mockType="Mock Discussion"
        onGoBack={() => setShowInsufficientTokensError(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/book/exam-types')}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to exam types
          </button>

          <div className="flex items-center justify-between mb-2">
            <h1 className="text-h2 font-headline font-bold text-navy-900 dark:text-gray-100">
              Mock Discussion Sessions
            </h1>
            <Logo
              variant="horizontal"
              size="large"
              className="ml-4"
              aria-label="PrepDoctors Logo"
            />
          </div>
          <p className="text-body font-body text-gray-800 dark:text-gray-300">
            {viewMode === 'calendar'
              ? 'Select a date from the calendar to view available discussion sessions'
              : 'Select an available discussion session to book your slot'
            }
          </p>
        </div>

        {/* Token Display Card */}
        {userSession && mockDiscussionTokens >= 0 && (
          <div className="mb-6">
            <div className="max-w-md">
              <TokenCard
                creditBreakdown={mockDiscussionData || { available_credits: mockDiscussionTokens }}
                mockType="Mock Discussion"
                compact={true}
                className=""
              />
            </div>
          </div>
        )}

        {/* Location Filter and View Toggle - Horizontal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-6 gap-4">
          <div className="w-full sm:w-64">
            <LocationFilter
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
            />
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Session Count - Above view buttons */}
            <p className="text-sm font-body text-gray-600 dark:text-gray-400">
              Found {filteredDiscussions.length} session{filteredDiscussions.length !== 1 ? 's' : ''}
              {selectedLocation !== 'all' && ` at ${selectedLocation}`}
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">List View</span>
                  <span className="sm:hidden">List</span>
                </span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  viewMode === 'calendar'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-hover'
                }`}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Calendar View</span>
                  <span className="sm:hidden">Calendar</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Discussion Sessions */}
        {discussions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-body font-body text-gray-600">No upcoming mock discussion sessions available at this time.</p>
            <p className="text-body font-body text-gray-600 mt-2">All current sessions may be in the past or fully booked. Please check back later.</p>
          </div>
        ) : filteredDiscussions.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-body font-body text-gray-700 mb-2">No sessions available at {selectedLocation === 'all' ? 'selected locations' : selectedLocation}</p>
            <p className="text-small font-body text-gray-600 mb-4">Try selecting a different location to see available sessions.</p>
            <button
              onClick={() => setSelectedLocation('all')}
              className="btn-primary"
            >
              View All Locations
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <div className="card-brand dark:bg-dark-card dark:border-dark-border p-0 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-navy-50 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
                    <tr>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center">
                          Date
                          {sortConfig.key === 'date' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('time')}
                      >
                        <div className="flex items-center">
                          Time
                          {sortConfig.key === 'time' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('location')}
                      >
                        <div className="flex items-center">
                          Location
                          {sortConfig.key === 'location' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider cursor-pointer hover:bg-navy-100 dark:hover:bg-dark-card transition-colors"
                        onClick={() => handleSort('capacity')}
                      >
                        <div className="flex items-center">
                          Availability
                          {sortConfig.key === 'capacity' && (
                            sortConfig.direction === 'asc' ? <SortArrowUp /> : <SortArrowDown />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
                    {getSortedDiscussions().map((discussion) => (
                      <tr
                        key={discussion.mock_exam_id}
                        className={`${discussion.available_slots > 0 ? 'hover:bg-gray-50 dark:hover:bg-dark-hover' : 'bg-gray-50 dark:bg-dark-hover/50 opacity-75'} transition-colors`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarIcon />
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(discussion.exam_date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ClockIcon />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {formatTimeRange(discussion)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <LocationIcon />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {discussion.location}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-2">
                            {/* Prerequisites Badge */}
                            {hasUnmetPrerequisites(discussion) && (
                              <div className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                <FiLock className="h-3 w-3" />
                                <span>Prerequisites Required</span>
                              </div>
                            )}

                            {/* Capacity Badge */}
                            <div className="flex items-center space-x-3">
                              <CapacityBadge
                                availableSlots={discussion.available_slots}
                                capacity={discussion.capacity}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {discussion.available_slots} of {discussion.capacity} slots
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleSelectDiscussion(discussion)}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                              discussion.available_slots > 0 && mockDiscussionTokens > 0
                                ? 'bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            disabled={discussion.available_slots === 0 || mockDiscussionTokens === 0}
                          >
                            {discussion.available_slots === 0 ? 'Full' : mockDiscussionTokens === 0 ? 'No Tokens' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View (Responsive) */}
            <div className="md:hidden grid gap-4">
              {getSortedDiscussions().map((discussion) => (
                <div
                  key={discussion.mock_exam_id}
                  className={`card-brand dark:bg-dark-card dark:border-dark-border ${discussion.available_slots > 0 && mockDiscussionTokens > 0 ? 'hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600' : 'opacity-75'} transition-all duration-200`}
                >
                  <div className="space-y-3">
                    {/* Date and Badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-lg font-headline font-semibold text-navy-800 dark:text-gray-100">
                        {formatDate(discussion.exam_date)}
                      </h3>
                      <div className="flex items-center gap-2">
                        {/* Prerequisites Badge */}
                        {hasUnmetPrerequisites(discussion) && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded text-xs font-medium text-yellow-600 dark:text-yellow-400">
                            <FiLock className="h-3 w-3" />
                            <span>Prereqs Required</span>
                          </div>
                        )}

                        {/* Capacity Badge */}
                        <CapacityBadge
                          availableSlots={discussion.available_slots}
                          capacity={discussion.capacity}
                        />
                      </div>
                    </div>

                    {/* Time and Location */}
                    <div className="space-y-2 text-sm font-body text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <ClockIcon />
                        <span>{formatTimeRange(discussion)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LocationIcon />
                        <span>{discussion.location}</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {discussion.available_slots} of {discussion.capacity} slots available
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleSelectDiscussion(discussion)}
                      className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                        discussion.available_slots > 0 && mockDiscussionTokens > 0
                          ? 'bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={discussion.available_slots === 0 || mockDiscussionTokens === 0}
                    >
                      {discussion.available_slots === 0 ? 'Session Full' : mockDiscussionTokens === 0 ? 'No Tokens Available' : 'Select Session'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Sorting Controls */}
            <div className="md:hidden mt-4 p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Sort by:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSort('date')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'date'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('time')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'time'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Time {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('location')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'location'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Location {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('capacity')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'capacity'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Availability {sortConfig.key === 'capacity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <CalendarView
            exams={filteredDiscussions}
            onExamSelect={handleSelectDiscussion}
            examType="Mock Discussion"
            userBookings={userBookings}
          />
        )}
      </div>

      {/* Prerequisite Warning Modal */}
      <PrerequisiteWarningModal
        isOpen={showPrereqModal}
        examName={currentPrereqData?.examName}
        examDate={currentPrereqData?.examDate}
        prerequisiteExams={currentPrereqData?.prerequisiteExams || []}
        onClose={() => setShowPrereqModal(false)}
      />
    </div>
  );
};

export default MockDiscussions;