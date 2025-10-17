/**
 * Integration Test: Booking Race Condition Prevention
 *
 * Tests that the Redis locking mechanism correctly prevents overbooking
 * when multiple concurrent requests attempt to book the last available slot.
 *
 * Critical Success Criteria:
 * - 50 concurrent requests for 1 available slot
 * - Exactly 1 booking should be created
 * - 49 requests should receive "EXAM_FULL" error
 * - HubSpot final state: total_bookings = 1 (not 2, 3, or 50!)
 *
 * @see PRDs/booking-race-condition-redis-locking.md
 */

// Load environment variables from .env.development.local
require('dotenv').config({ path: '.env.development.local' });

const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');
const handler = require('../../api/bookings/create');

// Helper to create mock request/response objects
function createMockReqRes(body) {
  const req = {
    method: 'POST',
    body,
    headers: {}
  };

  const res = {
    statusCode: null,
    headers: {},
    responseData: null,
    setHeader: function(key, value) {
      this.headers[key] = value;
    },
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.responseData = data;
      return this;
    }
  };

  return { req, res };
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Booking Race Condition Prevention', () => {
  let hubspot;
  let testMockExamId;
  let testContactIds = [];

  beforeAll(async () => {
    hubspot = new HubSpotService();
  });

  beforeEach(async () => {
    // Create a test mock exam with capacity=1, total_bookings=0
    const examData = {
      name: `Race Test Exam ${Date.now()}`,
      exam_date: '2025-12-31',
      capacity: '1', // Only 1 slot available
      total_bookings: '0',
      is_active: 'true',
      mock_type: 'Situational Judgment',
      location: 'Test Location'
    };

    const mockExam = await hubspot.apiCall('POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}`,
      { properties: examData }
    );

    testMockExamId = mockExam.id;
    console.log(`✅ Created test mock exam: ${testMockExamId} with capacity=1`);

    // Create 50 test contacts with credits
    testContactIds = [];
    for (let i = 0; i < 50; i++) {
      const contactData = {
        email: `race-test-${Date.now()}-${i}@example.com`,
        firstname: `RaceTest${i}`,
        lastname: 'User',
        student_id: `RACE-${Date.now()}-${i}`,
        sj_credits: '1',
        shared_mock_credits: '1'
      };

      const contact = await hubspot.apiCall('POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}`,
        { properties: contactData }
      );

      testContactIds.push(contact.id);
    }

    console.log(`✅ Created ${testContactIds.length} test contacts with credits`);

    // Small delay to ensure data is indexed
    await sleep(1000);
  });

  afterEach(async () => {
    // Clean up: Delete test mock exam and contacts
    try {
      if (testMockExamId) {
        await hubspot.apiCall('DELETE',
          `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${testMockExamId}`
        );
        console.log(`✅ Cleaned up test mock exam: ${testMockExamId}`);
      }

      // Delete all test contacts
      for (const contactId of testContactIds) {
        try {
          await hubspot.apiCall('DELETE',
            `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}`
          );
        } catch (err) {
          console.warn(`⚠️ Failed to delete test contact ${contactId}:`, err.message);
        }
      }

      console.log(`✅ Cleaned up ${testContactIds.length} test contacts`);

    } catch (err) {
      console.error('❌ Cleanup error:', err.message);
    }
  });

  test('should prevent overbooking under 50 concurrent requests for 1 slot', async () => {
    console.log('\n========================================');
    console.log('🧪 RACE CONDITION TEST START');
    console.log('========================================');
    console.log(`Mock Exam: ${testMockExamId}`);
    console.log(`Capacity: 1`);
    console.log(`Concurrent Requests: 50`);
    console.log(`Expected: 1 booking, 49 rejections`);
    console.log('========================================\n');

    // Create 50 concurrent booking requests
    const bookingPromises = testContactIds.map((contactId, index) => {
      const { req, res } = createMockReqRes({
        contact_id: contactId,
        mock_exam_id: testMockExamId,
        student_id: `RACE-${Date.now()}-${index}`,
        name: `RaceTest${index} User`,
        email: `race-test-${Date.now()}-${index}@example.com`,
        exam_date: '2025-12-31',
        mock_type: 'Situational Judgment',
        attending_location: 'Test Location'
      });

      return handler(req, res)
        .then(() => res)
        .catch(err => {
          console.error(`Request ${index} error:`, err.message);
          return res;
        });
    });

    // Execute all requests concurrently
    console.log('🚀 Launching 50 concurrent booking requests...\n');
    const startTime = Date.now();
    const results = await Promise.all(bookingPromises);
    const duration = Date.now() - startTime;

    console.log(`⏱️  All requests completed in ${duration}ms\n`);

    // Analyze results
    const successResults = results.filter(r => r.statusCode === 201);
    const fullErrors = results.filter(r =>
      r.statusCode === 400 &&
      r.responseData?.error?.code === 'EXAM_FULL'
    );
    const lockErrors = results.filter(r =>
      r.statusCode === 503 &&
      r.responseData?.error?.code === 'LOCK_ACQUISITION_FAILED'
    );
    const otherErrors = results.filter(r =>
      r.statusCode !== 201 &&
      r.responseData?.error?.code !== 'EXAM_FULL' &&
      r.responseData?.error?.code !== 'LOCK_ACQUISITION_FAILED'
    );

    console.log('========================================');
    console.log('📊 RESULTS SUMMARY');
    console.log('========================================');
    console.log(`✅ Successful Bookings: ${successResults.length}`);
    console.log(`❌ Exam Full Errors: ${fullErrors.length}`);
    console.log(`⏳ Lock Acquisition Failures: ${lockErrors.length}`);
    console.log(`⚠️  Other Errors: ${otherErrors.length}`);
    console.log('========================================\n');

    // Log other errors for debugging
    if (otherErrors.length > 0) {
      console.log('⚠️  Other Errors Details:');
      otherErrors.forEach((r, i) => {
        console.log(`  Error ${i + 1}:`, {
          status: r.statusCode,
          code: r.responseData?.error?.code,
          message: r.responseData?.error?.message
        });
      });
      console.log();
    }

    // CRITICAL ASSERTION 1: Exactly 1 booking created
    expect(successResults.length).toBe(1);
    console.log('✅ PASS: Exactly 1 booking created\n');

    // CRITICAL ASSERTION 2: 49 requests rejected (full + lock failures)
    const totalRejections = fullErrors.length + lockErrors.length;
    expect(totalRejections).toBe(49);
    console.log('✅ PASS: 49 requests rejected\n');

    // Verify HubSpot state
    console.log('🔍 Verifying HubSpot state...');
    await sleep(2000); // Allow time for HubSpot to update

    const finalExam = await hubspot.getMockExam(testMockExamId);
    const finalTotalBookings = parseInt(finalExam.properties.total_bookings) || 0;

    console.log(`📊 Final HubSpot State:`);
    console.log(`   Capacity: ${finalExam.properties.capacity}`);
    console.log(`   Total Bookings: ${finalTotalBookings}`);
    console.log();

    // CRITICAL ASSERTION 3: HubSpot counter is correct (not overbookable)
    expect(finalTotalBookings).toBe(1);
    console.log('✅ PASS: HubSpot counter correct (total_bookings=1)\n');

    // CRITICAL ASSERTION 4: No overbooking occurred
    expect(finalTotalBookings).toBeLessThanOrEqual(parseInt(finalExam.properties.capacity));
    console.log('✅ PASS: No overbooking (bookings <= capacity)\n');

    console.log('========================================');
    console.log('🎉 ALL ASSERTIONS PASSED');
    console.log('========================================');
    console.log('✅ Race condition successfully prevented!');
    console.log('✅ Redis locking working correctly');
    console.log('========================================\n');

  }, 60000); // 60 second timeout for this test

  test('should handle sequential bookings correctly', async () => {
    console.log('\n========================================');
    console.log('🧪 SEQUENTIAL BOOKING TEST');
    console.log('========================================\n');

    // First booking (should succeed)
    const { req: req1, res: res1 } = createMockReqRes({
      contact_id: testContactIds[0],
      mock_exam_id: testMockExamId,
      student_id: `SEQ-${Date.now()}-1`,
      name: 'Sequential User 1',
      email: `seq-test-${Date.now()}-1@example.com`,
      exam_date: '2025-12-31',
      mock_type: 'Situational Judgment',
      attending_location: 'Test Location'
    });

    await handler(req1, res1);
    expect(res1.statusCode).toBe(201);
    console.log('✅ First booking successful\n');

    // Second booking (should fail - exam full)
    const { req: req2, res: res2 } = createMockReqRes({
      contact_id: testContactIds[1],
      mock_exam_id: testMockExamId,
      student_id: `SEQ-${Date.now()}-2`,
      name: 'Sequential User 2',
      email: `seq-test-${Date.now()}-2@example.com`,
      exam_date: '2025-12-31',
      mock_type: 'Situational Judgment',
      attending_location: 'Test Location'
    });

    await handler(req2, res2);
    expect(res2.statusCode).toBe(400);
    expect(res2.responseData.error.code).toBe('EXAM_FULL');
    console.log('✅ Second booking correctly rejected (EXAM_FULL)\n');

    console.log('========================================');
    console.log('✅ SEQUENTIAL TEST PASSED');
    console.log('========================================\n');

  }, 30000);

  test('should release lock on booking failure', async () => {
    console.log('\n========================================');
    console.log('🧪 LOCK RELEASE ON FAILURE TEST');
    console.log('========================================\n');

    // Create a request that will fail (insufficient credits)
    const testContact = await hubspot.apiCall('POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}`,
      {
        properties: {
          email: `lock-test-${Date.now()}@example.com`,
          firstname: 'LockTest',
          lastname: 'User',
          student_id: `LOCK-${Date.now()}`,
          sj_credits: '0', // No credits - will fail
          shared_mock_credits: '0'
        }
      }
    );

    testContactIds.push(testContact.id); // For cleanup

    const { req, res } = createMockReqRes({
      contact_id: testContact.id,
      mock_exam_id: testMockExamId,
      student_id: `LOCK-${Date.now()}`,
      name: 'LockTest User',
      email: `lock-test-${Date.now()}@example.com`,
      exam_date: '2025-12-31',
      mock_type: 'Situational Judgment',
      attending_location: 'Test Location'
    });

    // This request should fail due to insufficient credits
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.responseData.error.code).toBe('INSUFFICIENT_CREDITS');
    console.log('✅ Request failed as expected (INSUFFICIENT_CREDITS)\n');

    // Wait a bit to ensure lock is released
    await sleep(500);

    // Try another booking (should succeed if lock was released)
    const { req: req2, res: res2 } = createMockReqRes({
      contact_id: testContactIds[0],
      mock_exam_id: testMockExamId,
      student_id: `LOCK-${Date.now()}-2`,
      name: 'Valid User',
      email: `lock-test-valid-${Date.now()}@example.com`,
      exam_date: '2025-12-31',
      mock_type: 'Situational Judgment',
      attending_location: 'Test Location'
    });

    await handler(req2, res2);
    expect(res2.statusCode).toBe(201);
    console.log('✅ Second request succeeded (lock was released)\n');

    console.log('========================================');
    console.log('✅ LOCK RELEASE TEST PASSED');
    console.log('========================================\n');

  }, 30000);
});
