/**
 * Test Script: Check raw HubSpot API response
 *
 * This script directly calls the HubSpot search API to see what's returned.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

async function testRawResponse() {
  console.log('\n🔍 TESTING RAW HUBSPOT API RESPONSE\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📋 Calling HubSpot search API directly...');

    const searchRequest = {
      properties: ['mock_type', 'exam_date', 'total_bookings'],
      associations: [HUBSPOT_OBJECTS.bookings],
      limit: 2,
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
    };

    console.log('\n   Request:');
    console.log(JSON.stringify(searchRequest, null, 2));

    const response = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, searchRequest);

    console.log(`\n   Response summary:`);
    console.log(`   - Total results: ${response.total || 0}`);
    console.log(`   - Results returned: ${response.results?.length || 0}`);

    if (response.results && response.results.length > 0) {
      response.results.forEach((exam, idx) => {
        console.log(`\n   📌 Result ${idx + 1}:`);
        console.log(`      ID: ${exam.id}`);
        console.log(`      Properties:`, JSON.stringify(exam.properties, null, 2));
        console.log(`      Has associations: ${exam.associations ? 'YES' : 'NO'}`);

        if (exam.associations) {
          console.log(`      Association keys:`, Object.keys(exam.associations));
          Object.keys(exam.associations).forEach(key => {
            const results = exam.associations[key].results || [];
            console.log(`        - ${key}: ${results.length} items`);
            if (results.length > 0) {
              console.log(`          IDs:`, results.map(r => r.id));
            }
          });
        } else {
          console.log(`      ❌ NO associations object in response!`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('   Stack:', error.stack);
  }
}

// Run the test
testRawResponse();
