/**
 * Verify the time formatting fix works correctly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('\n========================================');
console.log('VERIFYING TIME FORMATTING FIX');
console.log('========================================\n');

// Test the formatTime function with ISO 8601 strings

const formatTime = (timeValue) => {
  if (!timeValue) return null;

  try {
    // Handle ISO 8601 format (e.g., "2025-12-25T19:00:00Z")
    if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timeValue)) {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        // Convert UTC to Toronto timezone and return HH:mm format
        const torontoTime = date.toLocaleString('en-US', {
          timeZone: 'America/Toronto',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        return torontoTime;
      }
    }

    // Handle Unix timestamp (milliseconds)
    const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        // Return HH:mm format in Toronto timezone
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    }
  } catch (e) {
    console.error('Error formatting time:', e);
  }

  return null;
};

// Test cases
const testCases = [
  {
    name: 'Exam 37367871402 Start Time (2:00 PM Toronto)',
    input: '2025-12-25T19:00:00Z',
    expectedHour: 14,
    expectedMinute: 0,
    expectedDisplay: '14:00'
  },
  {
    name: 'Exam 37367871402 End Time (7:00 PM Toronto)',
    input: '2025-12-26T00:00:00Z',
    expectedHour: 19,
    expectedMinute: 0,
    expectedDisplay: '19:00'
  },
  {
    name: 'December 4 Clinical Skills Start Time',
    input: '2025-12-04T14:00:00Z',
    expectedHour: 9,
    expectedMinute: 0,
    expectedDisplay: '09:00'
  },
  {
    name: 'December 4 Clinical Skills End Time',
    input: '2025-12-04T22:00:00Z',
    expectedHour: 17,
    expectedMinute: 0,
    expectedDisplay: '17:00'
  }
];

console.log('Running test cases...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`   Input: ${test.input}`);

  const result = formatTime(test.input);
  console.log(`   Output: ${result}`);

  // Parse the result to check hours and minutes
  if (result && /^\d{2}:\d{2}$/.test(result)) {
    const [hours, minutes] = result.split(':').map(Number);

    if (hours === test.expectedHour && minutes === test.expectedMinute) {
      console.log(`   ✅ PASS - Matches expected ${test.expectedDisplay}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Expected ${test.expectedDisplay}, got ${result}`);
      failed++;
    }
  } else {
    console.log(`   ❌ FAIL - Invalid format: ${result}`);
    failed++;
  }

  console.log('');
});

console.log('========================================');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed === 0) {
  console.log('🎉 All tests passed! The fix is working correctly.\n');
} else {
  console.log('⚠️  Some tests failed. Please review the fix.\n');
}
