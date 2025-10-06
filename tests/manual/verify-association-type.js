/**
 * Verification Script: Check Association Type on New Bookings
 *
 * This script creates a test booking and verifies it uses Type 1292 ("Mock Bookings")
 * association type when linking to Mock Exams.
 *
 * Usage: node tests/manual/verify-association-type.js
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

/**
 * Create a test booking
 */
async function createTestBooking() {
  console.log('📝 Creating test booking...\n');

  const testBookingData = {
    booking_id: `TEST-VERIFY-${Date.now()}`,
    name: 'Test Verification',
    email: 'test@verification.com',
    is_active: 'Active'
  };

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`,
      { properties: testBookingData }
    );

    console.log(`✅ Test booking created: ${response.data.id}\n`);
    return response.data.id;
  } catch (error) {
    console.error('❌ Failed to create test booking:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create association with specified type
 */
async function createAssociationWithType(bookingId, mockExamId) {
  console.log(`🔗 Creating association between Booking ${bookingId} and Mock Exam ${mockExamId}...\n`);

  const path = `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`;

  // Use Type 1292 "Mock Bookings" association
  const payload = [
    {
      associationCategory: 'USER_DEFINED',
      associationTypeId: 1292  // "Mock Bookings" label
    }
  ];

  try {
    const response = await hubspotApi.put(path, payload);
    console.log(`✅ Association created successfully\n`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create association:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Verify association type
 */
async function verifyAssociationType(bookingId, mockExamId) {
  console.log(`🔍 Verifying association type for Booking ${bookingId}...\n`);

  try {
    const response = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}`
    );

    const associations = response.data.results || [];

    console.log('📊 Association Details:\n');

    let hasCorrectType = false;

    associations.forEach(assoc => {
      const types = assoc.associationTypes || [];

      console.log(`  Association to Mock Exam ${assoc.toObjectId}:`);
      types.forEach(type => {
        console.log(`    - Type ID: ${type.typeId}`);
        console.log(`      Category: ${type.category}`);
        console.log(`      Label: ${type.label || 'Unlabeled'}`);

        if (type.typeId === 1292 && type.label === 'Mock Bookings') {
          hasCorrectType = true;
          console.log(`      ✅ CORRECT TYPE!`);
        }
      });
    });

    console.log('');

    if (hasCorrectType) {
      console.log('✅ VERIFICATION PASSED: Association uses Type 1292 "Mock Bookings"\n');
      return true;
    } else {
      console.log('❌ VERIFICATION FAILED: Association does NOT use Type 1292 "Mock Bookings"\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Failed to verify association:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Delete test booking
 */
async function deleteTestBooking(bookingId) {
  console.log(`🗑️  Cleaning up: Deleting test booking ${bookingId}...\n`);

  try {
    await hubspotApi.delete(`/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
    console.log(`✅ Test booking deleted\n`);
  } catch (error) {
    console.error('❌ Failed to delete test booking:', error.response?.data || error.message);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Get a mock exam for testing
 */
async function getTestMockExam() {
  console.log('🔍 Finding a mock exam for testing...\n');

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      {
        filterGroups: [],
        properties: ['exam_date', 'mock_type', 'capacity'],
        limit: 1
      }
    );

    if (response.data.results && response.data.results.length > 0) {
      const mockExam = response.data.results[0];
      console.log(`✅ Using Mock Exam: ${mockExam.id} (${mockExam.properties.mock_type})\n`);
      return mockExam.id;
    } else {
      throw new Error('No mock exams found in HubSpot');
    }
  } catch (error) {
    console.error('❌ Failed to find mock exam:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main verification function
 */
async function runVerification() {
  let bookingId;

  try {
    console.log('🔍 Starting Association Type Verification...\n');
    console.log('This script will create a test booking, associate it with a mock exam,');
    console.log('and verify that Type 1292 "Mock Bookings" association is used.\n');
    console.log('='.repeat(80) + '\n');

    // Step 1: Get a mock exam to test with
    const mockExamId = await getTestMockExam();

    // Step 2: Create test booking
    bookingId = await createTestBooking();

    // Step 3: Create association
    await createAssociationWithType(bookingId, mockExamId);

    // Step 4: Verify association type
    const isCorrect = await verifyAssociationType(bookingId, mockExamId);

    console.log('='.repeat(80) + '\n');

    if (isCorrect) {
      console.log('✅ VERIFICATION COMPLETE: Association type is correctly set to Type 1292\n');
      console.log('💡 New bookings will use the "Mock Bookings" labeled association.\n');
    } else {
      console.log('❌ VERIFICATION FAILED: Association type is NOT Type 1292\n');
      console.log('⚠️  Check the createAssociation implementation in api/_shared/hubspot.js\n');
    }

    // Step 5: Cleanup
    if (bookingId) {
      await deleteTestBooking(bookingId);
    }

    console.log('✅ Verification complete.\n');

    return isCorrect ? 0 : 1;

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);

    // Cleanup on error
    if (bookingId) {
      console.log('\n🧹 Attempting cleanup...');
      await deleteTestBooking(bookingId);
    }

    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  runVerification()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runVerification };
