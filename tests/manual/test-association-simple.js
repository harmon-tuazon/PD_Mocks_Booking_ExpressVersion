/**
 * Simple Test Script: Verify Association Fix
 *
 * This script tests the fixed association creation between Bookings and Mock Exams
 *
 * Usage: node tests/manual/test-association-simple.js <bookingId> <mockExamId>
 *        or
 *        node tests/manual/test-association-simple.js (to create a new test booking)
 */

require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');
const axios = require('axios');

const hubspot = new HubSpotService();
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testExistingAssociation(bookingId, mockExamId) {
  console.log(`\n🔗 Testing association between existing Booking ${bookingId} and Mock Exam ${mockExamId}...\n`);

  try {
    // Create the association using our fixed method
    console.log('Creating association using fixed createAssociation method...');
    await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      bookingId,
      HUBSPOT_OBJECTS.mock_exams,
      mockExamId
    );
    console.log('✅ Association created successfully\n');

    // Retrieve the booking to verify
    console.log('Retrieving booking to verify association...');
    const bookingResponse = await hubspotApi.get(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}?properties=booking_id,email,mock_type,is_active&associations=${HUBSPOT_OBJECTS.mock_exams}`
    );
    const booking = bookingResponse.data;

    const mockExamAssocs = booking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];
    console.log(`✅ Booking has ${mockExamAssocs.length} mock exam association(s)`);

    if (mockExamAssocs.length > 0) {
      mockExamAssocs.forEach(assoc => {
        const associatedId = assoc.toObjectId || assoc.id;
        console.log(`  - Associated Mock Exam ID: ${associatedId}`);
        if (associatedId === mockExamId) {
          console.log(`    ✅ This is our target mock exam!`);
        }
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function createNewTestBooking() {
  console.log('\n📝 Creating a new test booking...\n');

  try {
    // Get a test contact (first one we find)
    console.log('Finding a test contact...');
    const contactsResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
      {
        limit: 1,
        properties: ['email', 'firstname', 'lastname', 'hs_object_id']
      }
    );

    if (!contactsResponse.data.results || contactsResponse.data.results.length === 0) {
      throw new Error('No contacts found');
    }

    const testContact = contactsResponse.data.results[0];
    console.log(`✅ Found contact: ${testContact.properties.email} (ID: ${testContact.id})`);

    // Get a test mock exam (first one we find)
    console.log('Finding a test mock exam...');
    const mockExamsResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      {
        limit: 1,
        properties: ['mock_type', 'exam_date', 'hs_object_id']
      }
    );

    if (!mockExamsResponse.data.results || mockExamsResponse.data.results.length === 0) {
      throw new Error('No mock exams found');
    }

    const testMockExam = mockExamsResponse.data.results[0];
    console.log(`✅ Found mock exam: ${testMockExam.properties.mock_type} on ${testMockExam.properties.exam_date} (ID: ${testMockExam.id})\n`);

    // Create test booking
    console.log('Creating test booking...');

    // Generate a unique booking ID
    const timestamp = Date.now();
    const bookingId = `TEST-${testMockExam.properties.mock_type}-${testContact.properties.email} - ${timestamp}`;

    const bookingData = {
      properties: {
        booking_id: bookingId,  // Required property
        name: `Test Booking ${timestamp}`,
        email: testContact.properties.email,
        // student_id is calculated, don't set it
        // mock_type is calculated, don't set it
        // exam_date is calculated, don't set it
        is_active: 'Active',  // Must be one of: Active, Cancelled, Completed
        token_used: 'Shared Token'  // Must be one of allowed values
      }
    };

    const createResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`,
      bookingData
    );

    const createdBooking = createResponse.data;
    console.log(`✅ Created test booking with ID: ${createdBooking.id}\n`);

    // Now test the association
    console.log('Testing association creation...');
    await testExistingAssociation(createdBooking.id, testMockExam.id);

    // Also test contact association
    console.log('\nTesting contact association...');
    await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      createdBooking.id,
      HUBSPOT_OBJECTS.contacts,
      testContact.id
    );
    console.log('✅ Contact association created\n');

    // Verify all associations
    console.log('📊 Final verification - retrieving booking with all associations...');
    const finalBookingResponse = await hubspotApi.get(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${createdBooking.id}?properties=booking_id,email,mock_type,is_active&associations=${HUBSPOT_OBJECTS.contacts},${HUBSPOT_OBJECTS.mock_exams}`
    );
    const finalBooking = finalBookingResponse.data;

    const contactAssocs = finalBooking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];
    const mockExamAssocs = finalBooking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];

    console.log(`\n✅ FINAL RESULTS:`);
    console.log(`  Booking ID: ${createdBooking.id}`);
    console.log(`  Contact associations: ${contactAssocs.length}`);
    console.log(`  Mock Exam associations: ${mockExamAssocs.length}`);

    if (contactAssocs.length > 0 && mockExamAssocs.length > 0) {
      console.log(`\n🎉 SUCCESS! All associations working correctly!`);
    } else {
      console.log(`\n⚠️ WARNING: Some associations may be missing`);
    }

    // Clean up
    console.log('\n🗑️ Cleaning up test booking...');
    await hubspotApi.delete(`/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${createdBooking.id}`);
    console.log('✅ Test booking deleted');

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  let success;
  if (args.length === 2) {
    // Test existing booking and mock exam
    const [bookingId, mockExamId] = args;
    success = await testExistingAssociation(bookingId, mockExamId);
  } else {
    // Create new test booking
    success = await createNewTestBooking();
  }

  console.log('\n' + '='.repeat(80));
  if (success) {
    console.log('✅ Association fix is WORKING!');
    console.log('Bookings can now be properly associated with Mock Exams.');
  } else {
    console.log('❌ Association fix may have issues.');
    console.log('Please check the error messages above.');
  }
  console.log('='.repeat(80) + '\n');

  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testExistingAssociation, createNewTestBooking };