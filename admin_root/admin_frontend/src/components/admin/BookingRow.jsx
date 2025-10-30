/**
 * BookingRow Component
 * Individual row in the bookings table
 *
 * Enhanced with attendance marking:
 * - Checkbox for selection (attendance mode only)
 * - Attendance status badge
 * - Selection highlighting
 * - Click to toggle selection
 */

import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { Checkbox } from '@/components/ui/checkbox';

const BookingRow = ({
  booking,
  isAttendanceMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  // Format dominant hand display
  const formatDominantHand = (hand) => {
    if (!hand) return 'N/A';
    const handLower = hand.toLowerCase();
    if (handLower === 'right' || handLower === 'r') return 'Right';
    if (handLower === 'left' || handLower === 'l') return 'Left';
    return hand;
  };

  // Format booking date as relative time
  const formatBookingDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  // Format student ID for display
  const formatStudentId = (id) => {
    if (!id) return 'N/A';
    return id;
  };

  // Check if booking is cancelled (cannot be selected)
  const isCancelled = booking.booking_status === 'cancelled';

  // Handle row click in attendance mode
  const handleRowClick = () => {
    if (isAttendanceMode && onToggleSelection && !isCancelled) {
      onToggleSelection(booking.id, booking);
    }
  };

  // Handle checkbox click (prevent row click event)
  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onToggleSelection && !isCancelled) {
      onToggleSelection(booking.id, booking);
    }
  };

  return (
    <tr
      className={`transition-colors ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : isAttendanceMode && !isCancelled
          ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={handleRowClick}
    >
      {/* Checkbox (only in attendance mode) */}
      {isAttendanceMode && (
        <td className="px-4 py-3 whitespace-nowrap text-center w-12">
          {isCancelled ? (
            <div className="flex items-center justify-center">
              <span className="text-xs text-gray-400 dark:text-gray-600">-</span>
            </div>
          ) : (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(booking.id, booking)}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer"
            />
          )}
        </td>
      )}

      {/* Name */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
          {booking.first_name && booking.last_name
            ? `${booking.first_name} ${booking.last_name}`
            : booking.name || 'N/A'}
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.email || 'N/A'}
        </div>
      </td>

      {/* Student ID */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {formatStudentId(booking.student_id)}
        </div>
      </td>

      {/* Dominant Hand */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {formatDominantHand(booking.dominant_hand)}
        </div>
      </td>

      {/* Attendance Status - Moved before booking date */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        {booking.attendance && booking.attendance !== '' ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
            {booking.attendance}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            -
          </span>
        )}
      </td>

      {/* Attending Location */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.attending_location || '-'}
        </div>
      </td>

      {/* Token Used */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.token_used || '-'}
        </div>
      </td>

      {/* NDECC Exam Date */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.ndecc_exam_date ?
            new Date(booking.ndecc_exam_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : '-'}
        </div>
      </td>

      {/* Booking Date */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatBookingDate(booking.created_at)}
        </div>
        {booking.created_at && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {new Date(booking.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </td>
    </tr>
  );
};

export default BookingRow;