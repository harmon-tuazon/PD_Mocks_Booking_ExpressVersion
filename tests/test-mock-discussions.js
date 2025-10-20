/**
 * Test Script for Mock Discussion Booking Flow
 *
 * This script tests the complete Mock Discussion booking flow:
 * 1. Fetching available discussion sessions
 * 2. Validating mock_discussion_token
 * 3. Creating a discussion booking
 *
 * Usage: node tests/test-mock-discussions.js
 */

require('dotenv').config();
const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  BASE_URL: process.env.API_URL || 'http://localhost:3000',
  STUDENT_ID: process.env.TEST_STUDENT_ID || 'TEST123',
  EMAIL: process.env.TEST_EMAIL || 'test@example.com',
  DRY_RUN: process.env.DRY_RUN === 'true'
};

// Test data
const testData = {
  studentId: TEST_CONFIG.STUDENT_ID,
  email: TEST_CONFIG.EMAIL,
  firstName: 'Test',
  lastName: 'Student',
  phone: '555-0123',
  program: 'Test Program',
  campus: 'Test Campus'
};

// Helper function to make API calls
async function makeRequest(method, endpoint, data = null) {
  try {
    const url = `${TEST_CONFIG.BASE_URL}/api/mock-discussions${endpoint}`;
    console.log(`📡 ${method} ${url}`);

    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status:', error.response.status);
    }
    throw error;
  }
}

// Test 1: Fetch available discussion sessions
async function testGetAvailableSessions() {
  console.log('\n📋 Test 1: Fetching Available Discussion Sessions');
  console.log('================================================');

  try {
    const response = await makeRequest('GET', '/available?include_capacity=true&realtime=true');

    if (response.success) {
      console.log(`✅ Successfully fetched ${response.data.length} discussion session(s)`);

      // Display first 3 sessions
      const sessionsToShow = response.data.slice(0, 3);
      sessionsToShow.forEach((session, index) => {
        console.log(`\n📍 Session ${index + 1}:`);
        console.log(`   ID: ${session.mock_exam_id}`);
        console.log(`   Type: ${session.mock_type}`);
        console.log(`   Date: ${session.exam_date}`);
        console.log(`   Time: ${session.start_time} - ${session.end_time}`);
        console.log(`   Location: ${session.location}`);
        console.log(`   Capacity: ${session.total_bookings}/${session.capacity}`);
        console.log(`   Available: ${session.available_slots} slots`);
        console.log(`   Status: ${session.status}`);
      });

      if (response.data.length > 3) {
        console.log(`\n... and ${response.data.length - 3} more session(s)`);
      }

      return response.data;
    } else {
      console.error('❌ Failed to fetch sessions:', response.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Test 1 Failed');
    return [];
  }
}

// Test 2: Validate mock discussion token
async function testValidateCredits() {
  console.log('\n💳 Test 2: Validating Mock Discussion Token');
  console.log('===========================================');

  try {
    const response = await makeRequest('POST', '/validate-credits', {
      student_id: testData.studentId,
      email: testData.email
    });

    if (response.success) {
      const data = response.data;
      console.log(`✅ Validation successful`);
      console.log(`   Student: ${data.student_name}`);
      console.log(`   Contact ID: ${data.contact_id}`);
      console.log(`   Eligible: ${data.eligible ? 'Yes' : 'No'}`);
      console.log(`   Available Tokens: ${data.available_credits}`);

      if (data.enrollment_id) {
        console.log(`   Enrollment ID: ${data.enrollment_id}`);
      }

      if (!data.eligible) {
        console.log(`   ⚠️ ${data.error_message}`);
      }

      return data;
    } else {
      console.error('❌ Validation failed:', response.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Test 2 Failed');
    return null;
  }
}

// Test 3: Create a discussion booking
async function testCreateBooking(sessionId, validationData) {
  console.log('\n📝 Test 3: Creating Discussion Booking');
  console.log('======================================');

  if (!sessionId) {
    console.log('⚠️ No session ID provided, skipping booking creation');
    return;
  }

  if (!validationData || !validationData.eligible) {
    console.log('⚠️ User not eligible for booking, skipping');
    return;
  }

  if (TEST_CONFIG.DRY_RUN) {
    console.log('🔵 DRY RUN MODE - Not creating actual booking');
    return;
  }

  try {
    const bookingData = {
      mock_exam_id: sessionId,
      contact_id: validationData.contact_id,
      enrollment_id: validationData.enrollment_id,
      student_id: testData.studentId,
      email: testData.email,
      first_name: testData.firstName,
      last_name: testData.lastName,
      phone: testData.phone,
      program: testData.program,
      campus: testData.campus,
      discussion_format: 'Virtual', // Optional: Virtual/In-Person/Hybrid
      topic_preference: 'General review of exam results' // Optional
    };

    console.log('📤 Creating booking with data:');
    console.log(`   Session ID: ${bookingData.mock_exam_id}`);
    console.log(`   Student: ${bookingData.first_name} ${bookingData.last_name}`);
    console.log(`   Format: ${bookingData.discussion_format}`);
    console.log(`   Topic: ${bookingData.topic_preference}`);

    const response = await makeRequest('POST', '/create-booking', bookingData);

    if (response.success) {
      console.log(`✅ Booking created successfully!`);
      console.log(`   Booking ID: ${response.data.bookingId}`);
      console.log(`   Booking Number: ${response.data.bookingNumber}`);
      console.log(`   Confirmation: ${response.data.confirmation}`);

      if (response.data.timeline_note_id) {
        console.log(`   Timeline Note: ${response.data.timeline_note_id}`);
      }

      return response.data;
    } else {
      console.error('❌ Booking creation failed:', response.error);
      return null;
    }
  } catch (error) {
    // Check if it's an idempotency error
    if (error.response && error.response.status === 409) {
      console.log('⚠️ Booking already exists (idempotency check)');
      console.log('   This is expected if you run the test multiple times');
    } else {
      console.error('❌ Test 3 Failed');
    }
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Mock Discussion Booking Flow Test Suite');
  console.log('==========================================');
  console.log(`📍 API URL: ${TEST_CONFIG.BASE_URL}`);
  console.log(`👤 Test Student: ${TEST_CONFIG.STUDENT_ID}`);
  console.log(`📧 Test Email: ${TEST_CONFIG.EMAIL}`);
  console.log(`🔵 Dry Run: ${TEST_CONFIG.DRY_RUN ? 'Yes' : 'No'}`);

  try {
    // Test 1: Get available sessions
    const sessions = await testGetAvailableSessions();

    // Test 2: Validate credits
    const validationData = await testValidateCredits();

    // Test 3: Create booking (only if we have sessions and valid tokens)
    if (sessions.length > 0 && validationData) {
      // Find first available session
      const availableSession = sessions.find(s => s.available_slots > 0);

      if (availableSession) {
        console.log(`\n🎯 Selected session for booking: ${availableSession.mock_exam_id}`);
        await testCreateBooking(availableSession.mock_exam_id, validationData);
      } else {
        console.log('\n⚠️ No sessions with available slots found');
      }
    }

    console.log('\n✅ All tests completed!');
    console.log('========================');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();