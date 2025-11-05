/**
 * Test Script: Verify booking count fix
 *
 * This script tests the fix for booking counts showing 0.
 * It calls listMockExams and verifies that booking counts are now accurate.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

async function testBookingCountFix() {
  console.log('\n🧪 TESTING BOOKING COUNT FIX\n');
  console.log('='.repeat(70));

  try {
    // Test listMockExams with the fix
    console.log('\n📋 Test 1: listMockExams() method');
    console.log('-'.repeat(70));

    const result = await hubspot.listMockExams({
      page: 1,
      limit: 10,
      filter_has_bookings: true // Only get exams with bookings
    });

    console.log(`   Total exams found: ${result.pagination?.total || 0}`);
    console.log(`   Exams returned: ${result.results?.length || 0}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📊 BOOKING COUNTS:');
      console.log('   ' + '-'.repeat(66));
      console.log(`   ${'Exam Type'.padEnd(15)} | ${'Date'.padEnd(12)} | ${'Bookings'.padEnd(10)} | ${'Status'.padEnd(15)}`);
      console.log('   ' + '-'.repeat(66));

      let totalWithBookings = 0;
      let totalWithZero = 0;

      for (const exam of result.results) {
        const bookingCount = parseInt(exam.properties.total_bookings || '0');
        const mockType = exam.properties.mock_type || 'N/A';
        const examDate = exam.properties.exam_date || 'N/A';
        const status = bookingCount > 0 ? '✅ HAS BOOKINGS' : '❌ ZERO';

        console.log(`   ${mockType.padEnd(15)} | ${examDate.padEnd(12)} | ${String(bookingCount).padEnd(10)} | ${status.padEnd(15)}`);

        if (bookingCount > 0) {
          totalWithBookings++;
        } else {
          totalWithZero++;
        }
      }

      console.log('   ' + '-'.repeat(66));
      console.log(`\n   Summary:`);
      console.log(`   - Exams with bookings > 0: ${totalWithBookings}`);
      console.log(`   - Exams with bookings = 0: ${totalWithZero}`);

      if (totalWithBookings === 0) {
        console.log('\n   ❌ FAIL: All exams show 0 bookings! The fix did NOT work.');
      } else if (totalWithZero > 0) {
        console.log('\n   ⚠️ PARTIAL: Some exams still show 0 bookings. Needs investigation.');
      } else {
        console.log('\n   ✅ SUCCESS: All filtered exams have booking counts > 0!');
      }
    } else {
      console.log('\n   ⚠️ No exams with bookings found (filter might be too restrictive)');

      // Try without filter
      console.log('\n   Trying without filter...');
      const unfiltered = await hubspot.listMockExams({
        page: 1,
        limit: 5
      });

      if (unfiltered.results && unfiltered.results.length > 0) {
        console.log(`   Found ${unfiltered.results.length} exams (unfiltered):`);
        for (const exam of unfiltered.results) {
          console.log(`   - ${exam.properties.mock_type || 'N/A'}: ${exam.properties.total_bookings || '0'} bookings`);
        }
      }
    }

    // Test 2: Get a specific exam with known bookings
    console.log('\n\n📋 Test 2: Direct mock exam lookup');
    console.log('-'.repeat(70));

    // Find an exam with bookings from the previous result
    if (result.results && result.results.length > 0) {
      const examWithBookings = result.results[0];
      console.log(`   Testing exam: ${examWithBookings.id}`);
      console.log(`   Stored total_bookings: ${examWithBookings.properties.total_bookings}`);

      // Get detailed booking info
      const examDetails = await hubspot.getMockExamById(examWithBookings.id);

      console.log(`\n   Detailed results:`);
      console.log(`   - Mock Exam ID: ${examDetails.mockExam?.id || 'N/A'}`);
      console.log(`   - Total Bookings: ${examDetails.mockExam?.total_bookings || '0'}`);
      console.log(`   - Actual Bookings Retrieved: ${examDetails.bookings?.length || 0}`);

      if (examDetails.bookings && examDetails.bookings.length > 0) {
        console.log(`\n   📝 Booking Details:`);
        examDetails.bookings.slice(0, 3).forEach((booking, idx) => {
          console.log(`   ${idx + 1}. Student: ${booking.student_id || 'N/A'}, Status: ${booking.is_active || 'N/A'}`);
        });
        if (examDetails.bookings.length > 3) {
          console.log(`   ... and ${examDetails.bookings.length - 3} more bookings`);
        }
      }

      const storedCount = parseInt(examWithBookings.properties.total_bookings || '0');
      const actualCount = examDetails.bookings?.length || 0;

      if (storedCount === actualCount) {
        console.log(`\n   ✅ SUCCESS: Counts match! (${storedCount} = ${actualCount})`);
      } else {
        console.log(`\n   ⚠️ MISMATCH: Stored: ${storedCount}, Actual: ${actualCount}`);
        console.log(`   This could be due to cancelled bookings being excluded.`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('   Stack:', error.stack);
    console.log('\n' + '='.repeat(70));
    console.log('❌ TEST FAILED\n');
  }
}

// Run the test
testBookingCountFix();
