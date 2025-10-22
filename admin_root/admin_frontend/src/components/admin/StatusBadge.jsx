/**
 * StatusBadge Component
 * Displays status indicators for mock exams
 */

const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'upcoming':
        return {
          label: 'Upcoming',
          classes: 'bg-green-100 text-green-800',
          icon: '🟢'
        };
      case 'full':
        return {
          label: 'Full',
          classes: 'bg-red-100 text-red-800',
          icon: '🔴'
        };
      case 'low':
        return {
          label: 'Low Bookings',
          classes: 'bg-yellow-100 text-yellow-800',
          icon: '🟡'
        };
      case 'past':
        return {
          label: 'Past',
          classes: 'bg-gray-100 text-gray-800',
          icon: '⚫'
        };
      case 'inactive':
        return {
          label: 'Inactive',
          classes: 'bg-orange-100 text-orange-800',
          icon: '🟠'
        };
      default:
        return {
          label: status,
          classes: 'bg-gray-100 text-gray-800',
          icon: ''
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
