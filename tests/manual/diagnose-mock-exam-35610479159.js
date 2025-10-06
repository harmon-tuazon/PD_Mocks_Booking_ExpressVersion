/**
 * Diagnostic Script: Investigate Mock Exam 35610479159
 *
 * This script investigates why stored=1 but actual=0 for this specific mock exam
 *
 * Usage: node tests/manual/diagnose-mock-exam-35610479159.js
 */

require('dotenv').config();
const axios = require('axios');

const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_OBJECTS = {
  bookings: '2-50158943',
  mock_exams: '2-50158913'
};

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const MOCK_EXAM_ID = '35610479159';

/**
 * Get mock exam details
 */
async function getMockExamDetails() {
  console.log(`\n🔍 Fetching Mock Exam ${MOCK_EXAM_ID} details...\n`);

  try {
    const response = await hubspotApi.get(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${MOCK_EXAM_ID}`,
      {
        params: {
          properties: ['exam_date', 'mock_type', 'capacity', 'total_bookings', 'is_active', 'start_time', 'end_time']
        }
      }
    );

    console.log('Mock Exam Details:');
    console.log('='.repeat(60));
    console.log(`ID: ${response.data.id}`);
    console.log(`Mock Type: ${response.data.properties.mock_type}`);
    console.log(`Exam Date: ${response.data.properties.exam_date}`);
    console.log(`Start Time: ${response.data.properties.start_time}`);
    console.log(`End Time: ${response.data.properties.end_time}`);
    console.log(`Capacity: ${response.data.properties.capacity}`);
    console.log(`Total Bookings (stored): ${response.data.properties.total_bookings}`);
    console.log(`Is Active: ${response.data.properties.is_active}`);
    console.log('='.repeat(60) + '\n');

    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch mock exam:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get associations for the mock exam
 */
async function getAssociations() {
  console.log(`🔗 Fetching associations for Mock Exam ${MOCK_EXAM_ID}...\n`);

  try {
    const response = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${MOCK_EXAM_ID}/associations/${HUBSPOT_OBJECTS.bookings}`
    );

    const associations = response.data.results || [];

    console.log(`Found ${associations.length} association(s)\n`);

    if (associations.length > 0) {
      console.log('Association Details:');
      console.log('='.repeat(60));
      associations.forEach((assoc, index) => {
        console.log(`\nAssociation ${index + 1}:`);
        console.log(`  To Booking ID: ${assoc.toObjectId}`);
        console.log(`  Association Types:`);
        assoc.associationTypes?.forEach(type => {
          console.log(`    - Type ID: ${type.typeId}`);
          console.log(`      Category: ${type.category}`);
          console.log(`      Label: ${type.label || 'Unlabeled'}`);
        });
      });
      console.log('='.repeat(60) + '\n');
    }

    return associations;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('ℹ️  No associations found (404)\n');
      return [];
    }
    console.error('❌ Failed to get associations:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get booking details
 */
async function getBookingDetails(bookingIds) {
  if (bookingIds.length === 0) {
    console.log('⚠️  No booking IDs to fetch\n');
    return [];
  }

  console.log(`📋 Fetching ${bookingIds.length} booking object(s)...\n`);

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`,
      {
        inputs: bookingIds.map(id => ({ id })),
        properties: ['booking_id', 'is_active', 'name', 'email', 'exam_date', 'mock_type']
      }
    );

    const bookings = response.data.results || [];

    console.log('Booking Details:');
    console.log('='.repeat(60));
    bookings.forEach((booking, index) => {
      console.log(`\nBooking ${index + 1}:`);
      console.log(`  HubSpot ID: ${booking.id}`);
      console.log(`  Booking ID: ${booking.properties.booking_id}`);
      console.log(`  Name: ${booking.properties.name}`);
      console.log(`  Email: ${booking.properties.email}`);
      console.log(`  Mock Type: ${booking.properties.mock_type}`);
      console.log(`  Exam Date: ${booking.properties.exam_date}`);
      console.log(`  is_active: "${booking.properties.is_active}" (type: ${typeof booking.properties.is_active})`);

      // Apply counting logic
      const isActive = booking.properties.is_active;
      const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
      const isFalse = isActive === false || isActive === 'false';
      const shouldBeCounted = !isCancelled && !isFalse;

      console.log(`  Should be counted: ${shouldBeCounted ? '✅ YES' : '❌ NO'}`);
      if (!shouldBeCounted) {
        console.log(`  Reason: ${isCancelled ? 'Cancelled status' : 'False value'}`);
      }
    });
    console.log('='.repeat(60) + '\n');

    return bookings;
  } catch (error) {
    console.error('❌ Failed to fetch bookings:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Analyze the discrepancy
 */
function analyzeDiscrepancy(mockExam, associations, bookings) {
  console.log('\n📊 ANALYSIS\n');
  console.log('='.repeat(60));

  const storedCount = parseInt(mockExam.properties.total_bookings) || 0;
  console.log(`Stored total_bookings: ${storedCount}`);
  console.log(`Total associations: ${associations.length}`);
  console.log(`Bookings retrieved: ${bookings.length}`);

  // Apply counting logic
  const countedBookings = bookings.filter(booking => {
    const isActive = booking.properties.is_active;
    const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
    const isFalse = isActive === false || isActive === 'false';
    return !isCancelled && !isFalse;
  });

  console.log(`Bookings that should be counted: ${countedBookings.length}`);
  console.log('='.repeat(60) + '\n');

  // Breakdown by status
  const statusBreakdown = {};
  bookings.forEach(b => {
    const status = b.properties.is_active;
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  });

  console.log('Status Breakdown:');
  Object.entries(statusBreakdown).forEach(([status, count]) => {
    console.log(`  "${status}": ${count}`);
  });
  console.log('');

  // Identify issue
  if (associations.length === 0) {
    console.log('❌ ISSUE: No associations found, but stored count is ' + storedCount);
    console.log('   This mock exam has no bookings associated with it.\n');
  } else if (bookings.length < associations.length) {
    console.log(`⚠️  WARNING: ${associations.length - bookings.length} associated booking(s) not found`);
    console.log('   These bookings might be deleted/archived.\n');
  }

  if (countedBookings.length === 0 && bookings.length > 0) {
    console.log('❌ ISSUE: Bookings exist but none should be counted');
    console.log('   All bookings are either Cancelled or have is_active=false\n');
  }

  if (countedBookings.length !== storedCount) {
    console.log(`🔴 DISCREPANCY CONFIRMED:`);
    console.log(`   Stored: ${storedCount}`);
    console.log(`   Actual: ${countedBookings.length}`);
    console.log(`   Difference: ${storedCount - countedBookings.length}\n`);
  } else {
    console.log('✅ No discrepancy - counts match\n');
  }
}

/**
 * Main function
 */
async function investigate() {
  console.log('🔧 Starting Mock Exam Investigation...\n');
  console.log('Mock Exam ID: ' + MOCK_EXAM_ID);
  console.log('='.repeat(60));

  try {
    // Step 1: Get mock exam details
    const mockExam = await getMockExamDetails();

    // Step 2: Get associations
    const associations = await getAssociations();

    // Step 3: Get booking details
    const bookingIds = associations.map(a => a.toObjectId);
    const bookings = await getBookingDetails(bookingIds);

    // Step 4: Analyze
    analyzeDiscrepancy(mockExam, associations, bookings);

    console.log('✅ Investigation complete!\n');

  } catch (error) {
    console.error('\n❌ Investigation failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  investigate()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { investigate };
