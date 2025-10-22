/**
 * Supabase Client Configuration
 * Provides authenticated Supabase client for server-side operations
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Initialize Supabase client with anon key for public operations
const supabasePublic = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

/**
 * Verify and decode a Supabase JWT token
 * @param {string} token - JWT token from client
 * @returns {Promise<{user: object, error: object|null}>}
 */
async function verifyToken(token) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      return { user: null, error };
    }

    return { user, error: null };
  } catch (error) {
    console.error('Token verification error:', error);
    return { user: null, error };
  }
}

/**
 * Check if user has admin role
 * @param {object} user - Supabase user object
 * @returns {boolean}
 */
function isAdmin(user) {
  const role = user?.user_metadata?.role;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Check if user has super admin role
 * @param {object} user - Supabase user object
 * @returns {boolean}
 */
function isSuperAdmin(user) {
  const role = user?.user_metadata?.role;
  return role === 'super_admin';
}

/**
 * Get user permissions based on role
 * @param {object} user - Supabase user object
 * @returns {string[]}
 */
function getUserPermissions(user) {
  const role = user?.user_metadata?.role;

  const ROLE_PERMISSIONS = {
    super_admin: ['*'], // All permissions
    admin: [
      'create_mock_exams',
      'edit_mock_exams',
      'delete_mock_exams',
      'view_bookings',
      'manage_users',
      'view_reports'
    ],
    staff: [
      'view_mock_exams',
      'view_bookings',
      'view_reports'
    ]
  };

  return ROLE_PERMISSIONS[role] || [];
}

module.exports = {
  supabaseAdmin,
  supabasePublic,
  verifyToken,
  isAdmin,
  isSuperAdmin,
  getUserPermissions
};