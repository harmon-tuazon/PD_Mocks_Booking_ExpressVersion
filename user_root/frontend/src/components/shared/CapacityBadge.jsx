import React from 'react';

const CapacityBadge = ({ availableSlots, capacity, size = 'normal' }) => {
  const percentage = capacity > 0 ? (availableSlots / capacity) * 100 : 0;

  let colorClass = '';
  let text = '';

  if (availableSlots === 0) {
    colorClass = 'bg-cool-grey dark:bg-dark-hover text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-dark-border';
    text = 'Full';
  } else if (percentage <= 20) {
    colorClass = 'bg-coral-100 dark:bg-red-900/30 text-coral-800 dark:text-red-300 border border-coral-200 dark:border-red-700';
    text = availableSlots === 1 ? '1 slot left' : `${availableSlots} slots left`;
  } else {
    colorClass = 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700';
    text = `${availableSlots} slots available`;
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
