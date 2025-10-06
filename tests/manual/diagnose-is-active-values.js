/**
 * Diagnostic Script: Check is_active Property Values on Bookings
 *
 * This script queries HubSpot to identify bookings with potentially incorrect is_active values
 * that might be causing total_bookings to be set to zero incorrectly.
 *
 * Usage: node tests/manual/diagnose-is-active-values.js
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

/**
 * Get all bookings with their is_active property
 */
async function getAllBookings() {
  console.log('📊 Fetching all bookings from HubSpot...\n');

  const searchPayload = {
    filterGroups: [],
    properties: [
      'booking_id',
      'is_active',
      'name',
      'email',
      'mock_type',
      'exam_date',
      'hs_createdate',
      'hs_object_id'
    ],
    limit: 100
  };

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`,
      searchPayload
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch bookings:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get mock exam associations for bookings
 */
async function getMockExamAssociations(bookingIds) {
  if (bookingIds.length === 0) return [];

  console.log(`🔗 Fetching mock exam associations for ${bookingIds.length} bookings...\n`);

  try {
    const response = await hubspotApi.post(
      `/crm/v4/associations/${HUBSPOT_OBJECTS.bookings}/${HUBSPOT_OBJECTS.mock_exams}/batch/read`,
      { inputs: bookingIds.map(id => ({ id })) }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch associations:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get mock exam details
 */
async function getMockExamDetails(mockExamIds) {
  if (mockExamIds.length === 0) return [];

  console.log(`📋 Fetching details for ${mockExamIds.length} mock exams...\n`);

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/batch/read`,
      {
        inputs: mockExamIds.map(id => ({ id })),
        properties: ['exam_date', 'mock_type', 'capacity', 'total_bookings', 'is_active']
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch mock exams:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Analyze is_active values and report issues
 */
function analyzeIsActiveValues(bookings, associations, mockExams) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 IS_ACTIVE VALUE ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');

  // Create lookup maps
  const mockExamMap = new Map();
  mockExams.forEach(exam => {
    mockExamMap.set(exam.id, exam.properties);
  });

  const bookingToMockExamMap = new Map();
  associations.forEach(assoc => {
    if (assoc.to && assoc.to.length > 0) {
      bookingToMockExamMap.set(assoc.from.id, assoc.to[0].toObjectId);
    }
  });

  // Categorize bookings by is_active value
  const byIsActive = {
    'Active': [],
    'Cancelled': [],
    'undefined': [],
    'null': [],
    'empty': [],
    'other': []
  };

  bookings.forEach(booking => {
    const isActive = booking.properties.is_active;
    const mockExamId = bookingToMockExamMap.get(booking.id);
    const mockExam = mockExamId ? mockExamMap.get(mockExamId) : null;

    const bookingInfo = {
      id: booking.id,
      booking_id: booking.properties.booking_id,
      is_active: isActive,
      is_active_type: typeof isActive,
      name: booking.properties.name,
      email: booking.properties.email,
      exam_date: booking.properties.exam_date || mockExam?.exam_date,
      mock_type: booking.properties.mock_type || mockExam?.mock_type,
      created: booking.properties.hs_createdate,
      mock_exam_id: mockExamId,
      mock_exam_total_bookings: mockExam?.total_bookings
    };

    if (isActive === 'Active') {
      byIsActive['Active'].push(bookingInfo);
    } else if (isActive === 'Cancelled' || isActive === 'cancelled') {
      byIsActive['Cancelled'].push(bookingInfo);
    } else if (isActive === undefined) {
      byIsActive['undefined'].push(bookingInfo);
    } else if (isActive === null) {
      byIsActive['null'].push(bookingInfo);
    } else if (isActive === '') {
      byIsActive['empty'].push(bookingInfo);
    } else {
      byIsActive['other'].push(bookingInfo);
    }
  });

  // Print summary
  console.log('📈 SUMMARY BY IS_ACTIVE VALUE:\n');
  console.log(`  ✅ Active:      ${byIsActive['Active'].length} bookings`);
  console.log(`  ❌ Cancelled:   ${byIsActive['Cancelled'].length} bookings`);
  console.log(`  ⚠️  Undefined:   ${byIsActive['undefined'].length} bookings`);
  console.log(`  ⚠️  Null:        ${byIsActive['null'].length} bookings`);
  console.log(`  ⚠️  Empty:       ${byIsActive['empty'].length} bookings`);
  console.log(`  🔴 Other:       ${byIsActive['other'].length} bookings`);
  console.log(`\n  📊 TOTAL:       ${bookings.length} bookings\n`);

  // Report potential issues
  console.log('='.repeat(80));
  console.log('🔍 POTENTIAL ISSUES:\n');

  let issueCount = 0;

  // Check for undefined/null/empty is_active
  if (byIsActive['undefined'].length > 0) {
    issueCount++;
    console.log(`\n⚠️  ISSUE #${issueCount}: ${byIsActive['undefined'].length} bookings with UNDEFINED is_active`);
    console.log('These bookings have no is_active property set.\n');
    byIsActive['undefined'].forEach(b => {
      console.log(`  - Booking: ${b.booking_id} (${b.name})`);
      console.log(`    Mock Exam: ${b.mock_type} on ${b.exam_date}`);
      console.log(`    Created: ${b.created}`);
      console.log(`    Mock Exam ID: ${b.mock_exam_id}`);
      console.log(`    Mock Exam total_bookings: ${b.mock_exam_total_bookings}\n`);
    });
  }

  if (byIsActive['null'].length > 0) {
    issueCount++;
    console.log(`\n⚠️  ISSUE #${issueCount}: ${byIsActive['null'].length} bookings with NULL is_active`);
    console.log('These bookings have is_active explicitly set to null.\n');
    byIsActive['null'].forEach(b => {
      console.log(`  - Booking: ${b.booking_id} (${b.name})`);
      console.log(`    Mock Exam: ${b.mock_type} on ${b.exam_date}`);
      console.log(`    Created: ${b.created}\n`);
    });
  }

  if (byIsActive['empty'].length > 0) {
    issueCount++;
    console.log(`\n⚠️  ISSUE #${issueCount}: ${byIsActive['empty'].length} bookings with EMPTY STRING is_active`);
    console.log('These bookings have is_active set to an empty string.\n');
    byIsActive['empty'].forEach(b => {
      console.log(`  - Booking: ${b.booking_id} (${b.name})`);
      console.log(`    Mock Exam: ${b.mock_type} on ${b.exam_date}`);
      console.log(`    Created: ${b.created}\n`);
    });
  }

  if (byIsActive['other'].length > 0) {
    issueCount++;
    console.log(`\n🔴 ISSUE #${issueCount}: ${byIsActive['other'].length} bookings with UNEXPECTED is_active values`);
    console.log('These bookings have is_active values other than "Active" or "Cancelled".\n');
    byIsActive['other'].forEach(b => {
      console.log(`  - Booking: ${b.booking_id} (${b.name})`);
      console.log(`    is_active: "${b.is_active}" (type: ${b.is_active_type})`);
      console.log(`    Mock Exam: ${b.mock_type} on ${b.exam_date}`);
      console.log(`    Created: ${b.created}\n`);
    });
  }

  // Check mock exams with zero total_bookings but have Active bookings
  console.log('='.repeat(80));
  console.log('🔍 CHECKING MOCK EXAMS WITH ZERO TOTAL_BOOKINGS:\n');

  const mockExamsWithZero = new Map();
  mockExams.forEach(exam => {
    if (exam.properties.total_bookings === '0' || exam.properties.total_bookings === 0) {
      mockExamsWithZero.set(exam.id, {
        id: exam.id,
        mock_type: exam.properties.mock_type,
        exam_date: exam.properties.exam_date,
        total_bookings: exam.properties.total_bookings,
        capacity: exam.properties.capacity,
        activeBookings: [],
        cancelledBookings: [],
        problematicBookings: []
      });
    }
  });

  // Map bookings to mock exams with zero
  bookings.forEach(booking => {
    const mockExamId = bookingToMockExamMap.get(booking.id);
    if (mockExamsWithZero.has(mockExamId)) {
      const exam = mockExamsWithZero.get(mockExamId);
      const isActive = booking.properties.is_active;

      if (isActive === 'Active') {
        exam.activeBookings.push(booking);
      } else if (isActive === 'Cancelled' || isActive === 'cancelled') {
        exam.cancelledBookings.push(booking);
      } else {
        exam.problematicBookings.push(booking);
      }
    }
  });

  let zeroIssueCount = 0;
  mockExamsWithZero.forEach(exam => {
    if (exam.activeBookings.length > 0) {
      zeroIssueCount++;
      console.log(`\n🔴 CRITICAL ISSUE: Mock exam ${exam.id} has total_bookings=0 BUT ${exam.activeBookings.length} ACTIVE booking(s)!`);
      console.log(`   Mock Type: ${exam.mock_type}`);
      console.log(`   Exam Date: ${exam.exam_date}`);
      console.log(`   Capacity: ${exam.capacity}`);
      console.log(`   Active Bookings:`);
      exam.activeBookings.forEach(b => {
        console.log(`     - ${b.properties.booking_id}: ${b.properties.name} (${b.properties.email})`);
      });
    } else if (exam.problematicBookings.length > 0) {
      zeroIssueCount++;
      console.log(`\n⚠️  Mock exam ${exam.id} has total_bookings=0 with ${exam.problematicBookings.length} problematic booking(s)`);
      console.log(`   Mock Type: ${exam.mock_type}`);
      console.log(`   Exam Date: ${exam.exam_date}`);
      console.log(`   Problematic Bookings:`);
      exam.problematicBookings.forEach(b => {
        console.log(`     - ${b.properties.booking_id}: is_active="${b.properties.is_active}" (${typeof b.properties.is_active})`);
      });
    }
  });

  if (zeroIssueCount === 0) {
    console.log('✅ All mock exams with total_bookings=0 have only Cancelled bookings (or no bookings).');
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80) + '\n');

  if (issueCount === 0 && zeroIssueCount === 0) {
    console.log('✅ No issues detected! All is_active values appear correct.');
  } else {
    console.log(`⚠️  Found ${issueCount + zeroIssueCount} potential issue(s) that may need attention.`);
  }

  return { byIsActive, mockExamsWithZero };
}

