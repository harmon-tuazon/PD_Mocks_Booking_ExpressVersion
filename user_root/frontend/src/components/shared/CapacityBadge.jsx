import React from 'react';

const CapacityBadge = ({ availableSlots, capacity, size = 'normal' }) => {
  // Simplified badge: just "Available" or "Full" based on business logic
  const isAvailable = availableSlots > 0;

  let colorClass = '';
  let text = '';

  if (isAvailable) {
    colorClass = 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700';
    text = 'Available';
  } else {
    colorClass = 'bg-cool-grey dark:bg-dark-hover text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-dark-border';
    text = 'Full';
  }

  const sizeClass = size === 'large'
    ? 'px-3 py-1.5 text-sm font-subheading font-semibold'
    : 'px-2.5 py-0.5 text-xs font-subheading font-medium';

  return (
    <span className={`inline-flex items-center rounded-full transition-all duration-200 ${sizeClass} ${colorClass}`}>
      {text}
    </span>
  );
};

export default CapacityBadge;
