/**
 * Users Page
 * Placeholder page for user management under Data Management
 */

import { Users as UsersIcon } from 'lucide-react';

function Users() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container-app py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl font-bold text-navy-900 dark:text-gray-100">
            Users
          </h1>
          <p className="mt-2 font-body text-base text-gray-600 dark:text-gray-300">
            Manage system users and permissions
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm">
          <div className="text-center py-16">
            <UsersIcon className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              User Management
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              This page is under construction. User management features will be available soon.
            </p>
            <div className="mt-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Users;
