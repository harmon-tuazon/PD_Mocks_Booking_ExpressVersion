/**
 * Test script for the mock exam bookings endpoint
 * Tests the GET /api/admin/mock-exams/[id]/bookings endpoint
 *
 * Usage:
 * node test-mock-exam-bookings-endpoint.js [mockExamId]
 *
 * If no mockExamId is provided, it will find one from existing mock exams
 */

const axios = require('axios');
const hubspot = require('../api/_shared/hubspot');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg, data) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`, data || ''),
  success: (msg, data) => console.log(`${colors.green}✓${colors.reset} ${msg}`, data || ''),
  error: (msg, data) => console.log(`${colors.red}✗${colors.reset} ${msg}`, data || ''),
  warning: (msg, data) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`, data || ''),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n${'─'.repeat(50)}`)
};

/**
 * Find a mock exam with bookings for testing
 */
async function findMockExamWithBookings() {
  try {
    log.info('Searching for mock exams with bookings...');

    // Fetch recent mock exams
    const mockExams = await hubspot.searchMockExams({
      limit: 20,
      sorts: [{
        propertyName: 'hs_createdate',
        direction: 'DESCENDING'
      }]
    });

    // Find one with bookings
    for (const exam of mockExams) {
      const totalBookings = parseInt(exam.properties.total_bookings) || 0;
      if (totalBookings > 0) {
        log.success(`Found mock exam ${exam.id} with ${totalBookings} bookings`);
        return exam.id;
      }
    }

    log.warning('No mock exams with bookings found');
    return null;
  } catch (error) {
    log.error('Error finding mock exam:', error.message);
    return null;
  }
}

/**
 * Test the bookings endpoint with various parameters
 */
async function testBookingsEndpoint(mockExamId) {
  const tests = [
    {
      name: 'Basic fetch (default parameters)',
      params: {}
    },
    {
      name: 'With pagination (page 1, limit 10)',
      params: { page: 1, limit: 10 }
    },
    {
      name: 'Sort by name ascending',
      params: { sort_by: 'name', sort_order: 'asc' }
    },
    {
      name: 'Sort by email descending',
      params: { sort_by: 'email', sort_order: 'desc' }
    },
    {
      name: 'With search term',
      params: { search: 'test' }
    },
    {
      name: 'Page 2 with limit 5',
      params: { page: 2, limit: 5 }
    },
    {
      name: 'Invalid sort field (should error)',
      params: { sort_by: 'invalid_field' },
      expectError: true
    },
    {
      name: 'Limit exceeding max (should cap at 100)',
      params: { limit: 200 }
    }
  ];

  log.section('Testing Bookings Endpoint');

  for (const test of tests) {
    log.info(`\nTest: ${test.name}`);

    try {
      const queryParams = new URLSearchParams(test.params).toString();
      const url = `${API_BASE_URL}/api/admin/mock-exams/${mockExamId}/bookings${queryParams ? '?' + queryParams : ''}`;

      log.info('Request URL:', url);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (test.expectError) {
        log.error('Expected error but request succeeded');
      } else {
        const { data } = response;

        log.success('Response received:');
        console.log('  Success:', data.success);
        console.log('  Bookings count:', data.data?.bookings?.length || 0);
        console.log('  Pagination:', JSON.stringify(data.data?.pagination, null, 2));
        console.log('  Meta:', JSON.stringify(data.meta, null, 2));

        // Display first booking if available
        if (data.data?.bookings?.length > 0) {
          console.log('\n  First booking:');
          const firstBooking = data.data.bookings[0];
          console.log(`    ID: ${firstBooking.id}`);
          console.log(`    Booking ID: ${firstBooking.booking_id}`);
          console.log(`    Name: ${firstBooking.name}`);
          console.log(`    Email: ${firstBooking.email}`);
          console.log(`    Student ID: ${firstBooking.student_id}`);
          console.log(`    Dominant Hand: ${firstBooking.dominant_hand}`);
          console.log(`    Created: ${firstBooking.created_at}`);
        }
      }
    } catch (error) {
      if (test.expectError) {
        log.success('Expected error occurred:', error.response?.data?.error || error.message);
      } else {
        log.error('Unexpected error:', error.response?.data || error.message);
      }
    }
  }
}

/**
 * Test caching behavior
 */
async function testCaching(mockExamId) {
  log.section('Testing Cache Behavior');

  const url = `${API_BASE_URL}/api/admin/mock-exams/${mockExamId}/bookings?limit=5`;

  try {
    // First request (should miss cache)
    log.info('First request (cache miss expected)...');
    const start1 = Date.now();
    const response1 = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });
    const time1 = Date.now() - start1;

    log.success(`First request completed in ${time1}ms`);
    console.log('  Cached:', response1.data.meta?.cached || false);

    // Second request (should hit cache)
    log.info('Second request (cache hit expected)...');
    const start2 = Date.now();
    const response2 = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });
    const time2 = Date.now() - start2;

    log.success(`Second request completed in ${time2}ms`);
    console.log('  Cached:', response2.data.meta?.cached || false);

    if (response2.data.meta?.cached) {
      const speedup = Math.round((time1 / time2) * 100) / 100;
      log.success(`Cache speedup: ${speedup}x faster`);
    }
  } catch (error) {
    log.error('Caching test failed:', error.response?.data || error.message);
  }
}

/**
 * Test 404 handling for non-existent mock exam
 */
async function test404Handling() {
  log.section('Testing 404 Handling');

  const nonExistentId = '99999999999';
  const url = `${API_BASE_URL}/api/admin/mock-exams/${nonExistentId}/bookings`;

  try {
    log.info(`Testing with non-existent ID: ${nonExistentId}`);

    await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    });

    log.error('Expected 404 but request succeeded');
  } catch (error) {
    if (error.response?.status === 404) {
      log.success('Correctly returned 404 for non-existent mock exam');
      console.log('  Error message:', error.response.data?.error);
    } else {
      log.error('Unexpected error:', error.response?.data || error.message);
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log(`${colors.bright}${colors.blue}
╔══════════════════════════════════════════════════╗
║     Mock Exam Bookings Endpoint Test Suite      ║
╚══════════════════════════════════════════════════╝
${colors.reset}`);

  try {
    // Get mock exam ID from command line or find one
    let mockExamId = process.argv[2];

    if (!mockExamId) {
      log.info('No mock exam ID provided, searching for one...');
      mockExamId = await findMockExamWithBookings();

      if (!mockExamId) {
        log.error('No suitable mock exam found for testing');
        log.info('Please provide a mock exam ID as an argument');
        process.exit(1);
      }
    }

    log.success(`Using mock exam ID: ${mockExamId}`);

    // Run test suites
    await testBookingsEndpoint(mockExamId);
    await testCaching(mockExamId);
    await test404Handling();

    log.section('Test Suite Complete');
    log.success('All tests completed');

  } catch (error) {
    log.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);