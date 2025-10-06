/**
 * Trace Real-Time Calculation Logic
 *
 * This script simulates the exact flow of api/mock-exams/available.js
 * to understand why actual=0 when there's 1 Active booking
 *
 * Usage: node tests/manual/trace-realtime-calculation.js
 */

require('dotenv').config();
const { HubSpotService } = require('../../api/_shared/hubspot');

const MOCK_EXAM_ID = '35610479159';

async function traceCalculation() {
  console.log('🔍 TRACING REAL-TIME CALCULATION LOGIC\n');
  console.log('='.repeat(80));
  console.log(`Mock Exam ID: ${MOCK_EXAM_ID}\n`);

  const hubspot = new HubSpotService();

  try {
    // Step 1: Get mock exam details
    console.log('Step 1: Fetching mock exam...');
    const exam = await hubspot.getMockExam(MOCK_EXAM_ID);
    console.log(`  ✅ Mock exam fetched`);
    console.log(`  Current total_bookings: ${exam.properties.total_bookings}\n`);

    // Step 2: Get associations (simulating batch read for single exam)
    console.log('Step 2: Getting associations...');
    const associations = await hubspot.apiCall(
      'GET',
      `/crm/v4/objects/2-50158913/${MOCK_EXAM_ID}/associations/2-50158943`
    );

    const associationResults = associations?.results || [];
    console.log(`  ✅ Found ${associationResults.length} association(s)`);

    if (associationResults.length > 0) {
      console.log('  Association Details:');
      associationResults.forEach((assoc, i) => {
        console.log(`    ${i + 1}. Booking ID: ${assoc.toObjectId}`);
        assoc.associationTypes?.forEach(type => {
          console.log(`       Type: ${type.typeId} (${type.label || 'Unlabeled'})`);
        });
      });
    }
    console.log('');

    // Step 3: Extract booking IDs
    console.log('Step 3: Extracting booking IDs...');
    const bookingIds = associationResults.map(a => a.toObjectId);
    console.log(`  ✅ Extracted ${bookingIds.length} booking ID(s): ${bookingIds.join(', ')}\n`);

    // Step 4: Batch read bookings (SIMULATING THE EXACT FLOW)
    console.log('Step 4: Batch reading booking objects...');
    console.log(`  Calling hubspot.batch.batchReadObjects with:`);
    console.log(`    objectType: '2-50158943'`);
    console.log(`    ids: [${bookingIds.join(', ')}]`);
    console.log(`    properties: ['is_active']`);

    const bookings = bookingIds.length > 0
      ? await hubspot.batch.batchReadObjects('2-50158943', bookingIds, ['is_active'])
      : [];

    console.log(`  ✅ Batch read returned ${bookings.length} booking(s)\n`);

    if (bookings.length > 0) {
      console.log('  Booking Details:');
      bookings.forEach((booking, i) => {
        console.log(`    ${i + 1}. ID: ${booking.id}`);
        console.log(`       is_active: "${booking.properties.is_active}" (type: ${typeof booking.properties.is_active})`);
      });
      console.log('');
    } else {
      console.log('  ⚠️  WARNING: Batch read returned 0 bookings!\n');
    }

    // Step 5: Build booking status map (EXACT LOGIC FROM available.js)
    console.log('Step 5: Building booking status map...');
    const bookingStatusMap = new Map();
    for (const booking of bookings) {
      const isActive = booking.properties.is_active !== 'Cancelled' &&
                      booking.properties.is_active !== 'cancelled' &&
                      booking.properties.is_active !== false;
      bookingStatusMap.set(booking.id, isActive);
      console.log(`  Booking ${booking.id}:`);
      console.log(`    booking.id type: ${typeof booking.id}`);
      console.log(`    booking.id value: ${JSON.stringify(booking.id)}`);
      console.log(`    is_active value: "${booking.properties.is_active}"`);
      console.log(`    !== 'Cancelled': ${booking.properties.is_active !== 'Cancelled'}`);
      console.log(`    !== 'cancelled': ${booking.properties.is_active !== 'cancelled'}`);
      console.log(`    !== false: ${booking.properties.is_active !== false}`);
      console.log(`    Final result: ${isActive}`);
      console.log(`    Map entry: bookingStatusMap.set(${JSON.stringify(booking.id)}, ${isActive})\n`);
    }

    console.log('  Map contents after creation:');
    for (const [key, value] of bookingStatusMap) {
      console.log(`    Key: ${JSON.stringify(key)} (type: ${typeof key}) → Value: ${value}\n`);
    }

    // Step 6: Count active bookings (EXACT LOGIC FROM available.js - WITH FIX)
    console.log('Step 6: Counting active bookings (WITH FIX)...');
    const activeCount = associationResults.filter(bookingAssoc => {
      // FIX: Convert toObjectId to string for map lookup
      const bookingId = String(bookingAssoc.toObjectId);
      const isActive = bookingStatusMap.get(bookingId);
      console.log(`  Checking booking ${bookingAssoc.toObjectId}:`);
      console.log(`    toObjectId (original) type: ${typeof bookingAssoc.toObjectId}`);
      console.log(`    toObjectId (original) value: ${JSON.stringify(bookingAssoc.toObjectId)}`);
      console.log(`    toObjectId (converted to string): ${JSON.stringify(bookingId)}`);
      console.log(`    bookingStatusMap.get(${JSON.stringify(bookingId)}): ${isActive}`);
      console.log(`    === true: ${isActive === true}`);
      console.log(`    Will be counted: ${isActive === true ? 'YES ✅' : 'NO ❌'}\n`);

      return isActive === true;
    }).length;

    console.log('='.repeat(80));
    console.log('FINAL RESULT:');
    console.log(`  Total associations: ${associationResults.length}`);
    console.log(`  Bookings retrieved by batch read: ${bookings.length}`);
    console.log(`  Active bookings counted: ${activeCount}`);
    console.log(`  Current stored value: ${exam.properties.total_bookings}`);
    console.log('='.repeat(80) + '\n');

    if (activeCount === 0 && associationResults.length > 0) {
      console.log('🔴 ISSUE IDENTIFIED:');
      if (bookings.length === 0) {
        console.log('  ❌ Batch read returned 0 bookings despite having associations!');
        console.log('  This could mean:');
        console.log('    - Bookings are archived/deleted');
        console.log('    - Batch read API is failing silently');
        console.log('    - extractSuccessfulResults is filtering them out\n');
      } else {
        console.log('  ❌ Bookings exist but none are being counted!');
        console.log('  This could mean:');
        console.log('    - bookingStatusMap entries are not === true');
        console.log('    - Logic issue in status map creation\n');
      }
    } else if (activeCount !== parseInt(exam.properties.total_bookings)) {
      console.log('⚠️  DISCREPANCY:');
      console.log(`  Actual count (${activeCount}) != Stored count (${exam.properties.total_bookings})\n`);
    } else {
      console.log('✅ Counts match - no issue detected\n');
    }

  } catch (error) {
    console.error('\n❌ Trace failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run
traceCalculation()
  .then(() => {
    console.log('✅ Trace complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
