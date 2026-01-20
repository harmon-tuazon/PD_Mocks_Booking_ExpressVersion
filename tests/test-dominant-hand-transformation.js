/**
 * Test Dominant Hand Transformation
 * Tests the conversion of boolean values to "right hand"/"left hand" strings
 */

// Simulate the transformation logic from supabase-data.js
function transformDominantHand(props) {
  let dominantHandValue = null;
  if (props.dominant_hand === 'true' || props.dominant_hand === true) {
    dominantHandValue = 'right hand';
  } else if (props.dominant_hand === 'false' || props.dominant_hand === false) {
    dominantHandValue = 'left hand';
  } else if (props.dominant_hand === 'right hand' || props.dominant_hand === 'left hand') {
    // Already in correct format
    dominantHandValue = props.dominant_hand;
  }
  return dominantHandValue;
}

// Test cases
const testCases = [
  // Boolean true (HubSpot stores right hand as true)
  { input: { dominant_hand: true }, expected: 'right hand', description: 'Boolean true' },
  { input: { dominant_hand: 'true' }, expected: 'right hand', description: 'String "true"' },

  // Boolean false (HubSpot stores left hand as false)
  { input: { dominant_hand: false }, expected: 'left hand', description: 'Boolean false' },
  { input: { dominant_hand: 'false' }, expected: 'left hand', description: 'String "false"' },

  // Already in correct format
  { input: { dominant_hand: 'right hand' }, expected: 'right hand', description: 'Already "right hand"' },
  { input: { dominant_hand: 'left hand' }, expected: 'left hand', description: 'Already "left hand"' },

  // Null/undefined
  { input: { dominant_hand: null }, expected: null, description: 'Null value' },
  { input: { dominant_hand: undefined }, expected: null, description: 'Undefined value' },
  { input: {}, expected: null, description: 'Missing property' }
];

console.log('🧪 Testing Dominant Hand Transformation Logic\n');

let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  const result = transformDominantHand(testCase.input);
  const passed = result === testCase.expected;

  if (passed) {
    console.log(`✅ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: ${JSON.stringify(testCase.input.dominant_hand)}`);
    console.log(`   Output: ${JSON.stringify(result)}`);
    passedTests++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: ${JSON.stringify(testCase.input.dominant_hand)}`);
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
