/**
 * Environment & Service Connection Verifier
 *
 * Validates that all environment variables are correctly set and that
 * external services (Supabase, HubSpot, Redis) are reachable.
 *
 * Usage:
 *   node migration/scripts/verify-env-connections.js --app admin
 *   node migration/scripts/verify-env-connections.js --app user
 *
 * Loads .env from the appropriate root (admin_root/ or user_root/).
 */

const path = require('path');
const axios = require('axios');

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const appFlagIdx = args.indexOf('--app');
const app = appFlagIdx !== -1 ? args[appFlagIdx + 1] : null;

if (!app || !['admin', 'user'].includes(app)) {
  console.error('Usage: node migration/scripts/verify-env-connections.js --app <admin|user>');
  process.exit(1);
}

const rootDir = app === 'admin' ? 'admin_root' : 'user_root';
const envPath = path.resolve(__dirname, '..', '..', rootDir, '.env');

// Load environment variables from the selected app
require('dotenv').config({ path: envPath });

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
const results = [];
let hasBlocker = false;

function pass(label, detail) {
  results.push({ status: 'PASS', label, detail });
  console.log(`  ✅ ${label}: ${detail}`);
}

function warn(label, detail) {
  results.push({ status: 'WARN', label, detail });
  console.log(`  ⚠️  ${label}: ${detail}`);
}

function fail(label, detail) {
  results.push({ status: 'FAIL', label, detail });
  hasBlocker = true;
  console.log(`  ❌ ${label}: ${detail}`);
}

