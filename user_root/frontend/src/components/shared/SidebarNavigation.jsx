import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserSession, clearUserSession, setUserSession as updateUserSession } from '../../utils/auth';
import { ResponsiveLogo } from './Logo';
import DarkModeToggle from '../DarkModeToggle';
import NDECCExamDateModal from './NDECCExamDateModal';
import apiService from '../../services/api';
import { formatShortDate } from '../../utils/dateFormatting';

const SUPPORT_FORM_URL = 'https://rve7i.share.hsforms.com/2xIiXXRfGRz-Lmi8eMWjD_g';

/**
 * Sidebar Navigation Component
 *
 * A responsive vertical navigation component with submenus for the PrepDoctors app
 * - Desktop: Full vertical sidebar with expandable submenus
 * - Mobile: Collapsible hamburger menu
 * - Includes PrepDoctors branding and active state indicators
 */
const SidebarNavigation = ({ isOpen, setIsOpen, className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // Submenu state
  const [mocksOpen, setMocksOpen] = useState(false);
  const [workCheckOpen, setWorkCheckOpen] = useState(false);
  const mocksRef = useRef(null);
  const workCheckRef = useRef(null);
  const mocksTimeoutRef = useRef(null);
  const workCheckTimeoutRef = useRef(null);

  // Check for user session on mount
  useEffect(() => {
    const session = getUserSession();
    setUserSession(session);
  }, [location.pathname]);

  // Handle delayed close for Mocks submenu
  const handleMocksMouseLeave = () => {
    mocksTimeoutRef.current = setTimeout(() => {
      setMocksOpen(false);
    }, 200);
  };

  const handleMocksMouseEnter = () => {
    if (mocksTimeoutRef.current) {
      clearTimeout(mocksTimeoutRef.current);
      mocksTimeoutRef.current = null;
    }
  };

  // Handle delayed close for Work Check submenu
  const handleWorkCheckMouseLeave = () => {
    workCheckTimeoutRef.current = setTimeout(() => {
      setWorkCheckOpen(false);
    }, 200);
  };

  const handleWorkCheckMouseEnter = () => {
    if (workCheckTimeoutRef.current) {
      clearTimeout(workCheckTimeoutRef.current);
      workCheckTimeoutRef.current = null;
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (mocksTimeoutRef.current) clearTimeout(mocksTimeoutRef.current);
      if (workCheckTimeoutRef.current) clearTimeout(workCheckTimeoutRef.current);
    };
  }, []);

  // Mocks submenu items
  const mocksItems = [
    {
      name: 'Book Mocks',
      href: '/book/exam-types',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Mock Discussions',
      href: '/book/discussions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      )
    },
    {
      name: 'My Bookings',
      href: '/my-bookings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    }
  ];

  // Work Check submenu items
  const workCheckItems = [
    {
      name: 'Book Work Check',
      href: '/book/work-check',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      name: 'My Work Checks',
      href: '/my-work-checks',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    }
  ];

  // Check if current path is active
  const isActivePath = (href) => {
    return location.pathname === href;
  };

  // Check if any mocks submenu item is active
  const isMocksActive = () => {
    return mocksItems.some(item =>
      location.pathname === item.href ||
      (location.pathname.startsWith('/book') &&
       !location.pathname.startsWith('/book/work-check') &&
       !location.pathname.startsWith('/book/discussions') &&
       !location.pathname.startsWith('/book/mock-discussion') &&
       item.href === '/book/exam-types')
    ) || location.pathname.startsWith('/book/mock-discussion') ||
       location.pathname.startsWith('/booking/confirmation');
  };

  // Check if any work check submenu item is active
  const isWorkCheckActive = () => {
    return workCheckItems.some(item =>
      location.pathname === item.href ||
      location.pathname.startsWith(item.href)
    );
  };

  // Handle navigation
  const handleNavigation = (href) => {
    navigate(href);
    // Close mobile menu after navigation
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
    // Close submenus
    setMocksOpen(false);
    setWorkCheckOpen(false);
  };

  // Handle logout
  const handleLogout = () => {
    clearUserSession();
    setUserSession(null);
    navigate('/login');
    setIsOpen(false);
  };

  // Handle NDECC exam date save
  const handleSaveExamDate = async (examDate) => {
    if (!userSession) {
      throw new Error('No user session found');
    }

    try {
      // Call API to update exam date
      await apiService.user.updateNDECCExamDate(
        userSession.studentId,
        userSession.email,
        examDate
      );

      // Update local user session with new date
      const updatedSession = {
        ...userSession,
        ndeccExamDate: examDate
      };
      updateUserSession(updatedSession);
      setUserSession(updatedSession);

      return Promise.resolve();
    } catch (error) {
      console.error('Failed to update NDECC exam date:', error);
      throw new Error(error.response?.data?.error?.message || 'Failed to update exam date');
    }
  };

  // Don't show navigation on login page or if not authenticated
  if (location.pathname === '/login' || !userSession) {
    return null;
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Full viewport height */}
      <div className={`
        fixed top-0 left-0 h-screen w-64 bg-white dark:bg-dark-sidebar border-r border-gray-200 dark:border-dark-border shadow-lg
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:shadow-none
        ${className}
      `}>
        <div className="flex flex-col h-full">
          {/* Header with Logo */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center">
              <ResponsiveLogo
                size="medium"
                className="transition-opacity duration-300 hover:opacity-80 cursor-pointer"
                onClick={() => handleNavigation('/dashboard')}
              />
            </div>

            {/* Close button - Mobile only */}
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors duration-200"
              aria-label="Close navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Ultra-Compact User Info Section */}
          {userSession && (
            <div className="px-6 pb-4 border-b border-gray-200 dark:border-dark-border">
              {/* User Details Card - Ultra-compact */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-2 space-y-1">
                {/* Student Name */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs font-semibold text-primary-900 dark:text-primary-200 truncate">
                    {userSession.studentName || 'Student'}
                  </span>
                </div>

                {/* Student ID */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-300 truncate">
                    {userSession.studentId}
                  </span>
                </div>

                {/* Email */}
                <div className="flex items-start gap-1.5">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-primary-700 dark:text-primary-300 break-words leading-snug">
                    {userSession.email}
                  </span>
                </div>

                {/* NDECC Exam Date - Single line, no separator */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300 truncate">
                      NDECC: {formatShortDate(userSession.ndeccExamDate)}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsDateModalOpen(true)}
                    className="p-1 rounded-md hover:bg-primary-200 dark:hover:bg-primary-700/50 transition-colors duration-200 flex-shrink-0 group"
                    title={userSession.ndeccExamDate ? 'Edit exam date' : 'Set exam date'}
                    aria-label={userSession.ndeccExamDate ? 'Edit exam date' : 'Set exam date'}
                  >
                    <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 px-6 py-6 overflow-y-auto">
            <ul className="space-y-3">
              {/* Home (Dashboard) */}
              <li>
                <button
                  onClick={() => handleNavigation('/dashboard')}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${isActivePath('/dashboard')
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`mr-3 flex-shrink-0 ${isActivePath('/dashboard') ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </span>
                  <span className="flex-1">Home</span>
                  {isActivePath('/dashboard') && (
                    <span className="ml-auto">
                      <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              </li>

              {/* Mocks Menu with Submenu */}
              <li
                ref={mocksRef}
                className="relative"
                onMouseEnter={handleMocksMouseEnter}
                onMouseLeave={handleMocksMouseLeave}
              >
                <button
                  onClick={() => setMocksOpen(!mocksOpen)}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${mocksOpen || isMocksActive()
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`mr-3 flex-shrink-0 ${mocksOpen || isMocksActive() ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </span>
                  <span className="flex-1">Mocks</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${mocksOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Mocks Submenu Dropdown */}
                {mocksOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleMocksMouseEnter}
                    onMouseLeave={handleMocksMouseLeave}
                  >
                    <div className="py-2">
                      {mocksItems.map((subItem) => (
                        <button
                          key={subItem.name}
                          onClick={() => {
                            handleNavigation(subItem.href);
                            setMocksOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-4 py-2.5 text-sm font-medium
                            transition-all duration-200 text-left
                            ${isActivePath(subItem.href)
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover hover:text-gray-900 dark:hover:text-gray-100'
                            }
                          `}
                        >
                          <span className={`mr-3 ${isActivePath(subItem.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {subItem.icon}
                          </span>
                          <span>{subItem.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>

              {/* Work Checks Menu with Submenu */}
              <li
                ref={workCheckRef}
                className="relative"
                onMouseEnter={handleWorkCheckMouseEnter}
                onMouseLeave={handleWorkCheckMouseLeave}
              >
                <button
                  onClick={() => setWorkCheckOpen(!workCheckOpen)}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${workCheckOpen || isWorkCheckActive()
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`mr-3 flex-shrink-0 ${workCheckOpen || isWorkCheckActive() ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </span>
                  <span className="flex-1">Work Checks</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${workCheckOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Work Checks Submenu Dropdown */}
                {workCheckOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleWorkCheckMouseEnter}
                    onMouseLeave={handleWorkCheckMouseLeave}
                  >
                    <div className="py-2">
                      {workCheckItems.map((subItem) => (
                        <button
                          key={subItem.name}
                          onClick={() => {
                            handleNavigation(subItem.href);
                            setWorkCheckOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-4 py-2.5 text-sm font-medium
                            transition-all duration-200 text-left
                            ${isActivePath(subItem.href)
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover hover:text-gray-900 dark:hover:text-gray-100'
                            }
                          `}
                        >
                          <span className={`mr-3 ${isActivePath(subItem.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {subItem.icon}
                          </span>
                          <span>{subItem.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>

              {/* My Progress */}
              <li>
                <button
                  onClick={() => handleNavigation('/my-progress')}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${isActivePath('/my-progress')
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`mr-3 flex-shrink-0 ${isActivePath('/my-progress') ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span className="flex-1">My Progress</span>
                  {isActivePath('/my-progress') && (
                    <span className="ml-auto">
                      <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            </ul>
          </nav>

          {/* Footer Section - More spacious */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
            {/* Dark Mode Toggle - Desktop Only */}
            <div className="hidden lg:flex justify-center mb-4">
              <DarkModeToggle />
            </div>

            {/* Support Link */}
            <a
              href={SUPPORT_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm hover:shadow mb-2"
            >
              <svg className="w-5 h-5 mr-3 text-primary-500 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get Help
            </a>

            {userSession && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-dark-card rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm hover:shadow"
              >
                <svg className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            )}

            {/* Version and Support Info */}
            <div className="mt-4 space-y-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                PrepDoctors v1.5.0
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                © 2025 PrepDoctors
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NDECC Exam Date Modal */}
      <NDECCExamDateModal
        isOpen={isDateModalOpen}
        currentDate={userSession?.ndeccExamDate}
        onSave={handleSaveExamDate}
        onClose={() => setIsDateModalOpen(false)}
      />
    </>
  );
};

export default SidebarNavigation;
