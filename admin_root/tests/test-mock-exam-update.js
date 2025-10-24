/**
 * Test script for Mock Exam Update (PATCH) functionality
 * Run with: node tests/test-mock-exam-update.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';
const MOCK_EXAM_ID = process.env.MOCK_EXAM_ID || '12345678901'; // Replace with actual ID

// Test cases
const testCases = [
  {
    name: 'Update capacity only',
    data: {
      capacity: 30
    },
    expectedStatus: 200
  },
  {
    name: 'Update multiple fields',
    data: {
      capacity: 25,
      location: 'Vancouver',
      address: '456 New Street, Vancouver, BC'
    },
    expectedStatus: 200
  },
  {
    name: 'Update time fields',
    data: {
      start_time: '10:00:00',
      end_time: '13:00:00'
    },
    expectedStatus: 200
  },
  {
    name: 'Invalid capacity (below bookings)',
    data: {
      capacity: 5 // Assuming there are more than 5 bookings
    },
    expectedStatus: 409
  },
  {
    name: 'Invalid time (end before start)',
    data: {
      start_time: '14:00:00',
      end_time: '13:00:00'
    },
    expectedStatus: 400
  },
  {
    name: 'Past date validation',
    data: {
      exam_date: '2020-01-01'
    },
    expectedStatus: 400
  },
  {
    name: 'Empty update',
    data: {},
    expectedStatus: 400
  },
  {
    name: 'Toggle active status',
    data: {
      is_active: false
    },
    expectedStatus: 200
  }
];

/**
 * Run a single test case
 */
async function runTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Payload:`, JSON.stringify(testCase.data, null, 2));

  try {
    const response = await axios({
      method: 'PATCH',
      url: `${BASE_URL}/api/admin/mock-exams/${MOCK_EXAM_ID}`,
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: testCase.data,
      validateStatus: () => true // Don't throw on non-2xx status
    });

    const statusMatch = response.status === testCase.expectedStatus;
    const icon = statusMatch ? '✅' : '❌';

    console.log(`   ${icon} Status: ${response.status} (expected: ${testCase.expectedStatus})`);

    if (response.data.success) {
      console.log(`   ✅ Success Response:`, {
        id: response.data.data?.id,
        changes: response.data.meta?.changes,
        updated_by: response.data.meta?.updated_by
      });
    } else {
      console.log(`   ℹ️  Error Response:`, {
        code: response.data.error?.code,
        message: response.data.error?.message,
        details: response.data.error?.details
      });
    }

    return statusMatch;

  } catch (error) {
    console.error(`   ❌ Test failed with error:`, error.message);
    return false;
  }
}

/**
 * Get current mock exam details before testing
 */
async function getMockExamDetails() {
  try {
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/api/admin/mock-exams/${MOCK_EXAM_ID}`,
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch mock exam details:', error.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Mock Exam Update Test Suite');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Mock Exam ID: ${MOCK_EXAM_ID}`);

  // First, get current exam details
  console.log('\n📋 Fetching current mock exam details...');
  const currentDetails = await getMockExamDetails();

  if (!currentDetails) {
    console.error('❌ Could not fetch mock exam details. Please verify the ID and authentication.');
    process.exit(1);
  }

  console.log('Current Details:', {
    id: currentDetails.id,
    mock_type: currentDetails.mock_type,
    capacity: currentDetails.capacity,
    total_bookings: currentDetails.total_bookings,
    location: currentDetails.location,
    is_active: currentDetails.is_active
  });

  // Run all test cases
  console.log('\n🧪 Running Test Cases...');
  console.log('========================');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    // Adjust test data based on current state
    if (testCase.name === 'Invalid capacity (below bookings)' && currentDetails.total_bookings) {
      testCase.data.capacity = Math.max(1, currentDetails.total_bookings - 5);
    }

    const result = await runTest(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }

    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${passed + failed}`);

  // Final verification - fetch updated details
  console.log('\n📋 Fetching final mock exam details...');
  const finalDetails = await getMockExamDetails();

  if (finalDetails) {
    console.log('Final Details:', {
      id: finalDetails.id,
      capacity: finalDetails.capacity,
      location: finalDetails.location,
      is_active: finalDetails.is_active,
      updated_at: finalDetails.updated_at
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});