/**
 * Main diagnostic function
 */
async function runDiagnostic() {
  try {
    console.log('🔍 Starting is_active Diagnostic...\n');
    console.log('This script will check all bookings in HubSpot for incorrect is_active values.\n');

    // Step 1: Get all bookings
    const bookings = await getAllBookings();
    console.log(`✅ Found ${bookings.length} total bookings\n`);

    if (bookings.length === 0) {
      console.log('No bookings found in HubSpot. Exiting.');
      return;
    }

    // Step 2: Get mock exam associations
    const bookingIds = bookings.map(b => b.id);
    const associations = await getMockExamAssociations(bookingIds);
    console.log(`✅ Found ${associations.length} booking-to-mock-exam associations\n`);

    // Step 3: Get mock exam details
    const mockExamIds = [...new Set(associations
      .filter(a => a.to && a.to.length > 0)
      .map(a => a.to[0].toObjectId))];
    const mockExams = await getMockExamDetails(mockExamIds);
    console.log(`✅ Found ${mockExams.length} unique mock exams\n`);

    // Step 4: Analyze and report
    const results = analyzeIsActiveValues(bookings, associations, mockExams);

    // Return for programmatic use if needed
    return results;

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDiagnostic()
    .then(() => {
      console.log('\n✅ Diagnostic complete.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runDiagnostic, getAllBookings, analyzeIsActiveValues };
