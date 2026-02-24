/**
 * Protected Instructor Route Component
 * Only allows users with 'instructor' role to access
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ProtectedInstructorRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

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

  // Check if user has instructor role
  const userRole = user.user_role;

  if (userRole !== 'instructor') {
    // Non-instructors trying to access instructor routes - redirect to admin dashboard
    return <Navigate to="/mock-exams" replace />;
  }

  return children;
};

export default ProtectedInstructorRoute;
