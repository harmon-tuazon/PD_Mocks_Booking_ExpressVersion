/**
 * Test script for Mock Discussion Prerequisite Associations API
 *
 * This script tests the new prerequisite association endpoints:
 * - POST /api/admin/mock-exams/[id]/prerequisites
 * - GET /api/admin/mock-exams/[id]/prerequisites
 * - DELETE /api/admin/mock-exams/[id]/prerequisites/[prerequisiteId]
 * - GET /api/admin/mock-exams/[id] (with prerequisite associations)
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const BASE_URL = process.env.VERCEL_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/admin`;

// You'll need to get these from your browser's developer tools after logging in
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''; // Set this to your Supabase JWT token

// Test data - Replace with actual IDs from your HubSpot instance
const TEST_MOCK_DISCUSSION_ID = '18440533960'; // Replace with an actual Mock Discussion exam ID
const TEST_CLINICAL_SKILLS_ID = '18440533951'; // Replace with an actual Clinical Skills exam ID
const TEST_SITUATIONAL_JUDGMENT_ID = '18440533952'; // Replace with an actual Situational Judgment exam ID

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ ${method} ${endpoint} failed:`, error.response.data);
      throw error.response.data;
    }
    throw error;
  }
}

// Test functions
async function testGetMockExamDetails() {
  console.log('\n📋 Testing GET mock exam details with prerequisites...');

  try {
    const response = await makeRequest('GET', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}`);

    console.log('✅ Mock exam details retrieved successfully');
    console.log('   Mock Type:', response.data.mock_type);
    console.log('   Exam Date:', response.data.exam_date);
    console.log('   Location:', response.data.location);

    if (response.data.prerequisite_exams) {
      console.log('   Prerequisites:', response.data.prerequisite_exams.length);
      response.data.prerequisite_exams.forEach((prereq, index) => {
        console.log(`     ${index + 1}. ${prereq.mock_type} - ${prereq.location} - ${prereq.exam_date}`);
      });
    } else {
      console.log('   Prerequisites: None (or not a Mock Discussion)');
    }

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get mock exam details');
    throw error;
  }
}

async function testCreatePrerequisites() {
  console.log('\n🔗 Testing POST create prerequisite associations...');

  const prerequisiteIds = [TEST_CLINICAL_SKILLS_ID, TEST_SITUATIONAL_JUDGMENT_ID];

  try {
    const response = await makeRequest('POST', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}/prerequisites`, {
      prerequisite_exam_ids: prerequisiteIds
    });

    console.log('✅ Prerequisites created successfully');
    console.log('   Associations created:', response.data.associations_created);
    console.log('   Associations deleted:', response.data.associations_deleted);
    console.log('   Total prerequisites:', response.data.total_prerequisites);

    return response.data;
  } catch (error) {
    console.error('❌ Failed to create prerequisites');
    throw error;
  }
}

async function testGetPrerequisites() {
  console.log('\n📖 Testing GET prerequisite associations...');

  try {
    const response = await makeRequest('GET', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}/prerequisites`);

    console.log('✅ Prerequisites retrieved successfully');
    console.log('   Mock exam type:', response.data.mock_exam_type);
    console.log('   Total prerequisites:', response.data.total_prerequisites);

    response.data.prerequisite_exams.forEach((prereq, index) => {
      console.log(`   ${index + 1}. ${prereq.mock_type} - ${prereq.location} - ${prereq.exam_date}`);
      console.log(`      Capacity: ${prereq.capacity}, Bookings: ${prereq.total_bookings}`);
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get prerequisites');
    throw error;
  }
}

async function testRemovePrerequisite(prerequisiteId) {
  console.log(`\n🗑️  Testing DELETE remove prerequisite ${prerequisiteId}...`);

  try {
    const response = await makeRequest('DELETE', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}/prerequisites/${prerequisiteId}`);

    console.log('✅ Prerequisite removed successfully');
    console.log('   Removed ID:', response.data.removed_prerequisite_id);
    console.log('   Remaining prerequisites:', response.data.remaining_prerequisites_count);

    return response.data;
  } catch (error) {
    console.error('❌ Failed to remove prerequisite');
    throw error;
  }
}

async function testClearAllPrerequisites() {
  console.log('\n🧹 Testing clear all prerequisites (empty array)...');

  try {
    const response = await makeRequest('POST', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}/prerequisites`, {
      prerequisite_exam_ids: []
    });

    console.log('✅ All prerequisites cleared successfully');
    console.log('   Associations deleted:', response.data.associations_deleted);
    console.log('   Total prerequisites:', response.data.total_prerequisites);

    return response.data;
  } catch (error) {
    console.error('❌ Failed to clear prerequisites');
    throw error;
  }
}

async function testInvalidRequests() {
  console.log('\n⚠️  Testing error handling...');

  // Test 1: Invalid mock exam ID
  console.log('   Testing invalid mock exam ID...');
  try {
    await makeRequest('POST', '/mock-exams/invalid-id/prerequisites', {
      prerequisite_exam_ids: []
    });
    console.log('   ❌ Should have failed with invalid ID');
  } catch (error) {
    if (error.error?.code === 'INVALID_ID') {
      console.log('   ✅ Correctly rejected invalid ID');
    }
  }

  // Test 2: Non-existent mock exam
  console.log('   Testing non-existent mock exam...');
  try {
    await makeRequest('POST', '/mock-exams/99999999999/prerequisites', {
      prerequisite_exam_ids: []
    });
    console.log('   ❌ Should have failed with not found');
  } catch (error) {
    if (error.error?.code === 'NOT_FOUND') {
      console.log('   ✅ Correctly returned not found');
    }
  }

  // Test 3: Invalid prerequisite exam ID
  console.log('   Testing invalid prerequisite exam ID...');
  try {
    await makeRequest('POST', `/mock-exams/${TEST_MOCK_DISCUSSION_ID}/prerequisites`, {
      prerequisite_exam_ids: ['99999999999']
    });
    console.log('   ❌ Should have failed with validation error');
  } catch (error) {
    if (error.error?.code === 'VALIDATION_ERROR' || error.error?.code === 'NOT_FOUND') {
      console.log('   ✅ Correctly rejected invalid prerequisite');
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Mock Discussion Prerequisite API Tests');
  console.log('================================================');

  if (!AUTH_TOKEN) {
    console.error('❌ Please set TEST_AUTH_TOKEN environment variable');
    console.log('\nTo get your auth token:');
    console.log('1. Log into the admin dashboard');
    console.log('2. Open browser developer tools (F12)');
    console.log('3. Go to Application/Storage → Local Storage');
    console.log('4. Find the Supabase auth token');
    console.log('5. Copy the access_token value');
    console.log('6. Set TEST_AUTH_TOKEN in .env or as environment variable');
    process.exit(1);
  }

  try {
    // Test 1: Get initial state
    console.log('\n--- Initial State ---');
    await testGetMockExamDetails();

    // Test 2: Create prerequisites
    console.log('\n--- Create Prerequisites ---');
    await testCreatePrerequisites();

    // Test 3: Get prerequisites
    console.log('\n--- Verify Prerequisites ---');
    await testGetPrerequisites();

    // Test 4: Get exam details with prerequisites
    console.log('\n--- Exam Details with Prerequisites ---');
    await testGetMockExamDetails();

    // Test 5: Remove one prerequisite
    console.log('\n--- Remove Single Prerequisite ---');
    await testRemovePrerequisite(TEST_CLINICAL_SKILLS_ID);

    // Test 6: Verify removal
    console.log('\n--- Verify After Removal ---');
    await testGetPrerequisites();

    // Test 7: Clear all prerequisites
    console.log('\n--- Clear All Prerequisites ---');
    await testClearAllPrerequisites();

    // Test 8: Verify cleared
    console.log('\n--- Verify All Cleared ---');
    await testGetPrerequisites();

    // Test 9: Error handling
    console.log('\n--- Error Handling ---');
    await testInvalidRequests();

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message || error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);