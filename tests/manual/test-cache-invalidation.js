require('dotenv').config();
const { getCache } = require('../../api/_shared/cache');

/**
 * Test script to verify cache invalidation functionality
 * 
 * This tests the fixes for the booking refresh issue:
 * 1. CacheService.keys() method exists and works
 * 2. CacheService.delete() method works correctly
 * 3. Cache invalidation patterns match correctly
 */

console.log('================================================================================');
console.log('\x1b[1m\x1b[36mCACHE INVALIDATION TEST\x1b[0m');
console.log('================================================================================\n');

try {
  const cache = getCache();

  // Test 1: Verify keys() method exists
  console.log('\x1b[1m\x1b[36mTest 1: CacheService.keys() method\x1b[0m');
  console.log('Testing that keys() method exists and returns an array...');
  
  const keys = cache.keys();
  
  if (typeof cache.keys !== 'function') {
    console.error('\x1b[31m❌ FAIL: keys() method does not exist\x1b[0m');
    process.exit(1);
  }
  
  if (!Array.isArray(keys)) {
    console.error('\x1b[31m❌ FAIL: keys() does not return an array\x1b[0m');
    process.exit(1);
  }
  
  console.log(`\x1b[32m✅ PASS: keys() method exists and returns array with ${keys.length} entries\x1b[0m\n`);

  // Test 2: Verify delete() method exists
  console.log('\x1b[1m\x1b[36mTest 2: CacheService.delete() method\x1b[0m');
  console.log('Testing that delete() method exists...');
  
  if (typeof cache.delete !== 'function') {
    console.error('\x1b[31m❌ FAIL: delete() method does not exist\x1b[0m');
    process.exit(1);
  }
  
  console.log('\x1b[32m✅ PASS: delete() method exists\x1b[0m\n');

  // Test 3: Test cache set, get, and delete operations
  console.log('\x1b[1m\x1b[36mTest 3: Cache set, get, and delete operations\x1b[0m');
  
  const testKey = 'test:cache:invalidation:123';
  const testValue = { message: 'test data' };
  
  console.log(`Setting test cache entry: ${testKey}`);
  cache.set(testKey, testValue, 60000); // 1 minute TTL
  
  const retrieved = cache.get(testKey);
  if (!retrieved || retrieved.message !== 'test data') {
    console.error('\x1b[31m❌ FAIL: Cache set/get failed\x1b[0m');
    process.exit(1);
  }
  console.log('\x1b[32m✅ PASS: Cache set/get works correctly\x1b[0m');
  
  console.log(`Deleting test cache entry: ${testKey}`);
  cache.delete(testKey);
  
  const afterDelete = cache.get(testKey);
  if (afterDelete !== null) {
    console.error('\x1b[31m❌ FAIL: Cache delete failed - entry still exists\x1b[0m');
    process.exit(1);
  }
  console.log('\x1b[32m✅ PASS: Cache delete works correctly\x1b[0m\n');

  // Test 4: Test pattern-based cache invalidation
  console.log('\x1b[1m\x1b[36mTest 4: Pattern-based cache invalidation\x1b[0m');
  
  // Create multiple cache entries with booking pattern
  const contactId = '123456789';
  const testKeys = [
    `bookings:contact:${contactId}:all:page1:limit10`,
    `bookings:contact:${contactId}:upcoming:page1:limit10`,
    `bookings:contact:${contactId}:upcoming:page2:limit10`,
    `bookings:contact:${contactId}:past:page1:limit10`,
    `bookings:contact:${contactId}:cancelled:page1:limit10`,
  ];
  
  console.log(`Creating ${testKeys.length} test cache entries...`);
  testKeys.forEach(key => {
    cache.set(key, { bookings: [] }, 60000);
  });
  
  // Verify they exist
  const keysBeforeDelete = cache.keys();
  const matchingBefore = keysBeforeDelete.filter(k => k.includes(contactId));
  console.log(`Found ${matchingBefore.length} cache entries for contact ${contactId}`);
  
  // Simulate the invalidation logic from create.js
  const cacheKeyPatterns = [
    `bookings:contact:${contactId}:all:`,
    `bookings:contact:${contactId}:upcoming:`,
    `bookings:contact:${contactId}:past:`,
    `bookings:contact:${contactId}:cancelled:`
  ];
  
  console.log('\nInvalidating cache entries using patterns...');
  const allKeys = cache.keys();
  let invalidatedCount = 0;
  
  for (const key of allKeys) {
    for (const pattern of cacheKeyPatterns) {
      if (key.startsWith(pattern)) {
        cache.delete(key);
        invalidatedCount++;
        console.log(`  🗑️ Deleted: ${key}`);
      }
    }
  }
  
  console.log(`\nDeleted ${invalidatedCount} cache entries`);
  
  // Verify they're deleted
  const keysAfterDelete = cache.keys();
  const matchingAfter = keysAfterDelete.filter(k => k.includes(contactId));
  
  if (matchingAfter.length > 0) {
    console.error(`\x1b[31m❌ FAIL: ${matchingAfter.length} cache entries still exist after deletion\x1b[0m`);
    console.error('Remaining keys:', matchingAfter);
    process.exit(1);
  }
  
  console.log(`\x1b[32m✅ PASS: All ${invalidatedCount} cache entries successfully deleted\x1b[0m\n`);

  // Test 5: Verify no false positives
  console.log('\x1b[1m\x1b[36mTest 5: Pattern matching specificity\x1b[0m');
  
  const otherContactId = '987654321';
  const otherKey = `bookings:contact:${otherContactId}:upcoming:page1:limit10`;
  
  console.log(`Creating cache entry for different contact: ${otherContactId}`);
  cache.set(otherKey, { bookings: [] }, 60000);
  
  // Try to delete with first contact's patterns
  console.log(`Attempting to delete using patterns for contact ${contactId}...`);
  const allKeysAgain = cache.keys();
  let falsePositiveCount = 0;
  
  for (const key of allKeysAgain) {
    for (const pattern of cacheKeyPatterns) {
      if (key.startsWith(pattern)) {
        cache.delete(key);
        falsePositiveCount++;
      }
    }
  }
  
  // Verify other contact's key still exists
  const otherStillExists = cache.get(otherKey);
  
  if (!otherStillExists) {
    console.error('\x1b[31m❌ FAIL: Pattern matching deleted unrelated cache entry\x1b[0m');
    process.exit(1);
  }
  
  console.log(`\x1b[32m✅ PASS: Pattern matching is specific - did not delete other contact's cache\x1b[0m`);
  
  // Cleanup
  cache.delete(otherKey);

  console.log('\n================================================================================');
  console.log('\x1b[1m\x1b[32m✅ ALL TESTS PASSED\x1b[0m');
  console.log('================================================================================\n');
  
  console.log('\x1b[36mSummary:\x1b[0m');
  console.log('✅ CacheService.keys() method works correctly');
  console.log('✅ CacheService.delete() method works correctly');
  console.log('✅ Cache set/get/delete operations function properly');
  console.log('✅ Pattern-based cache invalidation works');
  console.log('✅ Pattern matching is specific to contact ID\n');
  
  console.log('\x1b[32m🎉 Cache invalidation fix is working correctly!\x1b[0m\n');
  console.log('\x1b[33mNext step: Create a booking and verify cache is invalidated in real-time\x1b[0m\n');

} catch (error) {
  console.error('\n\x1b[31m❌ TEST FAILED WITH ERROR:\x1b[0m');
  console.error(error);
  process.exit(1);
}
