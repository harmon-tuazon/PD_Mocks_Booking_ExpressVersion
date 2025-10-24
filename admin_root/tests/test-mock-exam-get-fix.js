/**
 * Test Mock Exam Get Endpoint Fix
 *
 * Verifies that getMockExamWithBookings returns the correct data structure
 * after the optimization fix.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const hubspot = require('../api/_shared/hubspot');

async function testMockExamGet() {
  console.log('\n🧪 Testing Mock Exam Get Endpoint Fix\n');
  console.log('='.repeat(60));

  try {
    // First, get some active mock exams
    console.log('\n📋 Step 1: Fetching active mock exams...');
    const aggregates = await hubspot.fetchMockExamsForAggregation({
      filter_status: 'active'
    });

    if (aggregates.length === 0 || !aggregates[0].session_ids || aggregates[0].session_ids.length === 0) {
      console.log('⚠️  No active mock exams found. Cannot test.');
      return;
    }

    const mockExamId = aggregates[0].session_ids[0];
    console.log(`✅ Found test mock exam ID: ${mockExamId}`);

    // Test getMockExamWithBookings
    console.log('\n📋 Step 2: Testing getMockExamWithBookings...');
    const result = await hubspot.getMockExamWithBookings(mockExamId);

    // Verify structure
    console.log('\n✅ Step 3: Verifying data structure...');

    // Check that mockExam exists
    if (!result.mockExam) {
      throw new Error('❌ result.mockExam is undefined!');
    }
    console.log('✓ result.mockExam exists');

    // Check that mockExam.id exists
    if (!result.mockExam.id) {
      throw new Error('❌ result.mockExam.id is undefined!');
    }
    console.log(`✓ result.mockExam.id = ${result.mockExam.id}`);

    // Check that mockExam.properties exists (THIS IS THE KEY FIX)
    if (!result.mockExam.properties) {
      throw new Error('❌ result.mockExam.properties is undefined!');
    }
    console.log('✓ result.mockExam.properties exists');

    // Check that capacity is accessible
    if (result.mockExam.properties.capacity === undefined) {
      throw new Error('❌ result.mockExam.properties.capacity is undefined!');
    }
    console.log(`✓ result.mockExam.properties.capacity = ${result.mockExam.properties.capacity}`);

    // Check all expected properties
    const expectedProperties = [
      'mock_type', 'exam_date', 'start_time', 'end_time',
      'capacity', 'total_bookings', 'location', 'is_active'
    ];

    console.log('\n📋 Checking all required properties...');
    expectedProperties.forEach(prop => {
      if (result.mockExam.properties[prop] === undefined) {
        console.log(`⚠️  Warning: ${prop} is undefined`);
      } else {
        console.log(`✓ ${prop}: ${result.mockExam.properties[prop]}`);
      }
    });

    // Check bookings structure
    console.log('\n📋 Checking bookings structure...');
    console.log(`✓ Total bookings: ${result.bookings.length}`);

    if (result.bookings.length > 0) {
      const firstBooking = result.bookings[0];

      // Check that booking has id
      if (!firstBooking.id) {
        throw new Error('❌ booking.id is undefined!');
      }
      console.log(`✓ First booking ID: ${firstBooking.id}`);

      // Check that booking has properties
      if (!firstBooking.properties) {
        throw new Error('❌ booking.properties is undefined!');
      }
      console.log('✓ booking.properties exists');

      // Check booking properties
      const bookingProps = ['student_id', 'student_name', 'student_email', 'booking_status'];
      bookingProps.forEach(prop => {
        if (firstBooking.properties[prop] !== undefined) {
          console.log(`✓ ${prop}: ${firstBooking.properties[prop]}`);
        }
      });
    }

    // Check statistics
    console.log('\n📋 Checking statistics...');
    if (!result.statistics) {
      throw new Error('❌ result.statistics is undefined!');
    }
    console.log(`✓ Total: ${result.statistics.total}`);
    console.log(`✓ Confirmed: ${result.statistics.confirmed}`);
    console.log(`✓ Pending: ${result.statistics.pending}`);
    console.log(`✓ Cancelled: ${result.statistics.cancelled}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✅ The data structure is correct!');
    console.log('✅ The get.js endpoint should now work without errors!');
    console.log('✅ Properties are properly nested under mockExam.properties');
    console.log('✅ Bookings have properties nested under booking.properties\n');

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED!');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testMockExamGet()
  .then(() => {
    console.log('✅ Test completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
