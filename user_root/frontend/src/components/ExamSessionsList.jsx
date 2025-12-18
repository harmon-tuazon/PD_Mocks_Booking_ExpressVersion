import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiService, { formatDate, formatTime, formatTimeRange } from '../services/api';
import CapacityBadge from './shared/CapacityBadge';
import TokenCard from './shared/TokenCard';
import CalendarView from './shared/CalendarView';
import Logo from './shared/Logo';
import { getUserSession } from '../utils/auth';
import useCachedCredits from '../hooks/useCachedCredits';
import LocationFilter from './shared/LocationFilter';
import BookingTimeWarningModal from './shared/BookingTimeWarningModal';

// Mock types that support mock_set grouping
const MOCK_SET_APPLICABLE_TYPES = ['Clinical Skills', 'Situational Judgment', 'Mock Discussion'];

const ExamSessionsList = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mockType = searchParams.get('type') || 'Situational Judgment';

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'list' or 'calendar' - Default to calendar per requirements
  const [userSession, setUserSession] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [tooCloseBookingWarning, setTooCloseBookingWarning] = useState(null); // For date proximity warning
  
  // Use the cached credits hook
  const { credits, loading: creditsLoading, fetchCredits } = useCachedCredits();
  
  // Extract credit breakdown for the specific mock type
  const creditBreakdown = credits?.[mockType]?.credit_breakdown;

  // Filter exams based on selected location
  const filteredExams = useMemo(() => {
    if (selectedLocation === 'all') return exams;
    return exams.filter(exam => exam.location === selectedLocation);
  }, [exams, selectedLocation]);

  // Combined loading state
  const isLoading = loading || creditsLoading;

  // Fetch exams and credits on mount or when exam type changes
  // Credits refresh on mount - no events needed (navigation causes remount)
  useEffect(() => {
    fetchExams();
    const userData = getUserSession();
    if (userData) {
      setUserSession(userData);
      fetchCredits(userData.studentId, userData.email);
    }
  }, [mockType]);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);

    try {
      // Backend now filters out full sessions by default (include_capacity=false)
      const result = await apiService.mockExams.getAvailable(mockType);

      if (result.success) {
        // Filter out past exams (client-side filtering for exams earlier than today)
        // Backend filters by start date but we double-check for timezone edge cases
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate date-only comparison

        const upcomingExams = (result.data || []).filter(exam => {
          // Handle missing or invalid exam dates gracefully
          if (!exam.exam_date) {
            console.warn('Exam missing exam_date:', exam);
            return false;
          }

          try {
            const examDate = new Date(exam.exam_date);
            examDate.setHours(0, 0, 0, 0); // Set to start of day for date-only comparison
            return examDate >= today; // Keep today's exams and future exams
          } catch (error) {
            console.error('Invalid exam date format:', exam.exam_date, error);
            return false; // Exclude exams with invalid dates
          }
        });

        // Log filtering statistics for debugging
        const pastExamsCount = (result.data || []).length - upcomingExams.length;

        if (pastExamsCount > 0) {
          console.log(`Filtered out ${pastExamsCount} past exam(s) from ${(result.data || []).length} total exam(s)`);
        }

        // Full sessions are now filtered at backend, no need to filter here
        setExams(upcomingExams);
      } else {
        throw new Error(result.error || 'Failed to fetch exams');
      }
    } catch (err) {
      console.error('Error fetching exams:', err);
      setError(err.message || 'An error occurred while loading exams');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    // Calendar date selection handler - currently not needed
    // as sessions are shown directly in the calendar view
  };

  const handleSelectExam = (exam) => {
    // Check date proximity - Block if exam is today (< 1 day away)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const examDate = new Date(exam.exam_date);
    examDate.setHours(0, 0, 0, 0);

    // Calculate days until exam
    const timeDiff = examDate.getTime() - today.getTime();
    const daysUntilExam = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    // Block if exam is today (0 days) - allow booking until 1 day before
    if (daysUntilExam < 1) {
      setTooCloseBookingWarning({
        examDate: exam.exam_date,
        daysUntilExam: daysUntilExam
      });
      return;
    }

    if (exam.available_slots === 0) {
      alert('This exam session is full. Please select another date.');
      return;
    }

    navigate(`/book/${exam.mock_exam_id}`, {
      state: {
        mockType,
        examDate: exam.exam_date,
        location: exam.location,
        startTime: exam.start_time,
        endTime: exam.end_time
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
  const sortExams = (examsToSort, config) => {
    const sorted = [...examsToSort].sort((a, b) => {
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

  const getSortedExams = () => {
    if (viewMode === 'list') {
      return sortExams(filteredExams, sortConfig);
    }
    return filteredExams;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
            <p className="mt-4 text-body font-body text-gray-700 dark:text-gray-300">Loading available exam sessions...</p>
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-coral-100 dark:bg-red-900/20 rounded-full mb-4 border-2 border-coral-200 dark:border-red-800">
              <svg className="w-8 h-8 text-coral-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-h3 font-headline font-bold text-navy-900 dark:text-gray-100 mb-2">Error Loading Exams</h2>
            <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-6">{error}</p>
            <button onClick={fetchExams} className="btn-brand-primary dark:bg-primary-600 dark:hover:bg-primary-700">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/book/exam-types')}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to exam types
          </button>

          <div className="flex items-center justify-between mb-2">
            <h1 className="text-h2 font-headline font-bold text-navy-900 dark:text-gray-100">
              {mockType} Mock Exams
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
              ? 'Select a date from the calendar to view available sessions'
              : 'Select an available exam session to book your slot'
            }
          </p>
        </div>

        {/* User Info Cards - Credit Card Only */}
        {userSession && creditBreakdown && (
          <div className="mb-6">
            <div className="max-w-md">
              <TokenCard
                creditBreakdown={creditBreakdown}
                mockType={mockType}
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
              Found {filteredExams.length} session{filteredExams.length !== 1 ? 's' : ''}
              {selectedLocation !== 'all' && ` at ${selectedLocation}`}
            </p>
            <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white dark:bg-primary-500'
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
                  ? 'bg-primary-600 text-white dark:bg-primary-500'
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

        {/* Exam Sessions */}
        {exams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-body font-body text-gray-600 dark:text-gray-400">No upcoming exam sessions available for {mockType} at this time.</p>
            <p className="text-body font-body text-gray-600 dark:text-gray-400 mt-2">All current sessions may be in the past or fully booked. Please check back later or select a different exam type.</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-body font-body text-gray-700 dark:text-gray-300 mb-2">No sessions available at {selectedLocation === 'all' ? 'selected locations' : selectedLocation}</p>
            <p className="text-small font-body text-gray-600 dark:text-gray-400 mb-4">Try selecting a different location to see available sessions.</p>
            <button
              onClick={() => setSelectedLocation('all')}
              className="btn-primary dark:bg-primary-600 dark:hover:bg-primary-700"
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
                      {MOCK_SET_APPLICABLE_TYPES.includes(mockType) && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-navy-900 dark:text-gray-100 uppercase tracking-wider">
                          Set
                        </th>
                      )}
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
                    {getSortedExams().map((exam, index) => (
                      <tr
                        key={exam.mock_exam_id}
                        className={`${exam.available_slots > 0 ? 'hover:bg-gray-50 dark:hover:bg-dark-hover' : 'bg-gray-50 dark:bg-dark-bg/50 opacity-75'} transition-colors`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarIcon />
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(exam.exam_date)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ClockIcon />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {formatTimeRange(exam)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <LocationIcon />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              {exam.location}
                            </span>
                          </div>
                        </td>
                        {MOCK_SET_APPLICABLE_TYPES.includes(mockType) && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {exam.mock_set ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                                Set {exam.mock_set}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <CapacityBadge
                            availableSlots={exam.available_slots}
                            capacity={exam.capacity}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleSelectExam(exam)}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                              exam.available_slots > 0
                                ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800'
                                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                            disabled={exam.available_slots === 0}
                          >
                            {exam.available_slots > 0 ? 'Select' : 'Full'}
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
              {getSortedExams().map((exam) => (
                <div
                  key={exam.mock_exam_id}
                  className={`card-brand dark:bg-dark-card dark:border-dark-border ${exam.available_slots > 0 ? 'hover:shadow-lg hover:border-primary-300 dark:hover:border-dark-border' : 'opacity-75'} transition-all duration-200`}
                >
                  <div className="space-y-3">
                    {/* Date and Capacity Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-headline font-semibold text-navy-800 dark:text-gray-100">
                          {formatDate(exam.exam_date)}
                        </h3>
                        {MOCK_SET_APPLICABLE_TYPES.includes(mockType) && exam.mock_set && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                            Set {exam.mock_set}
                          </span>
                        )}
                      </div>
                      <CapacityBadge
                        availableSlots={exam.available_slots}
                        capacity={exam.capacity}
                      />
                    </div>

                    {/* Time and Location */}
                    <div className="space-y-2 text-sm font-body text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <ClockIcon />
                        <span>{formatTimeRange(exam)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LocationIcon />
                        <span>{exam.location}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleSelectExam(exam)}
                      className={`w-full py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                        exam.available_slots > 0
                          ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      }`}
                      disabled={exam.available_slots === 0}
                    >
                      {exam.available_slots > 0 ? 'Select Session' : 'Session Full'}
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
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('time')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'time'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Time {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('location')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'location'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600'
                      : 'bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-border'
                  }`}
                >
                  Location {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('capacity')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    sortConfig.key === 'capacity'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600'
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
            exams={filteredExams}
            onExamSelect={handleSelectExam}
          />
        )}
      </div>

      {/* Booking Time Warning Modal */}
      <BookingTimeWarningModal
        isOpen={!!tooCloseBookingWarning}
        examDate={tooCloseBookingWarning?.examDate}
        daysUntilExam={tooCloseBookingWarning?.daysUntilExam}
        onClose={() => setTooCloseBookingWarning(null)}
        onViewExamTypes={() => navigate('/book/exam-types')}
      />
    </div>
  );
};

export default ExamSessionsList;