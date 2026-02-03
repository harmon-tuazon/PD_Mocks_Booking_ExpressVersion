/**
 * Groups Page
 * Main dashboard for Workcheck Group Management
 * Allows admins to manage training groups, assign students and instructors
 */

import { useState } from 'react';
import { Users, UserCheck, Calendar, FolderOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * Permission check stub for future RBAC implementation
 * Currently always returns true per "Authentication-Only Model"
 * See CLAUDE.md: Authentication Policy section
 */
const usePermission = (permission) => {
  // TODO: Implement actual RBAC when needed
  // For now, any authenticated user has full access
  return true;
};

/**
 * Statistics card component for displaying group metrics
 */
const StatCard = ({ name, value, icon, bgColor, textColor, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg animate-pulse">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-md p-3 w-12 h-12"></div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-card overflow-hidden shadow dark:shadow-gray-900/50 rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${bgColor} dark:bg-opacity-20 rounded-md p-3`}>
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {name}
              </dt>
              <dd>
                <div className={`text-2xl font-semibold ${textColor} dark:text-gray-100`}>
                  {value}
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

function Groups() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    filter_status: 'all',
    search: ''
  });

  // Check permission using stub (future RBAC implementation)
  const hasViewPermission = usePermission('groups.view');

  // Access denied view for unauthorized users
  if (!hasViewPermission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
        <div className="container-app py-8">
          <div className="text-center py-12">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              You don't have permission to view workcheck groups.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder statistics (will be populated from API later)
  const stats = [
    {
      name: 'Total Groups',
      value: '--',
      icon: <FolderOpen className="h-6 w-6 text-primary-600" />,
      bgColor: 'bg-primary-50',
      textColor: 'text-primary-600'
    },
    {
      name: 'Active Groups',
      value: '--',
      icon: <Calendar className="h-6 w-6 text-teal-600" />,
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600'
    },
    {
      name: 'Total Students',
      value: '--',
      icon: <Users className="h-6 w-6 text-blue-600" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      name: 'Instructors Assigned',
      value: '--',
      icon: <UserCheck className="h-6 w-6 text-coral-600" />,
      bgColor: 'bg-coral-50',
      textColor: 'text-coral-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
              Workcheck Group Management
            </h1>
            <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
              Manage training groups, assign students and instructors
            </p>
          </div>
          <div>
            {/* Create Group Button - Disabled until API is ready */}
            <button
              disabled
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Coming soon - API endpoints need to be created first"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Group
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {stats.map((stat) => (
            <StatCard
              key={stat.name}
              name={stat.name}
              value={stat.value}
              icon={stat.icon}
              bgColor={stat.bgColor}
              textColor={stat.textColor}
              isLoading={false}
            />
          ))}
        </div>

        {/* Placeholder Content */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
          {/* Section Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Groups
            </h2>
          </div>

          {/* Placeholder Message */}
          <div className="p-6">
            <div className="text-center py-12">
              <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <FolderOpen className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Group Management Coming Soon
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                The group management table will be implemented here once the backend API endpoints are created.
                This page will allow you to:
              </p>
              <ul className="mt-4 text-sm text-gray-500 dark:text-gray-400 space-y-2">
                <li className="flex items-center justify-center">
                  <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create and manage training groups
                </li>
                <li className="flex items-center justify-center">
                  <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Assign students to groups
                </li>
                <li className="flex items-center justify-center">
                  <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Assign instructors to groups
                </li>
                <li className="flex items-center justify-center">
                  <svg className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View group schedules and attendance
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Development Notes Section */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Development Notice
              </h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                <p>
                  This page is a placeholder for the Workcheck Group Management feature.
                  The following backend components need to be implemented:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>API endpoint: GET /api/admin/groups/list</li>
                  <li>API endpoint: POST /api/admin/groups/create</li>
                  <li>API endpoint: PUT /api/admin/groups/:id</li>
                  <li>API endpoint: DELETE /api/admin/groups/:id</li>
                  <li>Supabase table: workcheck_groups</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Groups;
