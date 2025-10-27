/**
 * BookingRow Component
 * Individual row in the bookings table
 */

import { formatDistanceToNow } from 'date-fns';

const BookingRow = ({ booking }) => {
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

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {/* Name */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {booking.first_name && booking.last_name
            ? `${booking.first_name} ${booking.last_name}`
            : booking.name || 'N/A'}
        </div>
      </td>

      {/* Email */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm text-gray-900 dark:text-gray-100">
          {booking.email || 'N/A'}
        </div>
      </td>

      {/* Student ID */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm text-gray-900 dark:text-gray-100">
          {formatStudentId(booking.student_id)}
        </div>
      </td>

      {/* Dominant Hand */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm text-gray-900 dark:text-gray-100">
          {formatDominantHand(booking.dominant_hand)}
        </div>
      </td>

      {/* Booking Date */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
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