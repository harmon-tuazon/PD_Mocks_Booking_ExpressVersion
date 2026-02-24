/**
 * Environment Configuration
 * Validates required environment variables on startup
 */

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'HS_PRIVATE_APP_TOKEN'
];

const OPTIONAL_VARS = [
  'PORT',
  'NODE_ENV',
  'REDIS_URL',
  'CRON_SECRET',
  'SUPABASE_SCHEMA_NAME'
];

function validateEnvironment() {
  const missing = REQUIRED_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`[ENV] Environment validated (${REQUIRED_VARS.length} required, ${OPTIONAL_VARS.length} optional)`);
}

module.exports = {
  validateEnvironment,
  REQUIRED_VARS,
  OPTIONAL_VARS
};
