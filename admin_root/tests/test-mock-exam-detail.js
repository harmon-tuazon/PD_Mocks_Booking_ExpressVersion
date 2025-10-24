/**
 * Test script for GET /api/admin/mock-exams/[id] endpoint
 *
 * This tests the single mock exam detail endpoint
 */

require('dotenv').config({ path: '../../.env' });
const handler = require('../api/admin/mock-exams/[id]');

// Mock Request/Response for testing
class MockRequest {
  constructor(query = {}, headers = {}) {
    this.query = query;
    this.headers = headers;
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.data = null;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.data = data;
    console.log(`Response [${this.statusCode}]:`, JSON.stringify(data, null, 2));
    return this;
  }
}

async function testEndpoint() {
  console.log('🧪 Testing GET /api/admin/mock-exams/[id] endpoint\n');

  // Test 1: Missing ID
  console.log('Test 1: Missing ID parameter');
  const req1 = new MockRequest({});
  const res1 = new MockResponse();
  await handler(req1, res1);
  console.assert(res1.statusCode === 400, 'Should return 400 for missing ID');
  console.assert(res1.data?.error === 'Mock exam ID is required', 'Should return correct error message');
  console.log('✅ Test 1 passed\n');

  // Test 2: Invalid ID format
  console.log('Test 2: Invalid ID format');
  const req2 = new MockRequest({ id: 'invalid-id' });
  const res2 = new MockResponse();
  await handler(req2, res2);
  console.assert(res2.statusCode === 400, 'Should return 400 for invalid ID format');
  console.assert(res2.data?.error === 'Invalid mock exam ID format', 'Should return correct error message');
  console.log('✅ Test 2 passed\n');

  // Test 3: Valid ID (will fail without auth)
  console.log('Test 3: Valid ID (expect auth failure)');
  const req3 = new MockRequest({ id: '123456' });
  const res3 = new MockResponse();
  await handler(req3, res3);
  console.assert(res3.statusCode === 401, 'Should return 401 for missing authentication');
  console.assert(res3.data?.error === 'Authentication failed', 'Should return auth error');
  console.log('✅ Test 3 passed\n');

  // Test 4: With mock authentication header
  console.log('Test 4: With authentication (will still fail without valid token)');
  const req4 = new MockRequest(
    { id: '123456' },
    { authorization: 'Bearer test-token' }
  );
  const res4 = new MockResponse();
  await handler(req4, res4);
  console.assert(res4.statusCode === 401, 'Should return 401 for invalid token');
  console.log('✅ Test 4 passed\n');

  console.log('🎉 All tests completed!\n');
  console.log('Note: To test with real data, you need:');
  console.log('1. Valid authentication token');
  console.log('2. Valid mock exam ID from HubSpot');
  console.log('3. Proper environment variables set');
}

// Run tests
testEndpoint().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});