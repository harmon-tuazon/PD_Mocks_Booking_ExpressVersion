/**
 * Test Dominant Hand Display Formatting
 * Tests the formatDominantHand function from BookingRow component
 */

// Simulate the formatDominantHand function from BookingRow.jsx
function formatDominantHand(hand) {
  if (!hand) return 'N/A';
  const handLower = hand.toLowerCase();
  if (handLower === 'right hand' || handLower === 'right' || handLower === 'r') return 'Right Hand';
  if (handLower === 'left hand' || handLower === 'left' || handLower === 'l') return 'Left Hand';
  return hand;
}

// Test cases
const testCases = [
  // From Supabase (after transformation)
  { input: 'right hand', expected: 'Right Hand', description: 'Supabase value "right hand"' },
  { input: 'left hand', expected: 'Left Hand', description: 'Supabase value "left hand"' },

  // Legacy values (just in case)
  { input: 'right', expected: 'Right Hand', description: 'Legacy "right"' },
  { input: 'left', expected: 'Left Hand', description: 'Legacy "left"' },
  { input: 'r', expected: 'Right Hand', description: 'Shorthand "r"' },
  { input: 'l', expected: 'Left Hand', description: 'Shorthand "l"' },

  // Case insensitive
  { input: 'RIGHT HAND', expected: 'Right Hand', description: 'Uppercase "RIGHT HAND"' },
  { input: 'LEFT HAND', expected: 'Left Hand', description: 'Uppercase "LEFT HAND"' },
  { input: 'Right Hand', expected: 'Right Hand', description: 'Title case "Right Hand"' },
  { input: 'Left Hand', expected: 'Left Hand', description: 'Title case "Left Hand"' },

  // Null/undefined
  { input: null, expected: 'N/A', description: 'Null value' },
  { input: undefined, expected: 'N/A', description: 'Undefined value' },
  { input: '', expected: 'N/A', description: 'Empty string' }
];

console.log('🎨 Testing Dominant Hand Display Formatting\n');

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  const result = formatDominantHand(testCase.input);
  const passed = result === testCase.expected;

  if (passed) {
    console.log(`✅ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    console.log(`   Output: ${JSON.stringify(result)}`);
    passedTests++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
    console.log(`   Got: ${JSON.stringify(result)}`);
    failedTests++;
  }
  console.log('');
});

console.log('='.repeat(60));
console.log(`📊 Test Results: ${passedTests}/${testCases.length} passed`);
if (failedTests > 0) {
  console.log(`❌ ${failedTests} tests failed`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  process.exit(0);
}
