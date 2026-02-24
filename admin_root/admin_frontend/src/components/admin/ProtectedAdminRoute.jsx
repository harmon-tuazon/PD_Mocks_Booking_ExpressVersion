/**
 * Protected Admin Route Component
 * Allows admins and legacy users (no role). Redirects instructors to /instructor.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Instructors should not access admin routes
  if (user.user_role === 'instructor') {
    return <Navigate to="/instructor" replace />;
  }

  // Admin or legacy users (no role) can access
  return children;
};

export default ProtectedAdminRoute;