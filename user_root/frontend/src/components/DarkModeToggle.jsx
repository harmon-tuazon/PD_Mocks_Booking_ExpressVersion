import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DarkModeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg transition-all duration-300
                 bg-gray-100 dark:bg-dark-card
                 hover:bg-gray-200 dark:hover:bg-dark-hover
                 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-6 h-6">
        {/* Sun icon */}
        <svg
          className={`absolute inset-0 w-6 h-6 transform transition-all duration-300 ${
            isDark ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>

        {/* Moon icon */}
        <svg
          className={`absolute inset-0 w-6 h-6 transform transition-all duration-300 ${
            isDark ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </div>
    </button>
  );
};

export default DarkModeToggle;