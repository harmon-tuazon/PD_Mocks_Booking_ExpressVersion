/**
 * PostgreSQL Database Pool
 * Direct connection to AWS RDS, replacing Supabase for data queries.
 * Supabase is still used for authentication (JWT verification).
 */

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL not configured. Database queries will fail.');
}

const schema = process.env.DATABASE_SCHEMA || 'hubspot_sync';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for AWS RDS
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('connect', function(client) {
  client.query('SET search_path TO "' + schema + '", public');
});

pool.on('error', function(err) {
  console.error('PostgreSQL pool error:', err.message);
});

const query = function(text, params) { return pool.query(text, params); };

module.exports = { pool, query };
