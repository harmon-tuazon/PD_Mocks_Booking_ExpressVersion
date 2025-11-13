/**
 * StatusBadge Component
 * Displays status indicators for mock exams
 */

const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          classes: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
        };
      case 'upcoming':
        return {
          label: 'Upcoming',
          classes: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300'
        };
      case 'full':
        return {
          label: 'Full',
          classes: 'bg-coral-100 text-coral-800 dark:bg-red-900/30 dark:text-red-300'
        };
      case 'low':
        return {
          label: 'Low Bookings',
          classes: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300'
        };
      case 'past':
        return {
          label: 'Past',
          classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        };
      case 'inactive':
        return {
          label: 'Inactive',
          classes: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        };
      case 'scheduled':
        return {
          label: 'Scheduled',
          classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        };
      default:
        return {
          label: status,
          classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
