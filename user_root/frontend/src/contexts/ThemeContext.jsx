import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the context
const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme Provider component
export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    // Always default to 'light' if no saved theme or if saved theme is invalid
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    return 'light'; // Default to light mode
  });

  // Update the HTML element class and localStorage when theme changes
  useEffect(() => {
    const root = document.documentElement;

    // Ensure we start with clean state
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark'); // Remove dark class for light mode
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Set specific theme
  const setThemeMode = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
    }
  };

  const value = {
    theme,
    toggleTheme,
    setThemeMode,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;