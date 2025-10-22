import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FiCalendar, FiClock, FiMapPin, FiHash, FiEye, FiX, FiAlertCircle } from 'react-icons/fi';
import { DeleteBookingModal } from '../shared';
import { formatTimeRange } from '../../services/api';

const BookingsList = ({
  bookings = [],
  onCancelBooking,
  onViewDetails,
  isLoading = false,
  error = null
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Format time range for display using the API service function
  // This function properly handles ISO timestamps from HubSpot
  const formatBookingTimeRange = (booking) => {
    // Pass the booking object to the API service formatTimeRange function
    return formatTimeRange(booking);
  };

  // Determine booking status
  const getBookingStatus = (booking) => {
    if (booking.status === 'cancelled') return 'cancelled';

    const examDate = new Date(booking.exam_date);
    const now = new Date();

    if (examDate < now) return 'past';
    return 'upcoming';
  };

  // Get status configuration
  const getStatusConfig = (status) => {
    switch (status) {
      case 'upcoming':
        return {
          label: 'Confirmed',
          icon: '✅',
          className: 'bg-green-50 text-green-700 border-green-200'
        };
      case 'past':
        return {
          label: 'Past',
          icon: '🕐',
          className: 'bg-gray-50 text-gray-600 border-gray-200'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          icon: '❌',
          className: 'bg-red-50 text-red-700 border-red-200'
        };
      default:
        return {
          label: 'Unknown',
          icon: '❓',
          className: 'bg-gray-50 text-gray-600 border-gray-200'
        };
    }
  };

  // Handle cancel booking
  const handleCancelClick = (booking) => {
    setBookingToDelete(booking);
    setDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async (bookingId) => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onCancelBooking(bookingId);
      // Success - close modal and reset state
      setDeleteModalOpen(false);
      setBookingToDelete(null);
    } catch (error) {
      // Set error to display in modal
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to cancel booking. Please try again.';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setBookingToDelete(null);
      setDeleteError(null);
    }
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div className="h-6 bg-gray-200 rounded w-32"></div>
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-28"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
            <div className="h-9 bg-gray-200 rounded flex-1"></div>
            <div className="h-9 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-24 h-24 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <FiCalendar className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bookings Found</h3>
      <p className="text-gray-600 max-w-sm mx-auto">
        You don't have any bookings yet. Browse available mock exams to make your first booking.
      </p>
    </div>
  );

  // Error state component
  const ErrorState = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <div className="mx-auto w-12 h-12 mb-3 bg-red-100 rounded-full flex items-center justify-center">
        <FiAlertCircle className="w-6 h-6 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Bookings</h3>
      <p className="text-red-700">{error || 'An error occurred while loading your bookings.'}</p>
    </div>
  );

  // Booking card component
  const BookingCard = ({ booking }) => {
    const status = getBookingStatus(booking);
    const statusConfig = getStatusConfig(status);
    const isUpcoming = status === 'upcoming';
    const isCancelling = isDeleting && bookingToDelete?.id === booking.id;

    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 ${isCancelling ? 'opacity-50' : ''}`}>
        <div className="p-6">
          {/* Header with exam type and status */}
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900 font-headline">
              {booking.mock_type || 'Mock Exam'}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.className}`}>
              <span>{statusConfig.icon}</span>
              {statusConfig.label}
            </span>
          </div>

          {/* Booking details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <FiCalendar className="w-4 h-4 flex-shrink-0" />
              <span>{formatDate(booking.exam_date)}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <FiClock className="w-4 h-4 flex-shrink-0" />
              <span>{formatBookingTimeRange(booking)}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <FiMapPin className="w-4 h-4 flex-shrink-0" />
              <span>{booking.location || 'Location TBD'}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <FiHash className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-mono truncate">
                {booking.booking_number || booking.booking_id || 'Booking ID TBD'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => onViewDetails(booking)}
              className="flex-1 btn-outline text-sm py-2 flex items-center justify-center gap-2 hover:bg-gray-50"
              disabled={isCancelling}
            >
              <FiEye className="w-4 h-4" />
              View Details
            </button>

            {isUpcoming && (
              <button
                onClick={() => handleCancelClick(booking)}
                className="flex-1 btn-outline text-red-600 border-red-300 hover:bg-red-50 text-sm py-2 flex items-center justify-center gap-2"
                disabled={isCancelling}
              >
                <FiX className="w-4 h-4" />
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };


  // Render component
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState />;
  }

  if (!bookings || bookings.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookings.map((booking) => (
          <BookingCard key={booking.id || booking.recordId} booking={booking} />
        ))}
      </div>
      <DeleteBookingModal
        isOpen={deleteModalOpen}
        booking={bookingToDelete}
        isDeleting={isDeleting}
        error={deleteError}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};

BookingsList.propTypes = {
  bookings: PropTypes.array.isRequired,
  onCancelBooking: PropTypes.func.isRequired,
  onViewDetails: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string
};

export default BookingsList;