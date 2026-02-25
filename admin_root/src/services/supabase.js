/**
 * Supabase Client Configuration (Admin Root)
 *
 * Architecture after AWS RDS migration:
 * - supabaseAdmin.auth.*  → Real Supabase (JWT verification, user management)
 * - supabaseAdmin.from()  → pg (direct PostgreSQL on AWS RDS)
 * - supabaseAdmin.rpc()   → pg (stored function calls on AWS RDS)
 *
 * All data tables (groups, instructors, work_check_*, hubspot_*, etc.)
 * now live in AWS RDS under the hubspot_sync schema.
 */

const { createClient } = require('@supabase/supabase-js');
const { createPgClient, getPool } = require('./pg-query-builder');

// Real Supabase client — ONLY for auth operations
const _supabaseAuth = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// pg-backed client — for all data operations
const _pgClient = createPgClient(getPool());

/**
 * Hybrid supabaseAdmin:
 *   .auth              → Real Supabase (auth.getUser, auth.admin.createUser, etc.)
 *   .from(table)       → pg query builder (direct AWS RDS queries)
 *   .rpc(fn, params)   → pg stored function call
 */
const supabaseAdmin = {
  auth: _supabaseAuth.auth,
  from(table) { return _pgClient.from(table); },
  rpc(fnName, params) { return _pgClient.rpc(fnName, params); }
};

// Public client — for operations that need anon/public key context
// Auth uses real Supabase; data queries use pg
const supabasePublic = {
  auth: _supabaseAuth.auth,
  from(table) { return _pgClient.from(table); },
  rpc(fnName, params) { return _pgClient.rpc(fnName, params); }
};

/**
 * Decode JWT payload without verification
 * (verification is done by Supabase auth.getUser)
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

/**
 * Verify and decode a Supabase JWT token.
 * Returns user object with RBAC claims (user_role, permissions).
 */
async function verifyToken(token) {
  try {
    const { data: { user }, error } = await _supabaseAuth.auth.getUser(token);
    if (error) return { user: null, error };

    const jwtPayload = decodeJwtPayload(token);
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

module.exports = { supabaseAdmin, supabasePublic, verifyToken };
