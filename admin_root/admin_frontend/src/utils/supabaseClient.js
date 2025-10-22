/**
 * Supabase Client Configuration for Frontend
 * Handles authentication and session management
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables from Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please check your environment variables.');
}

// Create Supabase client with persistence and auto-refresh
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => {
        // Use localStorage for persistence
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      },
      setItem: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
      },
      removeItem: (key) => {
        localStorage.removeItem(key);
      }
    }
  }
});

// Export auth helper functions
export const auth = {
  /**
   * Sign in with email and password
   */
  signIn: async (email, password, rememberMe = false) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (data?.session && rememberMe) {
      // Store refresh token in cookie for Remember Me
      document.cookie = `admin_refresh_token=${data.session.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`;
    }

    return { data, error };
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    // Clear any stored cookies
    document.cookie = 'admin_refresh_token=; Path=/; Max-Age=0';
    return { error };
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  /**
   * Refresh session with token
   */
  refreshSession: async (refreshToken) => {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });
    return { data, error };
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};