/**
 * Test script for trainee endpoints
 * Run with: node admin_root/api/admin/trainees/test-endpoints.js
 */

const axios = require('axios');
require('dotenv').config();

// Use local development URL or production URL
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN; // You'll need to set this

async function testEndpoints() {
  console.log('🧪 Testing Trainee Endpoints\n');
  console.log('Base URL:', BASE_URL);
  console.log('─'.repeat(50));

  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Search for trainees
    console.log('\n1. Testing Search Endpoint');
    console.log('   Endpoint: GET /api/admin/trainees/search');
    console.log('   Query: "1599999"');

    try {
      const searchResponse = await axios.get(`${BASE_URL}/api/admin/trainees/search`, {
        params: { query: '1599999' },
        headers
      });

      console.log('   ✅ Search successful');
      console.log('   Results found:', searchResponse.data.data.contacts.length);

      if (searchResponse.data.data.contacts.length > 0) {
        const firstContact = searchResponse.data.data.contacts[0];
        console.log('   First result:', {
          id: firstContact.id,
          name: `${firstContact.firstname} ${firstContact.lastname}`,
          student_id: firstContact.student_id
        });

        // Test 2: Get bookings for the first contact found
        console.log('\n2. Testing Bookings Endpoint');
        console.log('   Endpoint: GET /api/admin/trainees/[contactId]/bookings');
        console.log('   Contact ID:', firstContact.id);

        const bookingsResponse = await axios.get(
          `${BASE_URL}/api/admin/trainees/${firstContact.id}/bookings`,
          { headers }
        );

        console.log('   ✅ Bookings fetch successful');
        console.log('   Trainee:', bookingsResponse.data.data.trainee.email);
        console.log('   Total bookings:', bookingsResponse.data.data.summary.total_bookings);
        console.log('   Summary:', bookingsResponse.data.data.summary);
      }
    } catch (error) {
      console.error('   ❌ Error:', error.response?.data || error.message);
    }

    // Test 3: Test with debug mode
    console.log('\n3. Testing Debug Mode (bypasses cache)');
    console.log('   Query: "John" with debug=true');

    try {
      const debugResponse = await axios.get(`${BASE_URL}/api/admin/trainees/search`, {
        params: { query: 'John', debug: true },
        headers
      });

      console.log('   ✅ Debug mode search successful');
      console.log('   Cached:', debugResponse.data.meta.cached);
      console.log('   Results found:', debugResponse.data.data.contacts.length);
    } catch (error) {
      console.error('   ❌ Error:', error.response?.data || error.message);
    }

    // Test 4: Test validation errors
    console.log('\n4. Testing Validation Errors');
    console.log('   Testing with invalid query (too short)');

    try {
      await axios.get(`${BASE_URL}/api/admin/trainees/search`, {
        params: { query: 'a' },
        headers
      });
      console.log('   ❌ Validation should have failed');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('   ✅ Validation error caught correctly');
        console.log('   Error:', error.response.data.error);
      } else {
        console.error('   ❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    console.log('\n' + '─'.repeat(50));
    console.log('✨ Testing complete!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEndpoints().catch(console.error);
}

module.exports = { testEndpoints };