import React from 'react';
import { Navigate } from 'react-router-dom';
import { getUserSession } from '../utils/auth';

/**
 * Protected route wrapper that checks for user authentication
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const user = getUserSession();

  if (!user) {
    // Not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected component
  return children;
};

export default ProtectedRoute;