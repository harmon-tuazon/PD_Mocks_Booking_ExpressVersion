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
          classes: 'bg-teal-100 text-teal-800'
        };
      case 'upcoming':
        return {
          label: 'Upcoming',
          classes: 'bg-primary-100 text-primary-800'
        };
      case 'full':
        return {
          label: 'Full',
          classes: 'bg-coral-100 text-coral-800'
        };
      case 'low':
        return {
          label: 'Low Bookings',
          classes: 'bg-primary-100 text-primary-800'
        };
      case 'past':
        return {
          label: 'Past',
          classes: 'bg-gray-100 text-gray-800'
        };
      case 'inactive':
        return {
          label: 'Inactive',
          classes: 'bg-gray-100 text-gray-600'
        };
      default:
        return {
          label: status,
          classes: 'bg-gray-100 text-gray-800'
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
