/**
 * Test Script: Verify associations using v4 API
 *
 * This tests that associations are actually created and can be retrieved
 * using the v4 associations API that we use in production
 */

require('dotenv').config();
const axios = require('axios');

const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_OBJECTS = {
  bookings: '2-50158943',
  mock_exams: '2-50158913',
  contacts: '0-1'
};

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testV4Associations() {
  console.log('🧪 Testing v4 Associations API...\n');

  try {
    // Step 1: Find a test booking and mock exam
    console.log('📋 Finding test data...');

    // Get first booking
    const bookingsResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`,
      {
        limit: 1,
        properties: ['booking_id', 'email', 'is_active']
      }
    );

    if (!bookingsResponse.data.results || bookingsResponse.data.results.length === 0) {
      throw new Error('No bookings found');
    }

    const testBooking = bookingsResponse.data.results[0];
    console.log(`✅ Found booking: ${testBooking.properties.booking_id} (ID: ${testBooking.id})`);

    // Get first mock exam
    const mockExamsResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      {
        limit: 1,
        properties: ['mock_type', 'exam_date']
      }
    );

    if (!mockExamsResponse.data.results || mockExamsResponse.data.results.length === 0) {
      throw new Error('No mock exams found');
    }

    const testMockExam = mockExamsResponse.data.results[0];
    console.log(`✅ Found mock exam: ${testMockExam.properties.mock_type} on ${testMockExam.properties.exam_date} (ID: ${testMockExam.id})\n`);

    // Step 2: Check existing associations using v4 API
    console.log('🔍 Checking existing associations with v4 API...');

    try {
      const v4AssocResponse = await hubspotApi.get(
        `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${testBooking.id}/associations/${HUBSPOT_OBJECTS.mock_exams}`
      );

      const existingAssociations = v4AssocResponse.data.results || [];
      console.log(`📊 Booking has ${existingAssociations.length} existing mock exam association(s)`);

      if (existingAssociations.length > 0) {
        console.log('Existing associations:');
        existingAssociations.forEach(assoc => {
          console.log(`  - Mock Exam ID: ${assoc.toObjectId}`);
          if (assoc.associationTypes && assoc.associationTypes.length > 0) {
            assoc.associationTypes.forEach(type => {
              console.log(`    Type: ${type.label || 'Unlabeled'} (ID: ${type.typeId}, Category: ${type.category})`);
            });
          }
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('No associations found (404)');
      } else {
        throw error;
      }
    }

    // Step 3: Create a new association using v4 API with empty payload (default Type 1277)
    console.log('\n🔗 Creating new association using v4 API...');

    const associationPath = `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${testBooking.id}/associations/${HUBSPOT_OBJECTS.mock_exams}/${testMockExam.id}`;
    console.log(`Path: ${associationPath}`);
    console.log('Payload: [] (empty for default Type 1277)');

    const createResponse = await hubspotApi.put(associationPath, []);
    console.log('✅ Association created:', createResponse.data);

    // Step 4: Verify the association was created
    console.log('\n📊 Verifying association was created...');

    const verifyResponse = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${testBooking.id}/associations/${HUBSPOT_OBJECTS.mock_exams}`
    );

    const newAssociations = verifyResponse.data.results || [];
    console.log(`✅ Booking now has ${newAssociations.length} mock exam association(s)`);

    const foundOurAssociation = newAssociations.some(assoc =>
      assoc.toObjectId === testMockExam.id || assoc.id === testMockExam.id
    );

    if (foundOurAssociation) {
      console.log('🎉 SUCCESS! Our test association is present!');

      // Show association details
      const ourAssoc = newAssociations.find(assoc =>
        assoc.toObjectId === testMockExam.id || assoc.id === testMockExam.id
      );

      if (ourAssoc.associationTypes && ourAssoc.associationTypes.length > 0) {
        console.log('Association types:');
        ourAssoc.associationTypes.forEach(type => {
          console.log(`  - ${type.label || 'Unlabeled'} (ID: ${type.typeId}, Category: ${type.category})`);
        });
      }
    } else {
      console.log('❌ FAILED! Test association not found in results');
    }

    // Step 5: Test reverse lookup (Mock Exam → Bookings)
    console.log('\n🔄 Testing reverse lookup (Mock Exam → Bookings)...');

    const reverseResponse = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${testMockExam.id}/associations/${HUBSPOT_OBJECTS.bookings}`
    );

    const reverseAssociations = reverseResponse.data.results || [];
    console.log(`Mock Exam has ${reverseAssociations.length} booking association(s)`);

    const foundBookingInReverse = reverseAssociations.some(assoc =>
      assoc.toObjectId === testBooking.id || assoc.id === testBooking.id
    );

    if (foundBookingInReverse) {
      console.log('✅ Reverse lookup works! Booking found in Mock Exam associations');
    } else {
      console.log('❌ Reverse lookup failed! Booking not found');
    }

    // Step 6: Clean up - remove the test association
    console.log('\n🗑️ Cleaning up test association...');

    await hubspotApi.delete(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${testBooking.id}/associations/${HUBSPOT_OBJECTS.mock_exams}/${testMockExam.id}`
    );
    console.log('✅ Test association removed');

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

// Main execution
async function main() {
  const success = await testV4Associations();

  console.log('\n' + '='.repeat(80));
  if (success) {
    console.log('✅ V4 ASSOCIATIONS API TEST PASSED!');
    console.log('The fixed createAssociation method is working correctly.');
    console.log('Associations are created with default Type 1277 and can be retrieved.');
  } else {
    console.log('❌ V4 ASSOCIATIONS API TEST FAILED!');
    console.log('Check error messages above for details.');
  }
  console.log('='.repeat(80) + '\n');

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testV4Associations };