/**
 * MockExamDetail Page
 * Displays detailed view of a single mock exam with its bookings
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useMockExamDetail } from '../hooks/useMockExamDetail';
import { useBookingsByExam } from '../hooks/useBookingsByExam';
import ExamDetailsForm from '../components/admin/ExamDetailsForm';
import BookingsTable from '../components/admin/BookingsTable';
import { useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

function MockExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State for bookings table controls
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    column: 'created_at',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Fetch exam details
  const {
    data: examData,
    isLoading: isLoadingExam,
    error: examError
  } = useMockExamDetail(id);

  // Fetch bookings with pagination, sorting, and search
  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    error: bookingsError
  } = useBookingsByExam(id, {
    search: searchTerm,
    sort_by: sortConfig.column,
    sort_order: sortConfig.direction,
    page: currentPage,
    limit: itemsPerPage
  });

  // Handle sorting
  const handleSort = (column) => {
    setSortConfig(prevConfig => ({
      column,
      direction:
        prevConfig.column === column && prevConfig.direction === 'asc'
          ? 'desc'
          : 'asc'
    }));
    setCurrentPage(1); // Reset to first page on sort change
  };

  // Handle search
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1); // Reset to first page on search
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/mock-exams');
  };

  // Loading state
  if (isLoadingExam) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-8"></div>
            <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (examError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {examError.message || 'Failed to load mock exam details'}
                </p>
                <button
                  onClick={handleBack}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-500 underline"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const exam = examData?.data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="mb-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
          <h1 className="font-headline text-h1 font-bold text-navy-900 dark:text-gray-100">
            Mock Exam Details
          </h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
            View exam information and manage bookings
          </p>
        </div>

        {/* Exam Details Form */}
        <div className="mb-8">
          <ExamDetailsForm exam={exam} />
        </div>

        {/* Bookings Table Section */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Bookings ({bookingsData?.pagination?.total || 0})
            </h2>
          </div>

          <BookingsTable
            bookings={bookingsData?.data || []}
            isLoading={isLoadingBookings}
            error={bookingsError}
            searchTerm={searchTerm}
            onSearch={handleSearch}
            sortConfig={sortConfig}
            onSort={handleSort}
            currentPage={currentPage}
            totalPages={bookingsData?.pagination?.totalPages || 1}
            totalItems={bookingsData?.pagination?.total || 0}
            onPageChange={handlePageChange}
          />
        </div>
      </div>
    </div>
  );
}

export default MockExamDetail;