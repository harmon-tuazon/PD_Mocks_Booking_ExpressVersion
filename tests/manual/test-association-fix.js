/**
 * Test Script: Verify Association Fix
 *
 * This script tests the fixed association creation between Bookings and Mock Exams
 * to ensure both creation AND retrieval work correctly.
 *
 * Usage: node tests/manual/test-association-fix.js
 */

require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');

const hubspot = new HubSpotService();

async function testAssociationFix() {
  console.log('🧪 Testing Association Fix...\n');
  console.log('This test will:');
  console.log('1. Create a test booking');
  console.log('2. Associate it with a mock exam');
  console.log('3. Retrieve the booking to verify association\n');

  try {
    // Step 1: Get a test contact and mock exam
    console.log('📋 Step 1: Getting test contact and mock exam...');

    // Search for a contact
    const contacts = await hubspot.searchObjects(HUBSPOT_OBJECTS.contacts, {
      limit: 1,
      properties: ['email', 'firstname', 'lastname']
    });

    if (!contacts.results || contacts.results.length === 0) {
      throw new Error('No contacts found in HubSpot');
    }

    const testContact = contacts.results[0];
    console.log(`✅ Found test contact: ${testContact.properties.email} (ID: ${testContact.id})`);

    // Search for a mock exam
    const mockExams = await hubspot.searchObjects(HUBSPOT_OBJECTS.mock_exams, {
      limit: 1,
      properties: ['mock_type', 'exam_date', 'capacity']
    });

    if (!mockExams.results || mockExams.results.length === 0) {
      throw new Error('No mock exams found in HubSpot');
    }

    const testMockExam = mockExams.results[0];
    console.log(`✅ Found test mock exam: ${testMockExam.properties.mock_type} on ${testMockExam.properties.exam_date} (ID: ${testMockExam.id})\n`);

    // Step 2: Create a test booking
    console.log('📝 Step 2: Creating test booking...');

    const bookingProperties = {
      contact_id: testContact.id,
      contact_email: testContact.properties.email,
      mock_exam_id: testMockExam.id,
      exam_type: testMockExam.properties.mock_type,
      exam_date: testMockExam.properties.exam_date,
      booking_date: new Date().toISOString().split('T')[0],
      payment_status: 'test_booking',
      is_active: true,
      payment_method: 'Credit',
      amount_paid: 0
    };

    const createdBooking = await hubspot.createObject(HUBSPOT_OBJECTS.bookings, bookingProperties);
    console.log(`✅ Created test booking with ID: ${createdBooking.id}\n`);

    // Step 3: Create associations
    console.log('🔗 Step 3: Creating associations...');

    // Associate with Contact
    console.log('Creating Booking → Contact association...');
    await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      createdBooking.id,
      HUBSPOT_OBJECTS.contacts,
      testContact.id
    );

    // Associate with Mock Exam (THIS IS THE KEY TEST)
    console.log('Creating Booking → Mock Exam association...');
    await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      createdBooking.id,
      HUBSPOT_OBJECTS.mock_exams,
      testMockExam.id
    );

    console.log('✅ Associations created successfully\n');

    // Step 4: Retrieve the booking with associations
    console.log('🔍 Step 4: Retrieving booking with associations...');

    const retrievedBooking = await hubspot.getObjectById(
      HUBSPOT_OBJECTS.bookings,
      createdBooking.id,
      [
        'contact_id', 'mock_exam_id', 'exam_type', 'exam_date',
        'booking_date', 'is_active', 'payment_status'
      ],
      [HUBSPOT_OBJECTS.contacts, HUBSPOT_OBJECTS.mock_exams]
    );

    console.log('📊 Retrieved booking details:');
    console.log(`  ID: ${retrievedBooking.id}`);
    console.log(`  Properties:`, retrievedBooking.properties);

    // Check associations
    const contactAssocs = retrievedBooking.associations?.[HUBSPOT_OBJECTS.contacts]?.results || [];
    const mockExamAssocs = retrievedBooking.associations?.[HUBSPOT_OBJECTS.mock_exams]?.results || [];

    console.log(`\n  Contact associations: ${contactAssocs.length}`);
    if (contactAssocs.length > 0) {
      console.log(`    - Contact ID: ${contactAssocs[0].toObjectId || contactAssocs[0].id}`);
    }

    console.log(`  Mock Exam associations: ${mockExamAssocs.length}`);
    if (mockExamAssocs.length > 0) {
      console.log(`    - Mock Exam ID: ${mockExamAssocs[0].toObjectId || mockExamAssocs[0].id}`);
    }

    // Step 5: Verify associations work correctly
    console.log('\n🎯 Step 5: Verification Results:');

    const contactAssocValid = contactAssocs.length === 1 &&
      (contactAssocs[0].toObjectId === testContact.id || contactAssocs[0].id === testContact.id);

    const mockExamAssocValid = mockExamAssocs.length === 1 &&
      (mockExamAssocs[0].toObjectId === testMockExam.id || mockExamAssocs[0].id === testMockExam.id);

    if (contactAssocValid) {
      console.log('✅ Contact association: WORKING');
    } else {
      console.log('❌ Contact association: FAILED');
    }

    if (mockExamAssocValid) {
      console.log('✅ Mock Exam association: WORKING');
    } else {
      console.log('❌ Mock Exam association: FAILED');
    }

    // Step 6: Test retrieval from Mock Exam side
    console.log('\n📋 Step 6: Testing reverse lookup (Mock Exam → Bookings)...');

    const mockExamWithBookings = await hubspot.getObjectById(
      HUBSPOT_OBJECTS.mock_exams,
      testMockExam.id,
      ['mock_type', 'exam_date'],
      [HUBSPOT_OBJECTS.bookings]
    );

    const bookingAssocsFromMockExam = mockExamWithBookings.associations?.[HUBSPOT_OBJECTS.bookings]?.results || [];
    console.log(`  Mock Exam has ${bookingAssocsFromMockExam.length} booking(s)`);

    const testBookingFound = bookingAssocsFromMockExam.some(
      assoc => (assoc.toObjectId === createdBooking.id || assoc.id === createdBooking.id)
    );

    if (testBookingFound) {
      console.log('✅ Reverse lookup: WORKING (found test booking)');
    } else {
      console.log('❌ Reverse lookup: FAILED (test booking not found)');
    }

    // Step 7: Clean up test booking
    console.log('\n🗑️ Step 7: Cleaning up test booking...');
    await hubspot.deleteObject(HUBSPOT_OBJECTS.bookings, createdBooking.id);
    console.log('✅ Test booking deleted\n');

    // Final summary
    console.log('=' .repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(80));

    const allTestsPassed = contactAssocValid && mockExamAssocValid && testBookingFound;

    if (allTestsPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Association fix is working correctly.');
      console.log('✅ Bookings can be created');
      console.log('✅ Associations are properly created');
      console.log('✅ Bookings can be retrieved with associations');
      console.log('✅ Reverse lookups work (Mock Exam → Bookings)');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED. Issues detected:');
      if (!contactAssocValid) console.log('❌ Contact association not working');
      if (!mockExamAssocValid) console.log('❌ Mock Exam association not working');
      if (!testBookingFound) console.log('❌ Reverse lookup not working');
    }

    return allTestsPassed;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  testAssociationFix()
    .then(success => {
      console.log('\n✅ Test script completed.');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testAssociationFix };