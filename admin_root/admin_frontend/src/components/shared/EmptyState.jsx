import React from 'react';

/**
 * EmptyState Component
 * A reusable component for displaying empty states with icon, heading, and description
 * Used across the application for consistent empty state messaging
 */
const EmptyState = ({
  icon,
  heading,
  description,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-lg ${className}`}>
      {icon && (
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          {icon}
        </div>
      )}
      {heading && (
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {heading}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
          {description}
        </p>
      )}
    </div>
  );
};

export default EmptyState;