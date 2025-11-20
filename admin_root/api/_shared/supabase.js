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
 * Decode JWT payload without verification (verification done by getUser)
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded payload or null
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

/**
 * Verify and decode a Supabase JWT token
 * Returns user object with RBAC claims (user_role, permissions)
 * @param {string} token - JWT token from client
 * @returns {Promise<{user: object, error: object|null}>}
 */
async function verifyToken(token) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      return { user: null, error };
    }

    // Decode JWT to get custom claims (user_role, permissions)
    const jwtPayload = decodeJwtPayload(token);

    // Merge user object with RBAC claims from JWT
    const userWithClaims = {
      ...user,
      user_role: jwtPayload?.user_role || 'viewer',
      permissions: jwtPayload?.permissions || [],
      role_assigned_at: jwtPayload?.role_assigned_at || null
    };

    return { user: userWithClaims, error: null };
  } catch (error) {
    console.error('Token verification error:', error);
    return { user: null, error };
  }
}

module.exports = {
  supabaseAdmin,
  supabasePublic,
  verifyToken
};