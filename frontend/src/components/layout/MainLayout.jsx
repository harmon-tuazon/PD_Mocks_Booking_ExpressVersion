import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SidebarNavigation from '../shared/SidebarNavigation';
import DarkModeToggle from '../DarkModeToggle';
import { getUserSession } from '../../utils/auth';

/**
 * Main Layout Component
 *
 * Provides the main application layout with:
 * - Responsive sidebar navigation
 * - Mobile hamburger menu
 * - Proper content area adjustment
 * - Authentication-aware layout
 */
const MainLayout = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSession, setUserSession] = useState(null);

  // Check for user session
  useEffect(() => {
    const session = getUserSession();
    setUserSession(session);
  }, [location.pathname]);

  // Close sidebar on route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when sidebar is open on mobile
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  // Don't show layout on login page or if not authenticated
  const showSidebar = location.pathname !== '/login' && userSession;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header with Hamburger Menu */}
      {showSidebar && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            PrepDoctors
          </div>

          <DarkModeToggle />
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar Navigation - Full height */}
        {showSidebar && (
          <SidebarNavigation
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
          />
        )}

        {/* Main Content Area - Full height with scroll */}
        <main className="flex-1 transition-all duration-300 ease-in-out overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;