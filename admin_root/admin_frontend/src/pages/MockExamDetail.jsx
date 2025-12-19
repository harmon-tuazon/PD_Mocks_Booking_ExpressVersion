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
import CreateBookingButton from '../components/admin/CreateBookingButton';
import { useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

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
    allBookings, // All bookings (unpaginated) for CSV export
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

  // CSV Export state
  const [isExporting, setIsExporting] = useState(false);

  // Handle CSV export - exports ALL bookings regardless of pagination
  const handleExportCSV = async () => {
    if (!allBookings?.length || isExporting) return;

    setIsExporting(true);
    try {
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/mock-exams/export-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookings: allBookings, // Use ALL bookings, not just current page
          examId: id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const date = new Date().toISOString().split('T')[0];
      link.download = `bookings-exam-${id}-${date}.csv`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${allBookings.length} bookings to CSV`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(error.message || 'Failed to export bookings. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle apply action (mark_yes, mark_no, or unmark)
  const handleApplyAction = () => {
    if (attendance.selectedCount === 0) return;

    // Set to submitting state
    attendance.startSubmitting();

    // Call mutation with current action
    // Pass both selectedIds (for backward compat) and selectedBookings (with id + hubspot_id)
    markAttendanceMutation.mutate(
      {
        bookingIds: attendance.selectedIds,
        selectedBookings: attendance.selectedBookings,
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

  // Handle opening cancellation modal with mode toggle check
  const handleOpenCancellation = () => {
    // If attendance mode is active, prevent cancellation mode
    if (attendance.isAttendanceMode) {
      // Could show a toast or alert here if needed
      console.warn('Cannot enter cancellation mode while attendance mode is active');
      return;
    }

    // If not in cancellation mode, enter it first
    if (!cancellation.isCancellationMode) {
      cancellation.toggleMode();
    }
    // Open the modal if desired (optional - could just enter mode without opening modal)
    // cancellation.openModal();
  };

  // Handle toggling attendance mode with cancellation check
  const handleToggleAttendance = () => {
    // If cancellation mode is active, prevent attendance mode
    if (cancellation.isCancellationMode) {
      // Could show a toast or alert here if needed
      console.warn('Cannot enter attendance mode while cancellation mode is active');
      return;
    }

    // Toggle attendance mode
    attendance.toggleMode();
  };

  // Handle cancellation confirmation
  const handleConfirmCancellation = () => {
    if (cancellation.selectedCount === 0) return;

    // Set to submitting state
    cancellation.startSubmitting();

    // Call mutation with full booking objects and refund flag
    cancelBookingsMutation.mutate(
      {
        bookings: cancellation.selectedBookings,  // Full booking objects
        refundTokens: cancellation.refundTokens   // Refund flag
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

  // Handle successful booking creation
  const handleBookingCreated = async (bookingData) => {
    console.log('✅ [MockExamDetail] New booking created:', bookingData);

    // The useMockExamDetail and useBookingsByExam hooks use React Query,
    // which will automatically refetch when the component is re-rendered
    // or when we manually invalidate the query cache

    // For now, just log success - React Query will handle the refetch
    // If we need to manually trigger a refetch, we can use queryClient.invalidateQueries
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
            examData={exam}
            displayData={examEdit.formData}
            isEditing={examEdit.isEditing}
            errors={examEdit.errors}
            touched={examEdit.touched}
            onFieldChange={examEdit.updateField}
            onFieldBlur={examEdit.handleFieldBlur}
            getFieldError={(fieldName) => examEdit.errors[fieldName]}
            isSaving={examEdit.isSaving}
          />
        </div>

        {/* Bookings Table Section */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Bookings ({bookingsData?.pagination?.total || 0})
              </h2>
              <CreateBookingButton
                mockExam={examData?.data}
                onSuccess={handleBookingCreated}
              />
            </div>
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
            attendanceState={{
              isAttendanceMode: attendance.isAttendanceMode,
              isSubmitting: attendance.isSubmitting,
              selectedCount: attendance.selectedCount,
              selectableCount: attendance.selectableCount,
              attendedCount: attendanceSummary.attended,
              noShowCount: attendanceSummary.no_show,
              unmarkedCount: attendanceSummary.unmarked,
              totalCount: bookingsData?.pagination?.total || 0,
              action: attendance.action,
              onToggleMode: handleToggleAttendance,  // Use new toggle handler
              onSelectAll: attendance.selectAll,
              onClearAll: attendance.clearAll,
              onSetAction: attendance.setAction,
              onApplyAction: handleApplyAction,
              isSelected: attendance.isSelected,
              onToggleSelection: attendance.toggleSelection,
              // Add cancellation handler
              onCancelBookings: handleOpenCancellation,
              isCancellationMode: cancellation.isCancellationMode,
              // Export CSV props
              onExportCSV: handleExportCSV,
              isExporting: isExporting,
              exportDisabled: !allBookings?.length
            }}
            // Add cancellation props
            cancellationState={{
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
          refundTokens={cancellation.refundTokens}
          onToggleRefund={cancellation.toggleRefund}
        />
      </div>
    </div>
  );
}

export default MockExamDetail;