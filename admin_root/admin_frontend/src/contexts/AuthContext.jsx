/**
 * Authentication Context Provider
 * Manages auth state and provides auth methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, auth as authHelpers } from '../utils/supabaseClient';
import axios from 'axios';

// Configure axios defaults
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
axios.defaults.baseURL = API_BASE_URL;

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  // Set axios auth header when session changes
  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [session]);

  // Simplified: Just check if user exists (no role checking)
  // Legacy functions kept for backward compatibility but always return true
  const isAdmin = () => {
    return !!user; // Any authenticated user is considered "admin"
  };

  const isSuperAdmin = () => {
    return !!user; // Any authenticated user
  };

  const hasPermission = (permission) => {
    return !!user; // Any authenticated user has all permissions
  };

  // Fetch user details and permissions from backend
  const fetchUserDetails = async (accessToken) => {
    try {
      const response = await axios.get('/admin/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.data?.user_metadata?.permissions) {
        setPermissions(response.data.user_metadata.permissions);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching user details:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const { session: currentSession, error } = await authHelpers.getSession();

        if (currentSession) {
          // Accept any authenticated user (no role checking)
          const { user: currentUser } = currentSession;

          setSession(currentSession);
          setUser(currentUser);

          // Fetch additional user details
          const userDetails = await fetchUserDetails(currentSession.access_token);
          if (userDetails) {
            setUser({ ...currentUser, ...userDetails });
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen to auth changes
    const { data: { subscription } } = authHelpers.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' && newSession) {
        const { user: newUser } = newSession;

        // Accept any authenticated user (no role checking)
        setSession(newSession);
        setUser(newUser);

        // Fetch additional user details
        const userDetails = await fetchUserDetails(newSession.access_token);
        if (userDetails) {
          setUser({ ...newUser, ...userDetails });
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setPermissions([]);
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign in method
  const signIn = async (email, password, rememberMe = false) => {
    try {
      // Make request to our backend login endpoint
      const response = await axios.post('/admin/auth/login', {
        email,
        password,
        rememberMe
      });

      if (response.data?.session) {
        const { session: newSession } = response.data;

        // Set Supabase session
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token
        });

        return { success: true };
      }

      return {
        success: false,
        error: response.data?.error || 'Login failed'
      };
    } catch (error) {
      console.error('Login error:', error);

      // Handle rate limiting
      if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Too many login attempts. Please try again in 15 minutes.'
        };
      }

      // Handle invalid credentials
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Handle forbidden
      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      return {
        success: false,
        error: error.response?.data?.error?.message || 'An error occurred during login'
      };
    }
  };

  // Sign out method
  const signOut = async () => {
    try {
      // Call backend logout endpoint
      await axios.post('/admin/auth/logout');

      // Sign out from Supabase
      await authHelpers.signOut();

      // Clear state
      setUser(null);
      setSession(null);
      setPermissions([]);

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);

      // Even if backend fails, clear local state
      await authHelpers.signOut();
      setUser(null);
      setSession(null);
      setPermissions([]);

      return { success: true };
    }
  };

  // Validate session
  const validateSession = async () => {
    try {
      const response = await axios.get('/admin/auth/validate');
      return response.data?.valid === true;
    } catch (error) {
      return false;
    }
  };

  // Refresh token
  const refreshToken = async () => {
    try {
      const response = await axios.post('/admin/auth/refresh');

      if (response.data?.session) {
        const { session: newSession } = response.data;

        // Update Supabase session
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token
        });

        return { success: true };
      }

      return { success: false };
    } catch (error) {
      console.error('Token refresh error:', error);
      return { success: false };
    }
  };

  const value = {
    user,
    session,
    loading,
    permissions,
    signIn,
    signOut,
    validateSession,
    refreshToken,
    isAdmin: () => isAdmin(user),
    isSuperAdmin: () => isSuperAdmin(user),
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};