#!/usr/bin/env node

/**
 * Verification script for cron job configuration
 * Run this before deployment to ensure everything is configured correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Cron Job Configuration...\n');

// Check vercel.json
const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
try {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

  if (!vercelConfig.crons) {
    console.error('❌ No crons configuration found in vercel.json');
    process.exit(1);
  }

  const cronConfig = vercelConfig.crons.find(c =>
    c.path === '/api/admin/cron/activate-scheduled-exams'
  );

  if (!cronConfig) {
    console.error('❌ Cron job for activate-scheduled-exams not found in vercel.json');
    process.exit(1);
  }

  if (cronConfig.schedule !== '0 0 * * *') {
    console.warn(`⚠️  Cron schedule is "${cronConfig.schedule}" (expected "0 0 * * *" for daily at midnight UTC)`);
  } else {
    console.log('✅ Cron schedule configured correctly: Daily at 12:00 AM UTC');
  }

} catch (error) {
  console.error('❌ Error reading vercel.json:', error.message);
  process.exit(1);
}

// Check cron endpoint exists
const cronEndpointPath = path.join(__dirname, '..', 'api', 'admin', 'cron', 'activate-scheduled-exams.js');
if (!fs.existsSync(cronEndpointPath)) {
  console.error('❌ Cron endpoint file not found at:', cronEndpointPath);
  process.exit(1);
} else {
  console.log('✅ Cron endpoint file exists');
}

// Check for CRON_SECRET in environment
if (process.env.CRON_SECRET) {
  if (process.env.CRON_SECRET.length < 32) {
    console.warn('⚠️  CRON_SECRET is set but appears too short (should be at least 32 characters)');
  } else {
    console.log('✅ CRON_SECRET is set in environment');
  }
} else {
  console.warn('⚠️  CRON_SECRET not found in environment (required for production)');
}

// Check shared activation logic exists
const sharedLogicPath = path.join(__dirname, '..', 'api', '_shared', 'scheduledActivation.js');
if (!fs.existsSync(sharedLogicPath)) {
  console.error('❌ Shared activation logic not found at:', sharedLogicPath);
  process.exit(1);
} else {
  console.log('✅ Shared activation logic exists');
}

// Summary
console.log('\n📋 Configuration Summary:');
console.log('- Schedule: Daily at 12:00 AM UTC (0 0 * * *)');
console.log('- Endpoint: /api/admin/cron/activate-scheduled-exams');
console.log('- Authentication: CRON_SECRET required');
console.log('- Environment: Production only (cron jobs don\'t run in preview)');

console.log('\n🚀 Next Steps:');
console.log('1. Set CRON_SECRET in Vercel Dashboard (Production environment)');
console.log('2. Deploy to production: vercel --prod');
console.log('3. Monitor execution in Vercel Functions logs');
console.log('4. Test manually if needed using the curl command in documentation');

console.log('\n✨ Configuration verification complete!');