/**
 * Verify HubSpot webhook updated the total_bookings property
 */

require('dotenv').config({ path: '../user_root/.env' });
const { HubSpotService } = require('../user_root/api/_shared/hubspot');
const RedisLockService = require('../user_root/api/_shared/redis');

async function verifyUpdate() {
  console.log('🔍 Verifying HubSpot webhook update...\n');

  const examId = '40577087837';

  try {
    const hubspot = new HubSpotService();
    const redis = new RedisLockService();

    // Get Redis value
    const redisCount = await redis.get(`exam:${examId}:bookings`);
    console.log(`📊 Redis counter: ${redisCount}`);

    // Get HubSpot value
    const exam = await hubspot.getMockExam(examId);
    const hubspotCount = exam.properties.total_bookings;
    console.log(`📊 HubSpot total_bookings: ${hubspotCount}`);

    // Compare
    console.log('\n📈 Comparison:');
    if (redisCount === hubspotCount) {
      console.log('✅ Values match! Webhook sync successful!');
    } else {
      console.log(`⚠️  Values differ:`);
      console.log(`   Redis: ${redisCount}`);
      console.log(`   HubSpot: ${hubspotCount}`);
      console.log(`   Drift: ${parseInt(redisCount || 0) - parseInt(hubspotCount || 0)}`);
    }

    // Show exam details
    console.log('\n📋 Mock Exam Details:');
    console.log(`   ID: ${exam.id}`);
    console.log(`   Type: ${exam.properties.mock_type}`);
    console.log(`   Date: ${exam.properties.exam_date}`);
    console.log(`   Capacity: ${exam.properties.capacity}`);
    console.log(`   Total Bookings: ${exam.properties.total_bookings}`);

    await redis.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyUpdate();
