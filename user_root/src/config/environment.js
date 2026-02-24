/**
 * Environment variable validation
 * Validates all required environment variables are present on startup
 */

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'HS_PRIVATE_APP_TOKEN',
  'REDIS_URL'
];

const OPTIONAL_VARS = [
  'JWT_SECRET',
  'PORT',
  'NODE_ENV'
];

/**
 * Validate that all required environment variables are set
 * @throws {Error} If any required variable is missing
 */
function validateEnvironment() {
  const missing = REQUIRED_VARS.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file or environment configuration.`
    );
  }

  // Log optional vars status (non-sensitive)
  const optionalStatus = OPTIONAL_VARS.map(varName => ({
    name: varName,
    set: !!process.env[varName]
  }));

  console.log('Environment validation passed:', {
    required: `${REQUIRED_VARS.length}/${REQUIRED_VARS.length} set`,
    optional: optionalStatus
  });
}

module.exports = { validateEnvironment, REQUIRED_VARS, OPTIONAL_VARS };
