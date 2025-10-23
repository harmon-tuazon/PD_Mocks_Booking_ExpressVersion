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
  const [configError, setConfigError] = useState(null);

  // Set axios auth header when session changes
  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [session]);

  // No role-based checks - any authenticated user has access
  const isAuthenticated = () => {
    return !!user;
  };

  // Fetch additional user details from backend (optional)
  const fetchUserDetails = async (accessToken) => {
    try {
      const response = await axios.get('/admin/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

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
        // Check if Supabase is properly configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          setConfigError('Supabase configuration is missing. Please contact the administrator.');
          setLoading(false);
          return;
        }

        // Get initial session
        const { session: currentSession, error } = await authHelpers.getSession();

        if (currentSession) {
          const { user: currentUser } = currentSession;

          setSession(currentSession);
          setUser(currentUser);

          // Fetch additional user details (optional)
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

        setSession(newSession);
        setUser(newUser);

        // Store tokens in localStorage
        localStorage.setItem('access_token', newSession.access_token);
        if (newSession.refresh_token) {
          localStorage.setItem('refresh_token', newSession.refresh_token);
        }

        // Fetch additional user details (optional)
        const userDetails = await fetchUserDetails(newSession.access_token);
        if (userDetails) {
          setUser({ ...newUser, ...userDetails });
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);

        // Clear tokens from localStorage
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);

        // Update token in localStorage
        localStorage.setItem('access_token', newSession.access_token);
        if (newSession.refresh_token) {
          localStorage.setItem('refresh_token', newSession.refresh_token);
        }
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

      if (response.data?.session && response.data?.user) {
        const { session: newSession, user: newUser } = response.data;

        // Set Supabase session
        await supabase.auth.setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token
        });

        // CRITICAL: Immediately update local state to trigger redirect
        // Don't wait for auth state change listener
        setSession(newSession);
        setUser(newUser);

        // Store tokens in localStorage for API requests
        localStorage.setItem('access_token', newSession.access_token);
        if (newSession.refresh_token) {
          localStorage.setItem('refresh_token', newSession.refresh_token);
        }

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

      // Clear tokens from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);

      // Even if backend fails, clear local state
      await authHelpers.signOut();
      setUser(null);
      setSession(null);

      // Clear tokens from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

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
    configError,
    signIn,
    signOut,
    validateSession,
    refreshToken,
    isAuthenticated
  };

  // Show configuration error if Supabase is not configured
  if (configError) {
    return (
      <AuthContext.Provider value={value}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-red-50 border border-red-400 rounded-lg p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Configuration Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{configError}</p>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-red-600">
                      <p className="font-semibold">Technical Details:</p>
                      <p className="mt-1">Missing Supabase environment variables:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>VITE_SUPABASE_URL</li>
                        <li>VITE_SUPABASE_ANON_KEY</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};