/**
 * Test Script: Debug findAssociationKey helper
 *
 * This script tests if findAssociationKey is working correctly.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

async function testFindAssociationKey() {
  console.log('\n🔍 TESTING findAssociationKey HELPER\n');
  console.log('='.repeat(70));

  try {
    // Get a mock exam with bookings
    console.log('\n📋 Fetching a mock exam with bookings...');
    const mockExamsResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, {
      limit: 1,
      properties: ['mock_type', 'exam_date', 'total_bookings'],
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'total_bookings',
              operator: 'GT',
              value: '0'
            }
          ]
        }
      ]
    });

    if (!mockExamsResponse.results || mockExamsResponse.results.length === 0) {
      console.log('   ❌ No mock exams with bookings > 0 found');
      return;
    }

    const exam = mockExamsResponse.results[0];
    console.log(`   Found exam: ${exam.id}`);
    console.log(`   Stored total_bookings: ${exam.properties.total_bookings}`);

    // Get with associations
    const examWithAssoc = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${exam.id}?associations=${HUBSPOT_OBJECTS.bookings}`
    );

    console.log(`\n   Raw associations object keys:`, Object.keys(examWithAssoc.associations || {}));
    console.log(`   Full associations:`, JSON.stringify(examWithAssoc.associations, null, 2));

    // Test findAssociationKey
    console.log(`\n   Testing findAssociationKey...`);
    console.log(`   - Looking for object type ID: "${HUBSPOT_OBJECTS.bookings}"`);
    console.log(`   - Looking for object name: "bookings"`);

    const bookingsKey = hubspot.findAssociationKey(examWithAssoc.associations, HUBSPOT_OBJECTS.bookings, 'bookings');
    console.log(`   - Result: "${bookingsKey}"`);

    if (bookingsKey) {
      console.log(`\n   ✅ findAssociationKey FOUND a key!`);
      const bookingAssociations = examWithAssoc.associations[bookingsKey].results || [];
      console.log(`   - Number of bookings: ${bookingAssociations.length}`);
      console.log(`   - Booking IDs:`, bookingAssociations.map(a => a.id));
    } else {
      console.log(`\n   ❌ findAssociationKey FAILED to find a key!`);
      console.log(`   This means the helper function is not working correctly.`);
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
  }
}

// Run the test
testFindAssociationKey();
