#!/usr/bin/env node

/**
 * Test script to verify requireAdmin middleware is correctly imported
 * This tests the fix for "requireAdmin is not a function" errors
 */

const path = require('path');

console.log('🧪 Testing requireAdmin imports...\n');

try {
  // Test aggregates.js
  console.log('1️⃣ Testing aggregates.js import...');
  const aggregatesPath = path.join(__dirname, '../api/admin/mock-exams/aggregates.js');
  const aggregates = require(aggregatesPath);

  if (typeof aggregates === 'function') {
    console.log('✅ aggregates.js exports a function correctly');
  } else {
    console.error('❌ aggregates.js does not export a function');
    process.exit(1);
  }

  // Test sessions.js
  console.log('\n2️⃣ Testing sessions.js import...');
  const sessionsPath = path.join(__dirname, '../api/admin/mock-exams/aggregates/[key]/sessions.js');
  const sessions = require(sessionsPath);

  if (typeof sessions === 'function') {
    console.log('✅ sessions.js exports a function correctly');
  } else {
    console.error('❌ sessions.js does not export a function');
    process.exit(1);
  }

  // Test requireAdmin middleware
  console.log('\n3️⃣ Testing requireAdmin middleware...');
  const { requireAdmin } = require('../api/admin/middleware/requireAdmin');

  if (typeof requireAdmin === 'function') {
    console.log('✅ requireAdmin is correctly exported as a function');
  } else {
    console.error('❌ requireAdmin is not a function');
    process.exit(1);
  }

  console.log('\n✨ All tests passed! The requireAdmin middleware fix is working correctly.');

} catch (error) {
  console.error('\n❌ Test failed with error:', error.message);
  process.exit(1);
}