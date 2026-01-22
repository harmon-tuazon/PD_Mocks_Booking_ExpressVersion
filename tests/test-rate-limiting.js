/**
 * Test HubSpot API Rate Limiting Improvements
 *
 * Validates:
 * 1. Sequential batch processing with 150ms delays
 * 2. Rate limit header monitoring and preemptive throttling
 * 3. Improved retry logic with 5000ms base delay
 * 4. Retry-After header support
 */

const HubSpotService = require('../user_root/api/_shared/hubspot');
const BatchService = require('../user_root/api/_shared/batch');

// Test configuration
const TEST_CONFIG = {
  BATCH_SIZE: 3,  // Small batches for controlled testing
  EXPECTED_DELAY: 150,  // Expected delay between batches (ms)
  RETRY_BASE_DELAY: 5000,  // Base retry delay (ms)
  TOLERANCE: 50  // Timing tolerance (ms)
};

// Mock HubSpot API responses
class MockHubSpotAPI {
  constructor() {
    this.callCount = 0;
    this.callTimestamps = [];
    this.simulateRateLimit = false;
    this.retryAfterValue = null;
  }

  reset() {
    this.callCount = 0;
    this.callTimestamps = [];
    this.simulateRateLimit = false;
    this.retryAfterValue = null;
  }

  async apiCall(method, endpoint, data, config = {}) {
    this.callCount++;
    this.callTimestamps.push(Date.now());

    // Simulate rate limit on specific calls
    if (this.simulateRateLimit && this.callCount === 2) {
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        data: { policyName: 'SECONDLY' },
        headers: this.retryAfterValue ? { 'retry-after': this.retryAfterValue } : {}
      };
      throw error;
    }

    // Simulate rate limit headers
    const headers = {
      'x-hubspot-ratelimit-secondly': '100',
      'x-hubspot-ratelimit-secondly-remaining': config.lowRemaining ? '3' : '50',
      'x-hubspot-ratelimit-daily': '1000000',
      'x-hubspot-ratelimit-daily-remaining': '999000'
    };

    return {
      headers,
      data: {
        results: data?.inputs?.map((input, idx) => ({
          id: input.id || `test-${idx}`,
          properties: { mock_type: 'Test' }
        })) || []
      }
    };
  }
}

// Test utilities
function measureDelay(timestamps, index) {
  if (index < 1) return 0;
  return timestamps[index] - timestamps[index - 1];
}

