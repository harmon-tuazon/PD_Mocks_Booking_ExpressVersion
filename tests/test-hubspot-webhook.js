/**
 * Test Script: Send webhook to HubSpot to update total_bookings
 *
 * This tests triggering a HubSpot workflow via webhook to sync Redis counter to HubSpot
 */

require('dotenv').config();

const WEBHOOK_URL = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/AIvBwN0';

async function testHubSpotWebhook() {
  console.log('🚀 Testing HubSpot Webhook for total_bookings sync...\n');

  // Test data - you can change these values
  const testData = {
    mock_exam_id: '40577087837',  // Replace with actual exam ID
    total_bookings: 8,             // Replace with actual count from Redis
  };

  console.log('📤 Sending webhook with payload:');
  console.log(JSON.stringify(testData, null, 2));
  console.log(`\n🔗 Webhook URL: ${WEBHOOK_URL}\n`);

  try {
    const startTime = Date.now();

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const duration = Date.now() - startTime;
    const responseData = await response.text();
    let parsedData;

    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    console.log('✅ Webhook sent successfully!');
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log('\n📥 Response:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Data:', typeof parsedData === 'object' ? JSON.stringify(parsedData, null, 2) : parsedData);

    return { success: true, response: parsedData };

  } catch (error) {
    console.error('❌ Webhook failed!');
    console.error('Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test with Redis value (optional enhancement)
async function testWithRedisValue() {
  console.log('🔍 Testing with actual Redis value...\n');

  try {
    const RedisLockService = require('../user_root/api/_shared/redis');
    const redis = new RedisLockService();

    // Get actual Redis counter
    const examId = '40577087837'; // Replace with actual exam ID
    const redisCount = await redis.get(`exam:${examId}:bookings`);

    console.log(`📊 Redis counter for exam ${examId}: ${redisCount}`);

    if (redisCount === null) {
      console.warn('⚠️  No Redis counter found for this exam');
      await redis.close();
      return;
    }

    // Send webhook with actual Redis value
    const payload = {
      mock_exam_id: examId,
      total_bookings: parseInt(redisCount),
    };

    console.log('\n📤 Sending webhook with Redis value:');
    console.log(JSON.stringify(payload, null, 2));

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.text();
    let parsedData;

    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    console.log('\n✅ Webhook sent successfully!');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Data:', typeof parsedData === 'object' ? JSON.stringify(parsedData, null, 2) : parsedData);

    await redis.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  HubSpot Webhook Test: total_bookings Sync                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Uncomment the test you want to run:

  // Test 1: Simple test with hardcoded values
  await testHubSpotWebhook();

  // Test 2: Test with actual Redis value (requires Redis connection)
  // await testWithRedisValue();

  console.log('\n✨ Test completed!');
})();
