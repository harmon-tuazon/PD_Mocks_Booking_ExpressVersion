import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * LoadingSpinner Component
 * Small loading spinner for search input
 */
const LoadingSpinner = ({ className = '' }) => {
  return (
    <svg
      className={`animate-spin h-5 w-5 text-gray-400 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
};

/**
 * SearchBar Component
 * Reusable search input with loading indicator and clear button
 * Keyboard accessible and responsive
 */
const SearchBar = ({
  value,
  onChange,
  loading = false,
  placeholder = "Search...",
  className = "",
  autoFocus = false,
  onClear
}) => {
  const inputRef = useRef(null);

  const handleClear = () => {
    onChange('');
    if (onClear) {
      onClear();
    }
    // Focus back to input after clearing
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Clear on Escape key
    if (e.key === 'Escape' && value) {
      handleClear();
    }
  };

  return (
    <div className={`max-w-xl mb-6 ${className}`}>
      <div className="relative">
        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-12 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent transition-colors"
          aria-label="Search"
        />

        {/* Right Side Icons */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {/* Loading Spinner */}
          {loading && <LoadingSpinner />}

          {/* Clear Button */}
          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Optional helper text for keyboard shortcuts */}
      {value && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Press <kbd className="px-1 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> to clear
        </p>
      )}
    </div>
  );
};

export default SearchBar;