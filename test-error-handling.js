/**
 * Test script for error handling in the booking system
 * This tests that proper error codes are returned and displayed correctly
 */

const axios = require('axios');

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test scenarios
const testScenarios = [
  {
    name: 'Duplicate Booking',
    description: 'Attempt to create a booking with an ID that already exists',
    endpoint: '/bookings/create',
    method: 'POST',
    data: {
      contact_id: '12345',
      mock_exam_id: '67890',
      student_id: 'TEST001',
      name: 'Test Student',
      email: 'test@example.com',
      exam_date: '2025-01-15',
      mock_type: 'Situational Judgment',
      attending_location: 'Online'
    },
    expectedError: {
      code: 'DUPLICATE_BOOKING',
      messagePattern: /already have a booking|duplicate/i
    }
  },
  {
    name: 'Insufficient Credits',
    description: 'Validate credits for a student with no credits',
    endpoint: '/mock-exams/validate-credits',
    method: 'POST',
    data: {
      student_id: 'NOCREDITS001',
      email: 'nocredits@example.com',
      mock_type: 'Clinical Skills'
    },
    expectedError: {
      code: 'INSUFFICIENT_CREDITS',
      messagePattern: /insufficient credits|0 credits/i
    }
  },
  {
    name: 'Student Not Found',
    description: 'Validate credits for non-existent student',
    endpoint: '/mock-exams/validate-credits',
    method: 'POST',
    data: {
      student_id: 'NOTFOUND999',
      email: 'notfound@example.com',
      mock_type: 'Situational Judgment'
    },
    expectedError: {
      code: 'STUDENT_NOT_FOUND',
      messagePattern: /student.*not found/i
    }
  },
  {
    name: 'Email Mismatch',
    description: 'Validate credits with mismatched email',
    endpoint: '/mock-exams/validate-credits',
    method: 'POST',
    data: {
      student_id: 'VALID001',
      email: 'wrong@example.com',
      mock_type: 'Situational Judgment'
    },
    expectedError: {
      code: 'EMAIL_MISMATCH',
      messagePattern: /email.*not match|email mismatch/i
    }
  },
  {
    name: 'Exam Full',
    description: 'Book an exam that is at capacity',
    endpoint: '/bookings/create',
    method: 'POST',
    data: {
      contact_id: '12345',
      mock_exam_id: 'FULL_EXAM_001',
      student_id: 'TEST001',
      name: 'Test Student',
      email: 'test@example.com',
      exam_date: '2025-01-20',
      mock_type: 'Mini-mock',
      attending_location: 'In-person'
    },
    expectedError: {
      code: 'EXAM_FULL',
      messagePattern: /exam.*full|capacity/i
    }
  },
  {
    name: 'Validation Error',
    description: 'Submit invalid data format',
    endpoint: '/bookings/create',
    method: 'POST',
    data: {
      contact_id: '12345',
      // Missing required fields
      email: 'invalid-email-format', // Invalid email
      mock_type: 'Invalid Type' // Invalid mock type
    },
    expectedError: {
      code: 'VALIDATION_ERROR',
      messagePattern: /invalid|validation/i
    }
  }
];

async function testErrorScenario(scenario) {
  log(`\nTesting: ${scenario.name}`, 'cyan');
  log(`Description: ${scenario.description}`, 'blue');

  try {
    const response = await axios({
      method: scenario.method,
      url: `${API_URL}${scenario.endpoint}`,
      data: scenario.data,
      validateStatus: () => true // Don't throw on error status codes
    });

    if (response.status >= 400) {
      const errorData = response.data;

      // Check if error code matches expected
      if (errorData.code === scenario.expectedError.code) {
        log(`✓ Correct error code: ${errorData.code}`, 'green');
      } else {
        log(`✗ Wrong error code. Expected: ${scenario.expectedError.code}, Got: ${errorData.code}`, 'red');
      }

      // Check if error message matches pattern
      const errorMessage = errorData.error || errorData.message || '';
      if (scenario.expectedError.messagePattern.test(errorMessage)) {
        log(`✓ Error message matches pattern: "${errorMessage}"`, 'green');
      } else {
        log(`✗ Error message doesn't match. Got: "${errorMessage}"`, 'red');
      }

      // Display full error response for debugging
      log(`Full error response:`, 'yellow');
      console.log(JSON.stringify(errorData, null, 2));
    } else {
      log(`✗ Expected error but request succeeded`, 'red');
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log(`✗ Could not connect to API at ${API_URL}`, 'red');
      log(`Make sure the server is running with: npm run dev`, 'yellow');
    } else {
      log(`✗ Unexpected error: ${error.message}`, 'red');
    }
  }
}

async function runTests() {
  log('\n=== Error Handling Test Suite ===\n', 'magenta');
  log(`Testing API at: ${API_URL}`, 'yellow');

  // Note: These tests are meant to be run against a test environment
  // Some scenarios may need mock data to be set up in HubSpot
  log('\nNote: Some tests require specific test data in HubSpot to work properly.', 'yellow');
  log('This is a diagnostic tool to verify error codes are properly returned.\n', 'yellow');

  for (const scenario of testScenarios) {
    await testErrorScenario(scenario);
    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  log('\n=== Test Suite Complete ===\n', 'magenta');
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});