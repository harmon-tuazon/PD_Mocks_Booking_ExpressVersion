/**
 * TEST FILE: Test Scheduled Activation Logic
 *
 * This file tests the scheduled activation feature for mock exams.
 * It should be run manually to verify the implementation works correctly.
 *
 * Usage:
 *   node admin_root/api/admin/mock-exams/test-scheduled-activation.js
 */

require('dotenv').config();
const { HubSpotService } = require('../../_shared/hubspot');
const { activateScheduledSessions, findOverdueSessions } = require('../../_shared/scheduledActivation');

async function testScheduledActivation() {
  console.log('🧪 Testing Scheduled Activation Feature\n');
  console.log('=' . repeat(50));

  try {
    // Test 1: Check if we can find overdue sessions
    console.log('\n📊 Test 1: Finding overdue sessions for activation...');
    const overdueSessions = await findOverdueSessions();
    console.log(`Found ${overdueSessions.length} overdue session(s)`);

    if (overdueSessions.length > 0) {
      console.log('\nOverdue sessions:');
      overdueSessions.forEach(session => {
        const props = session.properties;
        console.log(`  - ID: ${session.id}`);
        console.log(`    Type: ${props.mock_type}`);
        console.log(`    Date: ${props.exam_date}`);
        console.log(`    Location: ${props.location}`);
        console.log(`    Is Active: ${props.is_active}`);
        console.log(`    Scheduled: ${new Date(parseInt(props.scheduled_activation_datetime)).toISOString()}`);
        console.log('');
      });
    }

    // Test 2: Test creating a mock exam with scheduled activation
    console.log('\n📊 Test 2: Creating test mock exam with scheduled activation...');
    const hubspot = new HubSpotService();

    // Schedule for 5 seconds from now (for testing)
    const scheduledTime = new Date(Date.now() + 5000); // 5 seconds from now

    const testExam = {
      mock_type: 'Situational Judgment',
      exam_date: '2025-01-20',
      start_time: '09:00',
      end_time: '12:00',
      location: 'Mississauga',
      capacity: 20,
      is_active: false,
      scheduled_activation_datetime: scheduledTime.toISOString()
    };

    console.log('Creating test exam scheduled for:', scheduledTime.toISOString());
    const created = await hubspot.createMockExam(testExam);
    console.log('✅ Test exam created with ID:', created.id);

    // Wait 6 seconds for it to become overdue
    console.log('\n⏳ Waiting 6 seconds for exam to become overdue...');
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Test 3: Run activation
    console.log('\n📊 Test 3: Running scheduled activation...');
    const activationResult = await activateScheduledSessions();
    console.log('Activation result:', activationResult);

    // Test 4: Verify the exam is now active
    console.log('\n📊 Test 4: Verifying exam is now active...');
    const examDetails = await hubspot.getMockExamDetails(created.id);
    console.log('Exam is_active status:', examDetails.properties.is_active);

    if (examDetails.properties.is_active === 'true' || examDetails.properties.is_active === true) {
      console.log('✅ SUCCESS: Exam was successfully activated!');
    } else {
      console.log('❌ FAILED: Exam was not activated');
    }

    // Clean up - delete test exam
    console.log('\n🧹 Cleaning up test data...');
    await hubspot.deleteMockExam(created.id);
    console.log('✅ Test exam deleted');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run tests if executed directly
if (require.main === module) {
  testScheduledActivation()
    .then(() => {
      console.log('\n✅ All tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testScheduledActivation };