/**
 * Supabase Client Configuration (User Root)
 *
 * Architecture after AWS RDS migration:
 * - supabaseAdmin.auth.*  → Real Supabase (JWT verification)
 * - supabaseAdmin.from()  → pg (direct PostgreSQL on AWS RDS)
 * - supabaseAdmin.rpc()   → pg (stored function calls on AWS RDS)
 */

const { createClient } = require('@supabase/supabase-js');
const { createPgClient, getPool } = require('./pg-query-builder');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase environment variables not configured. Auth features may be unavailable.');
}

// Real Supabase client — ONLY for auth operations
const _supabaseAuth = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
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
 *   .auth              → Real Supabase (JWT verification via auth.getUser)
 *   .from(table)       → pg query builder (direct AWS RDS queries)
 *   .rpc(fn, params)   → pg stored function call
 */
const supabaseAdmin = {
  auth: _supabaseAuth.auth,
  from(table) { return _pgClient.from(table); },
  rpc(fnName, params) { return _pgClient.rpc(fnName, params); }
};

module.exports = { supabaseAdmin };
