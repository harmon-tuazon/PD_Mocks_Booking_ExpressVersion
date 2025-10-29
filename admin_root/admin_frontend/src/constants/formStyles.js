// Standardized form input classes for consistent styling across the application
// These classes ensure modern, consistent styling that overrides browser defaults

export const modernInputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150 text-sm placeholder-gray-400 dark:placeholder-gray-500";

export const modernSelectClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150 text-sm appearance-none";

export const modernDateTimeClasses = "block w-full pl-3 pr-10 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150 text-sm";

export const modernCheckboxClasses = "h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded transition-colors duration-150";

export const modernTextareaClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-150 text-sm placeholder-gray-400 dark:placeholder-gray-500 resize-none";

export const modernLabelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

export const modernFormGroupClasses = "space-y-1";

export const modernFormRowClasses = "flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0";

// Error state classes
export const inputErrorClasses = "border-red-500 dark:border-red-400 focus:ring-red-500 focus:border-red-500";

// Disabled state classes
export const inputDisabledClasses = "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800";

// Helper function to combine classes conditionally
export const getInputClasses = (baseClasses, hasError = false, isDisabled = false) => {
  let classes = baseClasses;

  if (hasError) {
    classes = classes.replace(/border-gray-300 dark:border-gray-600/, inputErrorClasses);
  }

  if (isDisabled) {
    classes += ` ${inputDisabledClasses}`;
  }

  return classes;
};