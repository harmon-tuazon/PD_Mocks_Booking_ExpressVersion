#!/usr/bin/env node

/**
 * Test script to verify auto-completion of past bookings
 * This script simulates the booking list API call and logs the results
 */

require('dotenv').config();

// Mock request/response objects for testing
const mockReq = {
  method: 'GET',
  query: {
    student_id: process.env.TEST_STUDENT_ID || 'TEST123',
    email: process.env.TEST_EMAIL || 'test@example.com',
    filter: 'all',
    page: '1',
    limit: '20',
    force: 'true'  // Force cache refresh to ensure we get fresh data
  }
};

const mockRes = {
  statusCode: null,
  headers: {},
  body: null,

  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(data) {
    this.body = data;
    console.log('\n=== API Response ===');
    console.log('Status:', this.statusCode);
    console.log('Body:', JSON.stringify(data, null, 2));

    // Check for auto-completed bookings
    if (data.success && data.data && data.data.bookings) {
      const completedBookings = data.data.bookings.filter(b => b.is_active === 'Completed');
      console.log(`\n✅ Found ${completedBookings.length} Completed bookings`);

      completedBookings.forEach(booking => {
        console.log(`  - Booking ${booking.id}: ${booking.mock_type} on ${booking.exam_date}`);
      });
    }

    return this;
  }
};

// Import the handler
const handler = require('./api/bookings/list');

// Add environment check
if (!process.env.HS_PRIVATE_APP_TOKEN) {
  console.error('❌ HS_PRIVATE_APP_TOKEN environment variable is not set');
  console.log('Please ensure your .env file contains the HubSpot private app token');
  process.exit(1);
}

console.log('🔧 Testing auto-completion of past bookings...');
console.log('📋 Test parameters:', {
  student_id: mockReq.query.student_id,
  email: mockReq.query.email,
  filter: mockReq.query.filter
});

// Run the test
handler(mockReq, mockRes)
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });