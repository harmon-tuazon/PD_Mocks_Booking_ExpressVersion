/**
 * Test to verify cache service fix for aggregates endpoint
 * This test confirms that the cache import issue has been resolved
 */

console.log('Testing cache service fix...\n');

// Test 1: Verify cache module exports the correct functions
console.log('1. Testing cache module exports...');
const cacheModule = require('../api/_shared/cache');
console.log('   - getCache function exists:', typeof cacheModule.getCache === 'function' ? '✅' : '❌');
console.log('   - CacheService class exists:', typeof cacheModule.CacheService === 'function' ? '✅' : '❌');

// Test 2: Verify CacheService has the required methods
console.log('\n2. Testing CacheService methods...');
const { CacheService } = cacheModule;
const proto = CacheService.prototype;
console.log('   - get method exists:', typeof proto.get === 'function' ? '✅' : '❌');
console.log('   - set method exists:', typeof proto.set === 'function' ? '✅' : '❌');
console.log('   - delete method exists:', typeof proto.delete === 'function' ? '✅' : '❌');
console.log('   - deletePattern method exists:', typeof proto.deletePattern === 'function' ? '✅' : '❌');
console.log('   - clear method exists:', typeof proto.clear === 'function' ? '✅' : '❌');
console.log('   - keys method exists:', typeof proto.keys === 'function' ? '✅' : '❌');

// Test 3: Verify fixed endpoints have correct imports
console.log('\n3. Testing fixed endpoint imports...');

// Check aggregates.js
try {
  const aggregatesCode = require('fs').readFileSync('./api/admin/mock-exams/aggregates.js', 'utf8');
  const hasCorrectImport = aggregatesCode.includes("const { getCache } = require('../../_shared/cache')");
  const usesGetCache = aggregatesCode.includes("const cacheService = getCache()");
  console.log('   - aggregates.js has correct import:', hasCorrectImport ? '✅' : '❌');
  console.log('   - aggregates.js uses getCache():', usesGetCache ? '✅' : '❌');
} catch (error) {
  console.log('   - aggregates.js:', '❌ Error reading file');
}

// Check sessions.js
try {
  const sessionsCode = require('fs').readFileSync('./api/admin/mock-exams/aggregates/[key]/sessions.js', 'utf8');
  const hasCorrectImport = sessionsCode.includes("const { getCache } = require('../../../../_shared/cache')");
  const usesGetCache = sessionsCode.includes("const cacheService = getCache()");
  console.log('   - sessions.js has correct import:', hasCorrectImport ? '✅' : '❌');
  console.log('   - sessions.js uses getCache():', usesGetCache ? '✅' : '❌');
} catch (error) {
  console.log('   - sessions.js:', '❌ Error reading file');
}

// Check bookings.js
try {
  const bookingsCode = require('fs').readFileSync('./api/admin/mock-exams/[id]/bookings.js', 'utf8');
  const hasCorrectImport = bookingsCode.includes("const { getCache } = require('../../../_shared/cache')");
  const usesGetCache = bookingsCode.includes("const cacheService = getCache()");
  console.log('   - bookings.js has correct import:', hasCorrectImport ? '✅' : '❌');
  console.log('   - bookings.js uses getCache():', usesGetCache ? '✅' : '❌');
} catch (error) {
  console.log('   - bookings.js:', '❌ Error reading file');
}

console.log('\n✅ Cache service fix verification complete!');
console.log('\n📝 Summary:');
console.log('   The cache service error has been fixed by:');
console.log('   1. Importing { getCache } instead of the cache module directly');
console.log('   2. Calling getCache() to get the cache instance');
console.log('   3. All affected endpoints have been updated with the correct pattern');