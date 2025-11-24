/**
 * Load Testing Script for Credit Validation Endpoint
 *
 * Purpose: Reproduce 429 rate limit errors by making multiple concurrent requests
 *
 * Usage:
 *   node tests/load-test-credits.js [num_requests] [concurrent_batches]
 *
 * Examples:
 *   node tests/load-test-credits.js 20 5    # 20 requests in 5 concurrent batches
 *   node tests/load-test-credits.js 50 10   # 50 requests in 10 concurrent batches (stress test)
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://pd-mocks-booking.vercel.app';
const NUM_REQUESTS = parseInt(process.argv[2]) || 20;
const CONCURRENT_BATCHES = parseInt(process.argv[3]) || 5;
const REQUESTS_PER_BATCH = Math.ceil(NUM_REQUESTS / CONCURRENT_BATCHES);

// Test data (use valid test credentials)
const TEST_STUDENT_ID = process.env.TEST_STUDENT_ID || 'STU123456';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const MOCK_TYPES = ['Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion'];

/**
 * Make a single credit validation request
 */
async function makeCreditValidationRequest(requestNum, mockType) {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/mock-exams/validate-credits`,
      {
        student_id: TEST_STUDENT_ID,
        email: TEST_EMAIL,
        mock_type: mockType
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const duration = Date.now() - startTime;

    return {
      requestNum,
      mockType,
      success: true,
      status: response.status,
      duration,
      eligible: response.data?.data?.eligible,
      available_credits: response.data?.data?.available_credits,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      requestNum,
      mockType,
      success: false,
      status: error.response?.status || 'TIMEOUT',
      duration,
      eligible: null,
      available_credits: null,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Run load test with concurrent batches
 */
async function runLoadTest() {
  console.log('🚀 Credit Validation Load Test');
  console.log('=' .repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Total Requests: ${NUM_REQUESTS}`);
  console.log(`Concurrent Batches: ${CONCURRENT_BATCHES}`);
  console.log(`Requests per Batch: ${REQUESTS_PER_BATCH}`);
  console.log('=' .repeat(60));
  console.log('');

  const allResults = [];
  const startTime = Date.now();

  // Create batches of concurrent requests
  for (let batchNum = 0; batchNum < CONCURRENT_BATCHES; batchNum++) {
    console.log(`\n📦 Batch ${batchNum + 1}/${CONCURRENT_BATCHES} - Sending ${REQUESTS_PER_BATCH} concurrent requests...`);

    const batchPromises = [];

    for (let i = 0; i < REQUESTS_PER_BATCH; i++) {
      const requestNum = batchNum * REQUESTS_PER_BATCH + i + 1;
      if (requestNum > NUM_REQUESTS) break;

      const mockType = MOCK_TYPES[requestNum % MOCK_TYPES.length];
      batchPromises.push(makeCreditValidationRequest(requestNum, mockType));
    }

    // Execute batch concurrently
    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);

    // Log batch results
    const batchErrors = batchResults.filter(r => !r.success);
    const batch429Errors = batchErrors.filter(r => r.status === 429);

    if (batch429Errors.length > 0) {
      console.log(`   ⚠️ ${batch429Errors.length} requests hit 429 rate limit`);
    }

    if (batchErrors.length > 0 && batchErrors.length !== batch429Errors.length) {
      console.log(`   ❌ ${batchErrors.length - batch429Errors.length} other errors`);
    }

    if (batchErrors.length === 0) {
      console.log(`   ✅ All ${batchResults.length} requests successful`);
    }

    // Small delay between batches to avoid overwhelming the system
    if (batchNum < CONCURRENT_BATCHES - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary report
  console.log('\n\n' + '=' .repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('=' .repeat(60));

  const successfulRequests = allResults.filter(r => r.success);
  const failedRequests = allResults.filter(r => !r.success);
  const error429Requests = failedRequests.filter(r => r.status === 429);
  const otherErrors = failedRequests.filter(r => r.status !== 429);

  console.log(`\n✅ Successful Requests: ${successfulRequests.length}/${NUM_REQUESTS} (${((successfulRequests.length / NUM_REQUESTS) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed Requests: ${failedRequests.length}/${NUM_REQUESTS} (${((failedRequests.length / NUM_REQUESTS) * 100).toFixed(1)}%)`);

  if (error429Requests.length > 0) {
    console.log(`   🚫 Rate Limit (429) Errors: ${error429Requests.length}`);
  }

  if (otherErrors.length > 0) {
    console.log(`   ⚠️ Other Errors: ${otherErrors.length}`);
  }

  console.log(`\n⏱️ Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`📈 Requests/Second: ${(NUM_REQUESTS / (totalDuration / 1000)).toFixed(2)}`);

  if (successfulRequests.length > 0) {
    const avgDuration = successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length;
    const minDuration = Math.min(...successfulRequests.map(r => r.duration));
    const maxDuration = Math.max(...successfulRequests.map(r => r.duration));

    console.log(`\n⏱️ Response Times (successful requests):`);
    console.log(`   Average: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Min: ${minDuration}ms`);
    console.log(`   Max: ${maxDuration}ms`);
  }

  // Show 429 error details
  if (error429Requests.length > 0) {
    console.log(`\n🚫 Rate Limit Errors (429) Details:`);
    error429Requests.forEach(r => {
      console.log(`   Request #${r.requestNum} (${r.mockType}): ${r.error || 'Rate limited'}`);
    });
  }

  // Show insufficient credits errors (if any)
  const insufficientCreditsRequests = successfulRequests.filter(r => !r.eligible);
  if (insufficientCreditsRequests.length > 0) {
    console.log(`\n⚠️ Insufficient Credits Results: ${insufficientCreditsRequests.length}`);
    console.log(`   This indicates requests succeeded but returned 0 credits.`);
    console.log(`   Check logs with [CREDITS] prefix for diagnostic info.`);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('✅ Load test complete!\n');

  // Exit with error code if there were 429 errors
  if (error429Requests.length > 0) {
    console.log('⚠️ Test detected 429 errors - request queue may need tuning');
    process.exit(1);
  } else {
    console.log('✅ No rate limit errors detected - request queue is working!');
    process.exit(0);
  }
}

// Run the load test
runLoadTest().catch(error => {
  console.error('\n❌ Load test failed:', error.message);
  process.exit(1);
});
