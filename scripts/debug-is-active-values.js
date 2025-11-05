/**
 * Debug Script: Check actual is_active values in HubSpot Bookings
 *
 * This script fetches recent bookings and logs their is_active property values
 * to understand what the actual data looks like in HubSpot.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

async function debugIsActiveValues() {
  console.log('\n🔍 DEBUGGING IS_ACTIVE VALUES IN HUBSPOT BOOKINGS\n');
  console.log('=' . repeat(60));

  try {
    // Step 1: Fetch a few mock exams with bookings
    console.log('\n📋 Step 1: Fetching mock exams with bookings...');
    const mockExamsResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, {
      limit: 5,
      properties: ['mock_type', 'exam_date', 'total_bookings'],
      sorts: [{ propertyName: 'exam_date', direction: 'DESCENDING' }]
    });

    console.log(`   Found ${mockExamsResponse.results?.length || 0} mock exams`);

    if (!mockExamsResponse.results || mockExamsResponse.results.length === 0) {
      console.log('\n❌ No mock exams found. Cannot proceed with debugging.');
      return;
    }

    // Step 2: For each mock exam, get its bookings
    for (const exam of mockExamsResponse.results.slice(0, 3)) {
      console.log(`\n📌 Mock Exam ID: ${exam.id}`);
      console.log(`   Type: ${exam.properties.mock_type || 'N/A'}`);
      console.log(`   Date: ${exam.properties.exam_date || 'N/A'}`);
      console.log(`   Total Bookings (stored): ${exam.properties.total_bookings || '0'}`);

      // Get bookings associated with this exam
      const examWithAssoc = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${exam.id}?associations=${HUBSPOT_OBJECTS.bookings}`
      );

      const bookingIds = [];
      if (examWithAssoc.associations && examWithAssoc.associations[HUBSPOT_OBJECTS.bookings]) {
        const bookingAssociations = examWithAssoc.associations[HUBSPOT_OBJECTS.bookings].results || [];
        bookingAssociations.forEach(assoc => {
          bookingIds.push(assoc.id);
        });
      }

      console.log(`   Associated Booking IDs: ${bookingIds.length}`);

      if (bookingIds.length === 0) {
        console.log('   ⚠️ No bookings associated with this exam.');
        continue;
      }

      // Fetch booking details
      const batchResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`, {
        properties: ['is_active', 'student_id', 'exam_date', 'booking_id'],
        inputs: bookingIds.slice(0, 10).map(id => ({ id })) // Limit to 10 for debugging
      });

      if (batchResponse.results && batchResponse.results.length > 0) {
        console.log(`\n   📊 BOOKING is_active VALUES:`);
        console.log('   ' + '-'.repeat(56));
        console.log(`   ${'Booking ID'.padEnd(15)} | ${'Student ID'.padEnd(15)} | ${'is_active Value'.padEnd(20)}`);
        console.log('   ' + '-'.repeat(56));

        // Collect unique is_active values
        const isActiveValues = new Set();

        batchResponse.results.forEach(booking => {
          const isActiveValue = booking.properties.is_active;
          const bookingId = booking.properties.booking_id || booking.id.substring(0, 12);
          const studentId = booking.properties.student_id || 'N/A';

          console.log(`   ${bookingId.padEnd(15)} | ${studentId.padEnd(15)} | "${isActiveValue}"`);
          isActiveValues.add(isActiveValue);
        });

        console.log('   ' + '-'.repeat(56));
        console.log(`\n   🔑 UNIQUE is_active VALUES FOUND:`);
        Array.from(isActiveValues).forEach(val => {
          console.log(`      - "${val}" (type: ${typeof val})`);
        });

        // Test our current filter logic
        console.log(`\n   🧪 TESTING CURRENT FILTER LOGIC:`);
        const currentLogicCount = batchResponse.results.filter(booking => {
          const status = booking.properties.is_active;
          return status === 'Active' || status === 'active' ||
                 status === 'Completed' || status === 'completed';
        }).length;

        console.log(`      Current logic counts: ${currentLogicCount} of ${batchResponse.results.length} bookings`);

        // Test alternative filter logic
        const alternativeCount = batchResponse.results.filter(booking => {
          const status = booking.properties.is_active;
          return status !== 'Cancelled' && status !== 'cancelled';
        }).length;

        console.log(`      Alternative (exclude Cancelled): ${alternativeCount} of ${batchResponse.results.length} bookings`);

        if (currentLogicCount !== alternativeCount) {
          console.log(`\n      ⚠️ MISMATCH DETECTED! There's a difference of ${Math.abs(currentLogicCount - alternativeCount)} bookings.`);
          console.log(`      This suggests the current filter is TOO STRICT.`);
        } else {
          console.log(`\n      ✅ Both filters produce the same count.`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEBUG COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error during debugging:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the debug script
debugIsActiveValues();
