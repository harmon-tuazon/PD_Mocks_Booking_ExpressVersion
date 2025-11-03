/**
 * BookingRow Component
 * Individual row in the bookings table
 *
 * Enhanced with attendance marking and cancellation:
 * - Checkbox for selection (attendance/cancellation mode)
 * - Attendance status badge
 * - Cancellation status display
 * - Selection highlighting
 * - Click to toggle selection
 */

import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTime } from '../../utils/timeFormatters';

const BookingRow = ({
  booking,
  isAttendanceMode = false,
  isCancellationMode = false,
  isSelected = false,
  onToggleSelection,
  isDisabled = false,
  hideTraineeInfo = false
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

  // Check if booking is cancelled (cannot be selected in cancellation mode)
  const isCancelled = booking.booking_status === 'cancelled' || booking.is_active === 'Cancelled';

  // Determine if selection mode is active
  const isSelectionMode = isAttendanceMode || isCancellationMode;

  // Determine if this row can be selected
  const canBeSelected = isSelectionMode && onToggleSelection && !isDisabled;

  // Handle row click in selection modes
  const handleRowClick = () => {
    if (canBeSelected) {
      onToggleSelection(booking.id, booking);
    }
  };

  // Handle checkbox change (receives boolean from onCheckedChange, not event)
  const handleCheckboxChange = () => {
    if (canBeSelected) {
      onToggleSelection(booking.id, booking);
    }
  };

  return (
    <tr
      className={`transition-colors ${
        isDisabled
          ? 'opacity-50 bg-gray-50 dark:bg-gray-900'
          : isSelected
          ? isCancellationMode
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-primary-50 dark:bg-primary-900/20'
          : canBeSelected
          ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={handleRowClick}
    >
      {/* Checkbox (only in selection modes) */}
      {isSelectionMode && (
        <td className="px-4 py-3 whitespace-nowrap text-center w-12">
          {isDisabled ? (
            <div className="flex items-center justify-center">
              <span className="text-xs text-gray-400 dark:text-gray-600">-</span>
            </div>
          ) : (
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer"
              disabled={isDisabled}
            />
          )}
        </td>
      )}

      {/* Name - Only show when not in trainee view */}
      {!hideTraineeInfo && (
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
            {booking.first_name && booking.last_name
              ? `${booking.first_name} ${booking.last_name}`
              : booking.name || 'N/A'}
          </div>
        </td>
      )}

      {/* Email - Only show when not in trainee view */}
      {!hideTraineeInfo && (
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <div className="text-xs text-gray-900 dark:text-gray-100">
            {booking.email || 'N/A'}
          </div>
        </td>
      )}

      {/* Student ID - Only show when not in trainee view */}
      {!hideTraineeInfo && (
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <div className="text-xs text-gray-900 dark:text-gray-100">
            {formatStudentId(booking.student_id)}
          </div>
        </td>
      )}

      {/* Dominant Hand - Only show when not in trainee view */}
      {!hideTraineeInfo && (
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <div className="text-xs text-gray-900 dark:text-gray-100">
            {formatDominantHand(booking.dominant_hand)}
          </div>
        </td>
      )}

      {/* Mock Type */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.mock_exam_type || '-'}
        </div>
      </td>

      {/* Exam Date */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.exam_date ?
            new Date(booking.exam_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : '-'}
        </div>
      </td>

      {/* Time (Start - End) */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.start_time && booking.end_time
            ? `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`
            : '-'}
        </div>
      </td>

      {/* Location */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.attending_location || '-'}
        </div>
      </td>

      {/* Dominant Hand - Always show now */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {formatDominantHand(booking.dominant_hand)}
        </div>
      </td>

      {/* Attendance/Cancellation Status */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        {isCancelled ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
            <XCircleIcon className="h-3 w-3 mr-1" />
            Cancelled
          </span>
        ) : booking.attendance && booking.attendance !== '' ? (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            booking.attendance === 'Yes' || booking.attendance === 'true'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : booking.attendance === 'No' || booking.attendance === 'false'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {booking.attendance === 'Yes' || booking.attendance === 'true' ? (
              <>
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Attended
              </>
            ) : booking.attendance === 'No' || booking.attendance === 'false' ? (
              <>
                <XCircleIcon className="h-3 w-3 mr-1" />
                Did Not Attend
              </>
            ) : (
              booking.attendance
            )}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            -
          </span>
        )}
      </td>

      {/* Status - Active/Cancelled/Completed */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        {(() => {
          let status = 'Active';
          let badgeClass = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';

          if (booking.is_active === 'Cancelled' || booking.is_active === 'cancelled' || isCancelled) {
            status = 'Cancelled';
            badgeClass = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
          } else if (booking.exam_date) {
            const examDate = new Date(booking.exam_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (examDate < today) {
              status = 'Completed';
              badgeClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
            }
          }

          return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
              {status}
            </span>
          );
        })()}
      </td>

      {/* Token Used */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-900 dark:text-gray-100">
          {booking.token_used || '-'}
        </div>
      </td>

      {/* Booking Date */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatBookingDate(booking.booking_date)}
        </div>
        {booking.booking_date && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {new Date(booking.booking_date).toLocaleDateString('en-US', {
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