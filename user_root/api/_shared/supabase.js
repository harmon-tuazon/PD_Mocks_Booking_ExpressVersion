/**
 * Supabase Client Configuration for User Root
 * Provides authenticated Supabase client for server-side operations
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase environment variables not configured. Some features may be unavailable.');
}

// Service role client for server-side operations (bypasses RLS)
const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: process.env.SUPABASE_SCHEMA_NAME } 
  }
);

module.exports = { supabaseAdmin };