// ---------------------------------------------------------------------------
// 1. Validate required environment variables exist
// ---------------------------------------------------------------------------
function checkEnvVars() {
  console.log('\n━━━ 1. Environment Variables ━━━');

  const required = [
    'HS_PRIVATE_APP_TOKEN',
    'HUBSPOT_PORTAL_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SCHEMA_NAME',
    'PD_Bookings_Cache_REDIS_URL',
    'CRON_SECRET',
  ];

  if (app === 'admin') {
    required.push('SUPABASE_ANON_KEY');
  }

  for (const key of required) {
    const val = process.env[key];
    if (!val) {
      fail(key, 'MISSING – not set in .env');
    } else {
      pass(key, `set (${val.length} chars)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Validate the Supabase service-role JWT
// ---------------------------------------------------------------------------
function checkSupabaseJwt() {
  console.log('\n━━━ 2. Supabase Service Role Key (JWT Validation) ━━━');

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    fail('JWT Decode', 'SUPABASE_SERVICE_ROLE_KEY is empty – cannot decode');
    return;
  }

  // Decode the JWT payload (no verification – just structure check)
  const parts = key.split('.');
  if (parts.length !== 3) {
    fail('JWT Structure', `Expected 3 parts (header.payload.signature), got ${parts.length}`);
    return;
  }
  pass('JWT Structure', '3-part JWT detected');

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

    // Check role claim
    if (payload.role === 'service_role') {
      pass('JWT Role', `role = "service_role" (correct)`);
    } else if (payload.role === 'anon') {
      fail('JWT Role',
        `role = "anon" — THIS IS THE ANON KEY, NOT THE SERVICE ROLE KEY!\n` +
        `         You pasted the anon key into SUPABASE_SERVICE_ROLE_KEY.\n` +
        `         Go to Supabase Dashboard → Settings → API → copy the "service_role" key.`
      );
    } else {
      warn('JWT Role', `Unexpected role = "${payload.role}"`);
    }

    // Check the Supabase project ref matches the URL
    const urlRef = (process.env.SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (urlRef && payload.ref) {
      if (urlRef === payload.ref) {
        pass('JWT Project Ref', `"${payload.ref}" matches SUPABASE_URL`);
      } else {
        fail('JWT Project Ref', `JWT ref "${payload.ref}" does NOT match URL ref "${urlRef}"`);
      }
    }

    // Check expiration
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      if (expDate > now) {
        pass('JWT Expiration', `Expires ${expDate.toISOString()} (valid)`);
      } else {
        fail('JWT Expiration', `EXPIRED on ${expDate.toISOString()}`);
      }
    }

    // Also check if anon key is duplicated as service role key
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (anonKey && anonKey === key) {
      fail('Duplicate Key',
        'SUPABASE_SERVICE_ROLE_KEY is IDENTICAL to SUPABASE_ANON_KEY – they must be different keys'
      );
    }

  } catch (e) {
    fail('JWT Decode', `Failed to parse payload: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Test Supabase connectivity (actual API call)
// ---------------------------------------------------------------------------
async function checkSupabaseConnection() {
  console.log('\n━━━ 3. Supabase Connection Test ━━━');

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_SCHEMA_NAME || 'hubspot_sync';

  if (!url || !serviceKey) {
    fail('Supabase API', 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  // Test 1: Health check via REST API (select from a known table)
  try {
    const start = Date.now();
    const response = await axios.get(
      `${url}/rest/v1/hubspot_mock_exams?select=id&limit=1`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Accept': 'application/json',
          'Accept-Profile': schema,
        },
        timeout: 10000,
      }
    );
    const latency = Date.now() - start;

    if (response.status === 200) {
      const rowCount = Array.isArray(response.data) ? response.data.length : '?';
      pass('Supabase REST API', `200 OK — ${rowCount} row(s) returned in ${latency}ms (schema: ${schema})`);
    } else {
      warn('Supabase REST API', `Unexpected status ${response.status}`);
    }
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.response?.data?.hint || error.message;

    if (status === 401 || status === 403) {
      fail('Supabase REST API',
        `${status} ${msg}\n` +
        `         This likely means the service role key is invalid or is actually the anon key.`
      );
    } else if (status === 404) {
      warn('Supabase REST API', `404 — table "hubspot_mock_exams" may not exist in schema "${schema}", but auth succeeded`);
    } else {
      fail('Supabase REST API', `${status || 'Network Error'}: ${msg}`);
    }
  }

  // Test 2: Verify auth endpoint works (uses anon key if available)
  if (process.env.SUPABASE_ANON_KEY) {
    try {
      const response = await axios.get(
        `${url}/auth/v1/settings`,
        {
          headers: {
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          timeout: 10000,
        }
      );
      if (response.status === 200) {
        pass('Supabase Auth', 'Auth settings endpoint reachable');
      }
    } catch (error) {
      warn('Supabase Auth', `Could not reach auth endpoint: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Test HubSpot connectivity
// ---------------------------------------------------------------------------
async function checkHubSpotConnection() {
  console.log('\n━━━ 4. HubSpot Connection Test ━━━');

  const token = process.env.HS_PRIVATE_APP_TOKEN;
  if (!token) {
    fail('HubSpot API', 'HS_PRIVATE_APP_TOKEN is not set');
    return;
  }

  try {
    const start = Date.now();
    // Use the account info endpoint as a lightweight connectivity check
    const response = await axios.get(
      'https://api.hubapi.com/integrations/v1/me',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      }
    );
    const latency = Date.now() - start;

    if (response.status === 200) {
      const portalId = response.data.portalId;
      const expectedPortalId = process.env.HUBSPOT_PORTAL_ID;

      pass('HubSpot Auth', `Authenticated in ${latency}ms — Portal ID: ${portalId}`);

      if (expectedPortalId && String(portalId) !== String(expectedPortalId)) {
        warn('Portal ID Mismatch',
          `Token authenticates to portal ${portalId}, but HUBSPOT_PORTAL_ID=${expectedPortalId}`
        );
      } else if (expectedPortalId) {
        pass('Portal ID', `Matches HUBSPOT_PORTAL_ID (${expectedPortalId})`);
      }

      // Check scopes
      const scopes = response.data.scopes || [];
      const requiredScopes = ['crm.objects.custom.read', 'crm.objects.custom.write', 'crm.objects.contacts.read'];
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s));

      if (missingScopes.length > 0) {
        warn('HubSpot Scopes', `Missing scopes: ${missingScopes.join(', ')}`);
      } else {
        pass('HubSpot Scopes', `All required scopes present (${scopes.length} total)`);
      }
    }
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message;

    if (status === 401) {
      fail('HubSpot Auth', `401 Unauthorized — Token is invalid or expired`);
    } else {
      fail('HubSpot Auth', `${status || 'Network Error'}: ${msg}`);
    }
  }

  // Test: Can we read mock exams? (verifies custom object access)
  try {
    const response = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/2-50158913/search',
      {
        properties: ['mock_type'],
        limit: 1,
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.status === 200) {
      const total = response.data.total || 0;
      pass('HubSpot Mock Exams', `Readable — ${total} total mock exams found`);
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      fail('HubSpot Mock Exams', `${status} — Cannot access mock exams custom object`);
    } else {
      warn('HubSpot Mock Exams', `Could not query mock exams: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Test Redis connectivity
// ---------------------------------------------------------------------------
async function checkRedisConnection() {
  console.log('\n━━━ 5. Redis Connection Test ━━━');

  const redisUrl = process.env.PD_Bookings_Cache_REDIS_URL;
  if (!redisUrl) {
    fail('Redis URL', 'PD_Bookings_Cache_REDIS_URL is not set');
    return;
  }

  // Mask password in URL for display
  const maskedUrl = redisUrl.replace(/:([^@]+)@/, ':****@');
  pass('Redis URL', `Configured: ${maskedUrl}`);

  let Redis;
  try {
    Redis = require('ioredis');
  } catch (e) {
    // Try loading from admin_root or user_root node_modules
    const altPath = path.resolve(__dirname, '..', '..', rootDir, 'node_modules', 'ioredis');
    try {
      Redis = require(altPath);
    } catch (e2) {
      fail('Redis Module', 'ioredis not found. Run `npm install` in the project root or the app root first.');
      return;
    }
  }

  const redis = new Redis(redisUrl, {
    retryStrategy: () => null, // Don't retry on failure
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
  });

  try {
    await redis.connect();

    const start = Date.now();
    const pong = await redis.ping();
    const latency = Date.now() - start;

    if (pong === 'PONG') {
      pass('Redis PING', `PONG received in ${latency}ms`);
    } else {
      warn('Redis PING', `Unexpected response: "${pong}"`);
    }

    // Get basic server info
    const info = await redis.info('server');
    const version = info.match(/redis_version:(.*)/)?.[1]?.trim() || 'unknown';
    pass('Redis Version', version);

    // Get memory info
    const memInfo = await redis.info('memory');
    const usedMem = memInfo.match(/used_memory_human:(.*)/)?.[1]?.trim() || 'unknown';
    pass('Redis Memory', `Used: ${usedMem}`);

    // Test write/read/delete cycle
    const testKey = '__migration_verify_test__';
    await redis.set(testKey, 'ok', 'EX', 5);
    const readBack = await redis.get(testKey);
    await redis.del(testKey);

    if (readBack === 'ok') {
      pass('Redis Write/Read', 'Write → Read → Delete cycle succeeded');
    } else {
      warn('Redis Write/Read', `Read back "${readBack}" instead of "ok"`);
    }

  } catch (error) {
    fail('Redis Connection', `${error.message}`);
  } finally {
    try { await redis.quit(); } catch (_) { redis.disconnect(); }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   Environment & Service Verification — ${app.toUpperCase()} APP              ║`);
  console.log(`║   .env loaded from: ${rootDir}/.env                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  // Phase 1: Static checks
  checkEnvVars();
  checkSupabaseJwt();

  // Phase 2: Live connection tests
  await checkSupabaseConnection();
  await checkHubSpotConnection();
  await checkRedisConnection();

  // Summary
  console.log('\n━━━ SUMMARY ━━━');
  const passes = results.filter(r => r.status === 'PASS').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  const fails = results.filter(r => r.status === 'FAIL').length;

  console.log(`  ✅ Passed:  ${passes}`);
  console.log(`  ⚠️  Warnings: ${warns}`);
  console.log(`  ❌ Failed:  ${fails}`);

  if (hasBlocker) {
    console.log('\n🚫 BLOCKERS DETECTED — fix the ❌ issues above before proceeding.\n');
    process.exit(1);
  } else if (warns > 0) {
    console.log('\n⚠️  All critical checks passed, but review warnings above.\n');
    process.exit(0);
  } else {
    console.log('\n🎉 All checks passed! Environment is ready.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n💥 Unexpected error running verification:', err);
  process.exit(2);
});
