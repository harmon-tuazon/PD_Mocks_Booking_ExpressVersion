/**
 * WorkCheckBookingStatusBadge Component
 * Status badge for work check booking status
 */

const STATUS_STYLES = {
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
    label: 'Pending'
  },
  confirmed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
    label: 'Confirmed'
  },
  marked: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
    label: 'Marked'
  },
  completed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
    label: 'Completed'
  },
  rejected: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    label: 'Rejected'
  },
  cancelled: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-800 dark:text-gray-300',
    label: 'Cancelled'
  }
};

const WorkCheckBookingStatusBadge = ({ status }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

export default WorkCheckBookingStatusBadge;
