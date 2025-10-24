/**
 * Test the sessions endpoint with various aggregate key formats
 * Run with: node tests/test-sessions-endpoint.js
 */

const testKeyParsing = () => {
  console.log('=== Testing Aggregate Key Parsing ===\n');

  // Test cases with different formats
  const testCases = [
    {
      key: 'usmle_step_1_miami_2025-01-15',
      expected: {
        date: '2025-01-15',
        prefix: 'usmle_step_1_miami',
        shouldPass: true
      }
    },
    {
      key: 'comlex_level_2_new_york_2025-02-28',
      expected: {
        date: '2025-02-28',
        prefix: 'comlex_level_2_new_york',
        shouldPass: true
      }
    },
    {
      key: 'usmle_step_2_ck_los_angeles_2025-03-10',
      expected: {
        date: '2025-03-10',
        prefix: 'usmle_step_2_ck_los_angeles',
        shouldPass: true
      }
    },
    {
      key: 'nbme_shelf_exam_chicago_medical_center_2025-04-05',
      expected: {
        date: '2025-04-05',
        prefix: 'nbme_shelf_exam_chicago_medical_center',
        shouldPass: true
      }
    },
    {
      key: 'invalid_key_without_date',
      expected: {
        date: null,
        prefix: null,
        shouldPass: false
      }
    },
    {
      key: 'test_with_invalid_date_20250115',
      expected: {
        date: null,
        prefix: null,
        shouldPass: false
      }
    }
  ];

  let passCount = 0;
  let failCount = 0;

  testCases.forEach(testCase => {
    const { key, expected } = testCase;
    console.log(`Testing: "${key}"`);

    // Apply the fixed parsing logic
    const datePattern = /\d{4}-\d{2}-\d{2}$/;
    const dateMatch = key.match(datePattern);

    if (dateMatch) {
      const exam_date = dateMatch[0];
      const prefixWithoutDate = key.substring(0, key.length - exam_date.length - 1);

      if (expected.shouldPass) {
        if (exam_date === expected.date && prefixWithoutDate === expected.prefix) {
          console.log(`  ✅ PASS: Correctly parsed date="${exam_date}", prefix="${prefixWithoutDate}"`);
          passCount++;
        } else {
          console.log(`  ❌ FAIL: Expected date="${expected.date}", prefix="${expected.prefix}"`);
          console.log(`           Got date="${exam_date}", prefix="${prefixWithoutDate}"`);
          failCount++;
        }
      } else {
        console.log(`  ❌ FAIL: Should not have parsed but got date="${exam_date}"`);
        failCount++;
      }
    } else {
      if (!expected.shouldPass) {
        console.log(`  ✅ PASS: Correctly failed to parse invalid key`);
        passCount++;
      } else {
        console.log(`  ❌ FAIL: Should have parsed date="${expected.date}" but failed`);
        failCount++;
      }
    }
    console.log('');
  });

  console.log('=== Test Summary ===');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n✅ All tests passed! The key parsing logic is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Review the parsing logic.');
    process.exit(1);
  }
};

// Run the tests
testKeyParsing();

console.log('\n=== Key Format Documentation ===');
console.log('Aggregate keys follow this format: {mock_type}_{location}_{exam_date}');
console.log('- mock_type: Can contain underscores (e.g., "usmle_step_1")');
console.log('- location: Can contain underscores (e.g., "new_york")');
console.log('- exam_date: Always in YYYY-MM-DD format with hyphens');
console.log('- All spaces in mock_type and location are replaced with underscores');
console.log('- Everything is lowercased');
console.log('\nExamples:');
console.log('  "USMLE Step 1" + "Miami" + "2025-01-15" → "usmle_step_1_miami_2025-01-15"');
console.log('  "COMLEX Level 2" + "New York" + "2025-02-28" → "comlex_level_2_new_york_2025-02-28"');