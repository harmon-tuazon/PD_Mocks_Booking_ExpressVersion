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

const SUPPORT_FORM_URL = 'https://rve7i.share.hsforms.com/2xIiXXRfGRz-Lmi8eMWjD_g';


/**
 * Floating Support Button Component
 * Opens support form in a new tab
 */
const FloatingSupportButton = () => {
  const handleClick = () => {
    window.open(SUPPORT_FORM_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 group"
      aria-label="Get help or support"
      title="Need help? Contact support"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      <span className="hidden sm:inline">Help</span>
    </button>
  );
};

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
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Mobile Header with Hamburger Menu */}
      {showSidebar && (
        <div className="lg:hidden bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors duration-200"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            PrepDoctors
          </div>

          <div className="flex items-center gap-2">
            <a
              href={SUPPORT_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors duration-200"
              aria-label="Get help or support"
              title="Need help? Contact support"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
            <DarkModeToggle />
          </div>
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

      {/* Floating Support Button - Only show when authenticated */}
      {showSidebar && <FloatingSupportButton />}
    </div>
  );
};

export default MainLayout;