function isWithinTolerance(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

// Test Suite
async function runTests() {
  console.log('🧪 Starting Rate Limiting Tests\n');
  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Sequential Batch Processing with Delays
  console.log('📋 Test 1: Sequential Batch Processing with 150ms Delays');
  try {
    const mockAPI = new MockHubSpotAPI();
    const hubspot = new HubSpotService({
      apiCall: mockAPI.apiCall.bind(mockAPI)
    });
    const batch = new BatchService(hubspot);

    // Create test data (3 chunks = 3 API calls)
    const testIds = Array.from({ length: 250 }, (_, i) => `${i + 1}`);

    const startTime = Date.now();
    await batch.batchReadObjects('2-50158913', testIds, ['mock_type']);
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    const expectedChunks = Math.ceil(testIds.length / 100);
    const expectedMinTime = (expectedChunks - 1) * TEST_CONFIG.EXPECTED_DELAY;

    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    console.log(`   📦 Chunks processed: ${mockAPI.callCount}`);
    console.log(`   🎯 Expected min time: ${expectedMinTime}ms`);

    // Verify delays between chunks
    let delaysCorrect = true;
    for (let i = 1; i < mockAPI.callTimestamps.length; i++) {
      const delay = measureDelay(mockAPI.callTimestamps, i);
      console.log(`   ⏳ Delay between chunk ${i} and ${i+1}: ${delay}ms`);

      if (!isWithinTolerance(delay, TEST_CONFIG.EXPECTED_DELAY, TEST_CONFIG.TOLERANCE)) {
        delaysCorrect = false;
        console.log(`   ❌ Delay outside tolerance (expected ${TEST_CONFIG.EXPECTED_DELAY}±${TEST_CONFIG.TOLERANCE}ms)`);
      }
    }

    if (totalTime >= expectedMinTime && delaysCorrect && mockAPI.callCount === expectedChunks) {
      console.log('   ✅ PASSED: Sequential processing with correct delays\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED: Timing or chunk count incorrect\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}\n`);
    failedTests++;
  }

  // Test 2: Rate Limit Header Monitoring
  console.log('📋 Test 2: Rate Limit Header Monitoring and Preemptive Throttling');
  try {
    const mockAPI = new MockHubSpotAPI();
    const hubspot = new HubSpotService({
      apiCall: mockAPI.apiCall.bind(mockAPI)
    });

    // Capture console output
    const logs = [];
    const originalWarn = console.warn;
    const originalLog = console.log;
    console.warn = (msg) => logs.push(msg);
    console.log = (msg) => logs.push(msg);

    // Make API call with low remaining count
    await hubspot.apiCall('GET', '/test', {}, { lowRemaining: true });

    // Restore console
    console.warn = originalWarn;
    console.log = originalLog;

    // Check for warning logs
    const hasWarning = logs.some(log =>
      log.includes('⚠️ Approaching SECONDLY rate limit')
    );
    const hasThrottle = logs.some(log =>
      log.includes('🛑 Preemptive throttle')
    );

    console.log(`   📊 Captured ${logs.length} log messages`);
    console.log(`   ⚠️  Warning logged: ${hasWarning}`);
    console.log(`   🛑 Throttle logged: ${hasThrottle}`);

    if (hasWarning && hasThrottle) {
      console.log('   ✅ PASSED: Rate limit headers monitored correctly\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED: Expected warning and throttle logs not found\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}\n`);
    failedTests++;
  }

  // Test 3: Improved Retry Logic with 5000ms Base Delay
  console.log('📋 Test 3: Improved Retry Logic with 5000ms Base Delay');
  try {
    const mockAPI = new MockHubSpotAPI();
    mockAPI.simulateRateLimit = true;

    const hubspot = new HubSpotService({
      apiCall: mockAPI.apiCall.bind(mockAPI)
    });

    const startTime = Date.now();

    // This should trigger retry on second call
    try {
      await hubspot.apiCall('POST', '/test', {});
    } catch (error) {
      // Expected to fail after retries
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`   ⏱️  Total retry time: ${totalTime}ms`);
    console.log(`   🔁 API calls made: ${mockAPI.callCount}`);
    console.log(`   🎯 Expected min time: ${TEST_CONFIG.RETRY_BASE_DELAY}ms (first retry)`);

    // Should have at least base retry delay
    if (totalTime >= TEST_CONFIG.RETRY_BASE_DELAY) {
      console.log('   ✅ PASSED: Retry delay meets minimum 5000ms requirement\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED: Retry delay too short\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}\n`);
    failedTests++;
  }

  // Test 4: Retry-After Header Support
  console.log('📋 Test 4: Retry-After Header Support');
  try {
    const mockAPI = new MockHubSpotAPI();
    mockAPI.simulateRateLimit = true;
    mockAPI.retryAfterValue = '10';  // 10 seconds

    const hubspot = new HubSpotService({
      apiCall: mockAPI.apiCall.bind(mockAPI)
    });

    const startTime = Date.now();

    try {
      await hubspot.apiCall('POST', '/test', {});
    } catch (error) {
      // Expected to fail after retries
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const expectedDelay = 10000;  // 10 seconds from Retry-After header

    console.log(`   ⏱️  Total retry time: ${totalTime}ms`);
    console.log(`   📨 Retry-After header: ${mockAPI.retryAfterValue}s`);
    console.log(`   🎯 Expected delay: ${expectedDelay}ms`);

    // Should respect Retry-After header
    if (totalTime >= expectedDelay - TEST_CONFIG.TOLERANCE) {
      console.log('   ✅ PASSED: Retry-After header respected\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED: Retry-After header not respected\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}\n`);
    failedTests++;
  }

  // Test Summary
  console.log('═══════════════════════════════════════');
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('═══════════════════════════════════════\n');

  if (failedTests === 0) {
    console.log('✅ All rate limiting improvements verified successfully!');
    console.log('\nExpected Production Behavior:');
    console.log('  • 150ms delays between batch chunks');
    console.log('  • Warnings when <10 SECONDLY requests remaining');
    console.log('  • Preemptive throttle when <5 SECONDLY requests remaining');
    console.log('  • 5s → 10s → 20s retry progression (or Retry-After based)');
    console.log('  • ~90% reduction in 429 errors');
    console.log('  • Request rate: ~5-7 requests/second\n');
    return 0;
  } else {
    console.log('❌ Some tests failed. Please review implementation.');
    return 1;
  }
}

// Run tests
if (require.main === module) {
  runTests()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('💥 Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
