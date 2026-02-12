import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ResponsiveLogo } from './Logo';
import DarkModeToggle from './DarkModeToggle';

/**
 * Sidebar Navigation Component (Admin)
 *
 * A responsive vertical navigation component for the PrepDoctors Admin Dashboard
 * - Desktop: Full vertical sidebar
 * - Mobile: Collapsible hamburger menu
 * - Includes PrepDoctors branding and active state indicators
 * - Data Management submenu with hover-to-close behavior
 */
const SidebarNavigation = ({ isOpen, setIsOpen, className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [dataManagementOpen, setDataManagementOpen] = useState(false);
  const [workCheckOpen, setWorkCheckOpen] = useState(false);
  const dataManagementRef = useRef(null);
  const workCheckRef = useRef(null);
  const dataManagementTimeoutRef = useRef(null);
  const workCheckTimeoutRef = useRef(null);

  // Handle delayed close for Data Management submenu
  const handleDataManagementMouseLeave = () => {
    dataManagementTimeoutRef.current = setTimeout(() => {
      setDataManagementOpen(false);
    }, 200);
  };

  const handleDataManagementMouseEnter = () => {
    if (dataManagementTimeoutRef.current) {
      clearTimeout(dataManagementTimeoutRef.current);
      dataManagementTimeoutRef.current = null;
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

  const isInstructor = user?.user_role === 'instructor';
  const homeRoute = isInstructor ? '/instructor' : '/mock-exams';
  const roleBadge = isInstructor ? 'Instructor' : 'Administrator';

  // Navigation items for instructor (single dashboard)
  const instructorNavigationItems = [
    {
      name: 'Dashboard',
      href: '/instructor',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      requiresAuth: true
    }
  ];

  // Navigation items for admin
  const navigationItems = [
    {
      name: 'Mocks Dashboard',
      href: '/mock-exams',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      requiresAuth: true
    },
    {
      name: 'Trainees Dashboard',
      href: '/trainees',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      requiresAuth: true
    }
  ];

  // Data Management submenu items
  const dataManagementItems = [
    {
      name: 'Users',
      href: '/data-management/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      name: 'Import Bookings',
      href: '/data-management/bulk-bookings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    {
      name: 'Import Mocks',
      href: '/data-management/bulk-mocks',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  // Work Check submenu items
  const workCheckItems = [
    {
      name: 'Groups',
      href: '/work-check/groups',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: 'Instructors',
      href: '/work-check/instructors',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 14l9-5-9-5-9 5 9 5z" />
          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        </svg>
      )
    },
    {
      name: 'Slots',
      href: '/work-check/slots',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Bookings',
      href: '/work-check/bookings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    }
  ];

  // Check if current path is active
  const isActivePath = (href) => {
    return location.pathname === href || location.pathname.startsWith(href);
  };

  // Handle navigation
  const handleNavigation = (href) => {
    navigate(href);
    // Close mobile menu after navigation
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    setIsOpen(false);
  };

  // Don't show navigation on login page or if not authenticated
  if (location.pathname === '/login' || !user) {
    return null;
  }

  // Filter nav items based on role and auth requirements
  const baseItems = isInstructor ? instructorNavigationItems : navigationItems;
  const visibleNavItems = baseItems.filter(item =>
    !item.requiresAuth || user
  );

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
                className="transition-opacity duration-300 hover:opacity-80"
                onClick={() => handleNavigation(homeRoute)}
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

          {/* Enhanced User Info Section */}
          {user && (
            <div className="px-6 pb-4 border-b border-gray-200 dark:border-dark-border">
              {/* User Details Card */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-2 space-y-1">
                {/* Admin Email */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs font-medium text-primary-900 dark:text-primary-200 truncate">
                    {user.email}
                  </span>
                </div>

                {/* Role Badge */}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {roleBadge}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items - More spacious */}
          <nav className="flex-1 px-6 py-6 overflow-y-auto">
            <ul className="space-y-3">
              {visibleNavItems.map((item) => {
                const isActive = isActivePath(item.href);

                return (
                  <li key={item.name}>
                    <button
                      onClick={() => handleNavigation(item.href)}
                      className={`
                        w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                        transition-all duration-200 text-left
                        ${isActive
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                        }
                        focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                      `}
                    >
                      <span className={`
                        mr-3 flex-shrink-0
                        ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}
                      `}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.name}</span>

                      {/* Active indicator */}
                      {isActive && (
                        <span className="ml-auto">
                          <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}

              {/* Work Check Menu with Submenu (admin only) */}
              {!isInstructor && <li
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
                    ${workCheckOpen || location.pathname.startsWith('/work-check')
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`
                    mr-3 flex-shrink-0
                    ${workCheckOpen || location.pathname.startsWith('/work-check')
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    {/* Clipboard Check Icon for Work Check */}
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </span>
                  <span className="flex-1">Work Check</span>

                  {/* Chevron indicator */}
                  <span className="ml-auto">
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${workCheckOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>

                {/* Work Check Submenu */}
                {workCheckOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleWorkCheckMouseEnter}
                    onMouseLeave={handleWorkCheckMouseLeave}
                  >
                    <div className="py-2">
                      {workCheckItems.map((subItem) => {
                        const isSubActive = isActivePath(subItem.href);

                        return (
                          <button
                            key={subItem.name}
                            onClick={() => {
                              handleNavigation(subItem.href);
                              setWorkCheckOpen(false);
                            }}
                            className={`
                              w-full flex items-center px-4 py-2.5 text-sm font-medium
                              transition-all duration-200 text-left
                              ${isSubActive
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                              }
                            `}
                          >
                            <span className={`
                              mr-3 flex-shrink-0
                              ${isSubActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}
                            `}>
                              {subItem.icon}
                            </span>
                            <span>{subItem.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>}

              {/* Data Management Menu with Submenu (admin only) */}
              {!isInstructor && <li
                ref={dataManagementRef}
                className="relative"
                onMouseEnter={handleDataManagementMouseEnter}
                onMouseLeave={handleDataManagementMouseLeave}
              >
                <button
                  onClick={() => setDataManagementOpen(!dataManagementOpen)}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${dataManagementOpen || location.pathname.startsWith('/data-management')
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  `}
                >
                  <span className={`
                    mr-3 flex-shrink-0
                    ${dataManagementOpen || location.pathname.startsWith('/data-management')
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    {/* Database/Data Management Icon */}
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </span>
                  <span className="flex-1">Data Management</span>

                  {/* Chevron indicator */}
                  <span className="ml-auto">
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${dataManagementOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>

                {/* Submenu - fixed position to overlay on main content area */}
                {dataManagementOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleDataManagementMouseEnter}
                    onMouseLeave={handleDataManagementMouseLeave}
                  >
                    <div className="py-2">
                      {dataManagementItems.map((subItem) => {
                        const isSubActive = isActivePath(subItem.href);

                        return (
                          <button
                            key={subItem.name}
                            onClick={() => {
                              handleNavigation(subItem.href);
                              setDataManagementOpen(false);
                            }}
                            className={`
                              w-full flex items-center px-4 py-2.5 text-sm font-medium
                              transition-all duration-200 text-left
                              ${isSubActive
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-hover'
                              }
                            `}
                          >
                            <span className={`
                              mr-3 flex-shrink-0
                              ${isSubActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}
                            `}>
                              {subItem.icon}
                            </span>
                            <span>{subItem.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>}
            </ul>
          </nav>

          {/* Footer Section - More spacious */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
            {/* Dark Mode Toggle - Desktop Only */}
            <div className="hidden lg:flex justify-center mb-4">
              <DarkModeToggle />
            </div>

            {user && (
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
                PrepDoctors Admin v1.5.0
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                © 2025 PrepDoctors
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SidebarNavigation;
