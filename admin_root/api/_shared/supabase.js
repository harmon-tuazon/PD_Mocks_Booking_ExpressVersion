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

module.exports = {
  supabaseAdmin,
  supabasePublic,
  verifyToken
};