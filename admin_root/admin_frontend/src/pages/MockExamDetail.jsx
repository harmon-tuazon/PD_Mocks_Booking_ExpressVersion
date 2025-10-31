/**
 * MockExamDetail Page
 * Displays detailed view of a single mock exam with its bookings
 * Supports inline editing of exam details
 *
 * Enhanced with attendance marking:
 * - Mark attendance for multiple bookings in batch
 * - Optimistic UI updates
 * - Comprehensive error handling
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useMockExamDetail } from '../hooks/useMockExamDetail';
import { useBookingsByExam } from '../hooks/useBookingsByExam';
import { useExamEdit } from '../hooks/useExamEdit';
import useAttendanceMarking from '../hooks/useAttendanceMarking';
import useMarkAttendanceMutation from '../hooks/useMarkAttendanceMutation';
import useBatchCancellation from '../hooks/useBatchCancellation';
import useCancelBookingsMutation from '../hooks/useCancelBookingsMutation';
import ExamDetailsForm from '../components/admin/ExamDetailsForm';
import BookingsTable from '../components/admin/BookingsTable';
import EditControls from '../components/admin/EditControls';
import DeleteControls from '../components/admin/DeleteControls';
import CancelBookingsModal from '../components/shared/CancelBookingsModal';
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
  const itemsPerPage = 20;

  // Fetch exam details
  const {
    data: examData,
    isLoading: isLoadingExam,
    error: examError
  } = useMockExamDetail(id);

  // Initialize edit state management
  const examEdit = useExamEdit(examData?.data);

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

  // Initialize attendance marking state
  const bookings = bookingsData?.data || [];
  const attendance = useAttendanceMarking(bookings);

  // Get attendance counts from API response (counts all bookings, not just current page)
  const attendanceSummary = bookingsData?.attendance_summary || {
    attended: 0,
    no_show: 0,
    unmarked: 0
  };

  // Initialize attendance mutation
  const markAttendanceMutation = useMarkAttendanceMutation(id);

  // Initialize cancellation state
  const cancellation = useBatchCancellation(bookings);

  // Initialize cancellation mutation
  const cancelBookingsMutation = useCancelBookingsMutation(id);

  // Handle apply action (mark_yes, mark_no, or unmark)
  const handleApplyAction = () => {
    if (attendance.selectedCount === 0) return;

    // Set to submitting state
    attendance.startSubmitting();

    // Call mutation with current action
    markAttendanceMutation.mutate(
      {
        bookingIds: attendance.selectedIds,
        action: attendance.action
      },
      {
        onSuccess: () => {
          // Exit attendance mode and clear selections
          attendance.exitToView();
        },
        onError: () => {
          // Return to selecting mode (keep selections for retry)
          attendance.returnToSelecting();
        }
      }
    );
  };

  // Handle opening cancellation modal
  const handleOpenCancellation = () => {
    // If not in cancellation mode, enter it first
    if (!cancellation.isCancellationMode) {
      cancellation.toggleMode();
    }
    // Open the modal
    cancellation.openModal();
  };

  // Handle cancellation confirmation
  const handleConfirmCancellation = () => {
    if (cancellation.selectedCount === 0) return;

    // Set to submitting state
    cancellation.startSubmitting();

    // Call mutation
    cancelBookingsMutation.mutate(
      {
        bookingIds: cancellation.selectedIds
      },
      {
        onSuccess: () => {
          // Exit cancellation mode and clear selections
          cancellation.exitToView();
        },
        onError: () => {
          // Return to selecting mode (keep selections for retry)
          cancellation.returnToSelecting();
        }
      }
    );
  };

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

  // Handle successful deletion
  const handleDeleteSuccess = () => {
    // Navigate back to dashboard
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
        {/* Page Header with Back Button and Edit Controls */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-4"
            disabled={examEdit.isSaving}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Dashboard
          </button>
          <div className="flex justify-between items-center mb-4">
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              {examEdit.isEditing ? 'Editing Mock Exam' : 'Mock Exam Details'}
            </h1>
            <div className="flex items-center gap-2">
              {/* Edit Controls */}
              <EditControls
                isEditing={examEdit.isEditing}
                isSaving={examEdit.isSaving}
                isDirty={examEdit.isDirty}
                onEdit={examEdit.toggleEdit}
                onSave={examEdit.saveChanges}
                onCancel={examEdit.forceCancelEdit}
              />
              {/* Delete Controls */}
              <DeleteControls
                examId={exam?.id}
                examDetails={{
                  mock_type: exam?.mock_type,
                  exam_date: exam?.exam_date,
                  location: exam?.location,
                  total_bookings: exam?.total_bookings || 0
                }}
                onDeleteSuccess={handleDeleteSuccess}
                disabled={examEdit.isEditing}
              />
            </div>
          </div>
          <p className="font-body text-base text-gray-600 dark:text-gray-300">
            {examEdit.isEditing
              ? 'Make changes to the exam details and save when ready'
              : 'View exam information and manage bookings'}
          </p>
        </div>

        {/* Exam Details Form */}
        <div className="mb-8">
          <ExamDetailsForm
            exam={exam}
            isEditing={examEdit.isEditing}
            formData={examEdit.formData}
            errors={examEdit.errors}
            touched={examEdit.touched}
            onFieldChange={examEdit.updateField}
            onFieldBlur={examEdit.handleFieldBlur}
            isSaving={examEdit.isSaving}
          />
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
            attendanceProps={{
              isAttendanceMode: attendance.isAttendanceMode,
              isSubmitting: attendance.isSubmitting,
              selectedCount: attendance.selectedCount,
              selectableCount: attendance.selectableCount,
              attendedCount: attendanceSummary.attended,
              noShowCount: attendanceSummary.no_show,
              unmarkedCount: attendanceSummary.unmarked,
              totalCount: bookingsData?.pagination?.total || 0,
              action: attendance.action,
              onToggleMode: attendance.toggleMode,
              onSelectAll: attendance.selectAll,
              onClearAll: attendance.clearAll,
              onSetAction: attendance.setAction,
              onApplyAction: handleApplyAction,
              isSelected: attendance.isSelected,
              onToggleSelection: attendance.toggleSelection,
              // Add cancellation handler
              onCancelBookings: handleOpenCancellation,
              isCancellationMode: cancellation.isCancellationMode
            }}
            // Add cancellation props
            cancellationProps={{
              isCancellationMode: cancellation.isCancellationMode,
              isSubmitting: cancellation.isSubmitting,
              selectedCount: cancellation.selectedCount,
              cancellableCount: cancellation.cancellableCount,
              totalCount: bookingsData?.pagination?.total || 0,
              onToggleMode: cancellation.toggleMode,
              onSelectAll: cancellation.selectAll,
              onClearAll: cancellation.clearAll,
              onOpenModal: cancellation.openModal,
              isSelected: cancellation.isSelected,
              onToggleSelection: cancellation.toggleSelection,
              canCancel: cancellation.canCancel
            }}
          />
        </div>

        {/* Cancellation Modal */}
        <CancelBookingsModal
          isOpen={cancellation.isModalOpen}
          onClose={cancellation.closeModal}
          onConfirm={handleConfirmCancellation}
          selectedBookings={cancellation.selectedBookings}
          isLoading={cancelBookingsMutation.isLoading}
          error={cancelBookingsMutation.error?.message}
        />
      </div>
    </div>
  );
}

export default MockExamDetail;