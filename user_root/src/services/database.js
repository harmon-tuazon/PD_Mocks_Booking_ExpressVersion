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

/**
 * Reshape flat SQL JOIN rows into nested objects matching Supabase SDK format.
 * Uses double-underscore prefix convention: s__slot_date → { slot: { slot_date } }
 *
 * @param {Object} row - Flat row with prefix__column naming
 * @param {Object} nestMap - { prefix: nestKey } e.g. { s: 'slot', i: 'instructor', c: 'student' }
 * @param {Object} [subNest] - { prefix: parentPrefix } nests prefix inside parent
 *   e.g. { i: 's' } means instructor nests inside slot → slot.instructor
 * @returns {Object} Row with nested objects
 */
function nestRow(row, nestMap, subNest) {
  if (!row) return row;
  const result = {};
  const nested = {};

  for (const prefix in nestMap) {
    nested[prefix] = {};
  }

  for (const key in row) {
    const sepIdx = key.indexOf('__');
    if (sepIdx > 0) {
      const prefix = key.substring(0, sepIdx);
      const col = key.substring(sepIdx + 2);
      if (nested[prefix] !== undefined) {
        nested[prefix][col] = row[key];
        continue;
      }
    }
    result[key] = row[key];
  }

  for (const prefix in nestMap) {
    const obj = nested[prefix];
    const hasData = Object.values(obj).some(v => v != null);
    const nestKey = nestMap[prefix];

    if (subNest && subNest[prefix]) {
      const parentKey = nestMap[subNest[prefix]];
      if (!result[parentKey]) result[parentKey] = {};
      result[parentKey][nestKey] = hasData ? obj : null;
    } else {
      result[nestKey] = hasData ? obj : null;
    }
  }

  return result;
}

module.exports = { pool, query, nestRow };
