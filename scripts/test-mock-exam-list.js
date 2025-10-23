#!/usr/bin/env node

/**
 * Test script for Mock Exams List API endpoint
 * This tests that the hubspot.listMockExams function is properly accessible
 */

const axios = require('axios');

// Test configuration
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

async function testMockExamsList() {
  console.log('🧪 Testing Mock Exams List Endpoint...\n');
  console.log(`📍 API URL: ${BASE_URL}/api/admin/mock-exams/list`);
  console.log(`🔑 Using token: ${ADMIN_TOKEN.substring(0, 10)}...`);
  console.log('=' . repeat(60));

  try {
    const response = await axios.get(`${BASE_URL}/api/admin/mock-exams/list`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 10,
        sort_by: 'exam_date',
        sort_order: 'asc'
      }
    });

    console.log('\n✅ SUCCESS! Mock exams list endpoint is working properly.');
    console.log('\n📊 Response Summary:');
    console.log(`   - Status: ${response.status}`);
    console.log(`   - Success: ${response.data.success}`);
    console.log(`   - Total Records: ${response.data.pagination?.total_records || 0}`);
    console.log(`   - Current Page: ${response.data.pagination?.current_page || 1}`);
    console.log(`   - Records Retrieved: ${response.data.data?.length || 0}`);

    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📝 Sample Mock Exam:');
      const firstExam = response.data.data[0];
      console.log(`   - ID: ${firstExam.id}`);
      console.log(`   - Type: ${firstExam.mock_type}`);
      console.log(`   - Date: ${firstExam.exam_date}`);
      console.log(`   - Location: ${firstExam.location}`);
      console.log(`   - Capacity: ${firstExam.capacity}`);
      console.log(`   - Bookings: ${firstExam.total_bookings}`);
      console.log(`   - Status: ${firstExam.status}`);
    }

    console.log('\n🎉 The hubspot.listMockExams function is properly exported and working!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR: Failed to fetch mock exams');

    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Error Message: ${error.response.data?.error || error.response.data?.message || 'Unknown error'}`);

      // Check if it's the specific error we're looking for
      if (error.response.data?.error?.includes('hubspot.listMockExams is not a function')) {
        console.error('\n🔧 THE BUG IS NOT FIXED YET!');
        console.error('   The hubspot module is not properly exporting the listMockExams function.');
        console.error('   Please check the hubspot.js module exports.');
      } else if (error.response.status === 401) {
        console.error('\n🔐 Authentication Error');
        console.error('   Please set the ADMIN_TOKEN environment variable.');
      }

      console.error('\n📄 Full Error Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   - No response received from server');
      console.error('   - Is the server running at', BASE_URL, '?');
    } else {
      console.error('   - Error:', error.message);
    }

    process.exit(1);
  }
}

// Direct test against HubSpot module
async function testHubSpotModule() {
  console.log('\n🔍 Testing HubSpot Module Directly...');
  console.log('=' . repeat(60));

  try {
    const hubspot = require('../admin_root/api/_shared/hubspot');

    console.log('✅ HubSpot module loaded successfully');
    console.log(`   - Type: ${typeof hubspot}`);
    console.log(`   - Has listMockExams: ${typeof hubspot.listMockExams === 'function' ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Has HubSpotService: ${typeof hubspot.HubSpotService === 'function' ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Has HUBSPOT_OBJECTS: ${typeof hubspot.HUBSPOT_OBJECTS === 'object' ? 'YES ✅' : 'NO ❌'}`);

    // List available methods
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(hubspot))
      .filter(name => typeof hubspot[name] === 'function' && name !== 'constructor');

    console.log(`\n📦 Available Methods (${methods.length}):`)
    methods.slice(0, 10).forEach(method => {
      console.log(`   - ${method}`);
    });
    if (methods.length > 10) {
      console.log(`   ... and ${methods.length - 10} more`);
    }

    // Test the listMockExams function if available
    if (typeof hubspot.listMockExams === 'function') {
      console.log('\n🧪 Testing listMockExams function...');
      const result = await hubspot.listMockExams({ page: 1, limit: 1 });
      console.log('✅ Function executed successfully!');
      console.log(`   - Total Results: ${result.total || 0}`);
      console.log(`   - Results Retrieved: ${result.results?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Failed to test HubSpot module:');
    console.error('   -', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Run tests
async function runTests() {
  // First test the module directly
  await testHubSpotModule();

  // Then test the API endpoint
  console.log('\n' + '=' . repeat(60));
  await testMockExamsList();
}

runTests();