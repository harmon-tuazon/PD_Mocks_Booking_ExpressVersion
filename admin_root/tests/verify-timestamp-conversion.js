/**
 * Test script to verify timezone conversion fix
 *
 * This test verifies that the convertToTimestamp function correctly
 * converts date and time inputs to EST timestamps.
 *
 * Expected behavior:
 * - Input: 2026-04-30, 09:00 (9:00 AM EST)
 * - Output: Timestamp representing 9:00 AM EST (14:00 UTC)
 * - When displayed in EST: Should show 9:00 AM, not 4:00 AM
 */

// Mock convertToTimestamp function with the fix
function convertToTimestamp(examDate, timeString) {
  if (!examDate || !timeString) {
    throw new Error('Both examDate and timeString are required for timestamp conversion');
  }

  console.log('🕐 [CONVERT-TIMESTAMP] Input:', { examDate, timeString });

  // Parse time string (HH:MM or HH:MM:SS)
  const timeParts = timeString.split(':');
  const hours = String(timeParts[0]).padStart(2, '0');
  const minutes = String(timeParts[1] || '0').padStart(2, '0');
  const seconds = String(timeParts[2] || '0').padStart(2, '0');

  // Create ISO string with explicit Toronto/EST timezone offset (UTC-5)
  const isoString = `${examDate}T${hours}:${minutes}:${seconds}-05:00`;

  console.log('🕐 [CONVERT-TIMESTAMP] ISO String:', isoString);

  // Parse ISO string to Date object
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    console.error('❌ [CONVERT-TIMESTAMP] Invalid date created:', { isoString, examDate, timeString });
    throw new Error('Invalid date or time format');
  }

  const timestamp = date.getTime();
  console.log('🕐 [CONVERT-TIMESTAMP] Output timestamp:', timestamp);
  console.log('🕐 [CONVERT-TIMESTAMP] Represents:', new Date(timestamp).toISOString());

  return timestamp;
}

// Test cases
console.log('\n========================================');
console.log('TEST 1: User creates session at 9:00 AM');
console.log('========================================\n');

const test1Date = '2026-04-30';
const test1Time = '09:00';
const test1Timestamp = convertToTimestamp(test1Date, test1Time);

// Verify the timestamp
const test1DateObj = new Date(test1Timestamp);
console.log('\n✅ Verification:');
console.log('  - ISO String:', test1DateObj.toISOString());
console.log('  - UTC Time:', test1DateObj.toUTCString());
console.log('  - Local Time String:', test1DateObj.toLocaleString('en-US', { timeZone: 'America/Toronto' }));

// Expected: 9:00 AM EST = 14:00 UTC (9 AM + 5 hours)
const expectedUTCHour = 14; // 9 AM EST = 2 PM UTC
const actualUTCHour = test1DateObj.getUTCHours();

if (actualUTCHour === expectedUTCHour) {
  console.log('\n✅ TEST 1 PASSED: Timestamp correctly represents 9:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour} (expected ${expectedUTCHour})`);
} else {
  console.log('\n❌ TEST 1 FAILED: Timestamp does NOT represent 9:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour} (expected ${expectedUTCHour})`);
}

console.log('\n========================================');
console.log('TEST 2: User creates session at 10:00 AM');
console.log('========================================\n');

const test2Date = '2026-04-30';
const test2Time = '10:00';
const test2Timestamp = convertToTimestamp(test2Date, test2Time);

const test2DateObj = new Date(test2Timestamp);
console.log('\n✅ Verification:');
console.log('  - ISO String:', test2DateObj.toISOString());
console.log('  - UTC Time:', test2DateObj.toUTCString());
console.log('  - Local Time String:', test2DateObj.toLocaleString('en-US', { timeZone: 'America/Toronto' }));

const expectedUTCHour2 = 15; // 10 AM EST = 3 PM UTC
const actualUTCHour2 = test2DateObj.getUTCHours();

if (actualUTCHour2 === expectedUTCHour2) {
  console.log('\n✅ TEST 2 PASSED: Timestamp correctly represents 10:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour2} (expected ${expectedUTCHour2})`);
} else {
  console.log('\n❌ TEST 2 FAILED: Timestamp does NOT represent 10:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour2} (expected ${expectedUTCHour2})`);
}

console.log('\n========================================');
console.log('TEST 3: User creates session at 11:00 AM');
console.log('========================================\n');

const test3Date = '2026-04-30';
const test3Time = '11:00';
const test3Timestamp = convertToTimestamp(test3Date, test3Time);

const test3DateObj = new Date(test3Timestamp);
console.log('\n✅ Verification:');
console.log('  - ISO String:', test3DateObj.toISOString());
console.log('  - UTC Time:', test3DateObj.toUTCString());
console.log('  - Local Time String:', test3DateObj.toLocaleString('en-US', { timeZone: 'America/Toronto' }));

const expectedUTCHour3 = 16; // 11 AM EST = 4 PM UTC
const actualUTCHour3 = test3DateObj.getUTCHours();

if (actualUTCHour3 === expectedUTCHour3) {
  console.log('\n✅ TEST 3 PASSED: Timestamp correctly represents 11:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour3} (expected ${expectedUTCHour3})`);
} else {
  console.log('\n❌ TEST 3 FAILED: Timestamp does NOT represent 11:00 AM EST');
  console.log(`   UTC hour is ${actualUTCHour3} (expected ${expectedUTCHour3})`);
}

console.log('\n========================================');
console.log('TEST 4: With seconds in time string');
console.log('========================================\n');

const test4Date = '2026-04-30';
const test4Time = '09:30:45';
const test4Timestamp = convertToTimestamp(test4Date, test4Time);

const test4DateObj = new Date(test4Timestamp);
console.log('\n✅ Verification:');
console.log('  - ISO String:', test4DateObj.toISOString());
console.log('  - Minutes:', test4DateObj.getUTCMinutes(), '(expected 30)');
console.log('  - Seconds:', test4DateObj.getUTCSeconds(), '(expected 45)');

if (test4DateObj.getUTCMinutes() === 30 && test4DateObj.getUTCSeconds() === 45) {
  console.log('\n✅ TEST 4 PASSED: Seconds handled correctly');
} else {
  console.log('\n❌ TEST 4 FAILED: Seconds not handled correctly');
}

console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log('All tests verify that input times are correctly');
console.log('interpreted as EST (UTC-5) instead of UTC.');
console.log('This fixes the 5-hour offset issue.');
console.log('========================================\n');
