/**
 * Fix Script: Recalculate total_bookings for ALL Mock Exams
 *
 * This script recalculates the total_bookings property for all active mock exams
 * by counting actual active booking associations.
 *
 * Usage: node tests/manual/fix-all-mock-exam-counts.js
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
 * Get all mock exams
 */
async function getAllMockExams() {
  console.log('📊 Fetching all mock exams...\n');

  const searchPayload = {
    filterGroups: [],
    properties: ['exam_date', 'mock_type', 'capacity', 'total_bookings', 'is_active'],
    limit: 100
  };

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      searchPayload
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch mock exams:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get associations for a mock exam
 */
async function getMockExamAssociations(mockExamId) {
  try {
    const response = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/associations/${HUBSPOT_OBJECTS.bookings}`
    );

    return response.data.results || [];
  } catch (error) {
    if (error.response?.status === 404) {
      return []; // No associations
    }
    console.error(`❌ Failed to get associations for ${mockExamId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get booking details for multiple bookings
 */
async function getBatchBookings(bookingIds) {
  if (bookingIds.length === 0) return [];

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/batch/read`,
      {
        inputs: bookingIds.map(id => ({ id })),
        properties: ['booking_id', 'is_active', 'name']
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to batch read bookings:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Count active bookings (exclude only Cancelled and false)
 * Note: Completed bookings ARE counted
 */
function countActiveBookings(bookings) {
  return bookings.filter(booking => {
    const isActive = booking.properties.is_active;
    // Exclude only Cancelled and false
    // Completed bookings ARE counted
    const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
    const isFalse = isActive === false || isActive === 'false';

    return !isCancelled && !isFalse;
  }).length;
}

/**
 * Update mock exam total_bookings
 */
async function updateMockExamBookings(mockExamId, newTotal) {
  try {
    await hubspotApi.patch(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`,
      {
        properties: {
          total_bookings: newTotal.toString()
        }
      }
    );
  } catch (error) {
    console.error(`❌ Failed to update mock exam ${mockExamId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fix a single mock exam
 */
async function fixMockExam(mockExam) {
  const mockExamId = mockExam.id;
  const currentTotal = parseInt(mockExam.properties.total_bookings) || 0;

  console.log(`\n📋 Processing: ${mockExam.properties.mock_type} - ${mockExam.properties.exam_date}`);
  console.log(`   ID: ${mockExamId}`);
  console.log(`   Current total_bookings: ${currentTotal}`);

  // Get associations
  const associations = await getMockExamAssociations(mockExamId);
  console.log(`   Total associations: ${associations.length}`);

  if (associations.length === 0) {
    if (currentTotal !== 0) {
      console.log(`   ⚠️  No associations but total_bookings = ${currentTotal}, updating to 0`);
      await updateMockExamBookings(mockExamId, 0);
      return { updated: true, oldValue: currentTotal, newValue: 0 };
    } else {
      console.log(`   ✅ No associations, total_bookings already 0`);
      return { updated: false, oldValue: currentTotal, newValue: 0 };
    }
  }

  // Get booking details
  const bookingIds = associations.map(a => a.toObjectId);
  const bookings = await getBatchBookings(bookingIds);

  console.log(`   Retrieved ${bookings.length} booking objects`);

  // Count active bookings (excludes only Cancelled and false)
  const activeCount = countActiveBookings(bookings);

  const countedBookingsList = bookings.filter(b => {
    const isActive = b.properties.is_active;
    const isCancelled = isActive === 'Cancelled' || isActive === 'cancelled';
    const isFalse = isActive === false || isActive === 'false';
    return !isCancelled && !isFalse;
  });

  console.log(`   Counted bookings (Active + Completed): ${activeCount}`);
  if (activeCount > 0) {
    console.log(`   Counted booking IDs:`, countedBookingsList.map(b =>
      `${b.id} (${b.properties.booking_id}) - ${b.properties.is_active}`
    ));
  }

  const cancelledBookings = bookings.filter(b =>
    b.properties.is_active === 'Cancelled' || b.properties.is_active === 'cancelled'
  );
  if (cancelledBookings.length > 0) {
    console.log(`   Cancelled bookings (excluded): ${cancelledBookings.length}`);
  }

  const completedBookings = bookings.filter(b =>
    b.properties.is_active === 'Completed' || b.properties.is_active === 'completed'
  );
  if (completedBookings.length > 0) {
    console.log(`   Completed bookings (COUNTED): ${completedBookings.length}`);
  }

  // Update if needed
  if (activeCount !== currentTotal) {
    console.log(`   🔄 UPDATING: ${currentTotal} → ${activeCount}`);
    await updateMockExamBookings(mockExamId, activeCount);
    console.log(`   ✅ Updated successfully`);
    return { updated: true, oldValue: currentTotal, newValue: activeCount };
  } else {
    console.log(`   ✅ Already correct (${activeCount})`);
    return { updated: false, oldValue: currentTotal, newValue: activeCount };
  }
}

/**
 * Main function
 */
async function fixAllMockExams() {
  console.log('🔧 Starting Mock Exam Count Fix...\n');
  console.log('This script will recalculate total_bookings for all mock exams.\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Get all mock exams
    const mockExams = await getAllMockExams();
    console.log(`✅ Found ${mockExams.length} mock exams\n`);

    if (mockExams.length === 0) {
      console.log('No mock exams to process.');
      return;
    }

    // Process each mock exam
    const results = [];
    for (const mockExam of mockExams) {
      try {
        const result = await fixMockExam(mockExam);
        results.push({
          id: mockExam.id,
          mock_type: mockExam.properties.mock_type,
          exam_date: mockExam.properties.exam_date,
          ...result
        });
      } catch (error) {
        console.error(`\n❌ Failed to process mock exam ${mockExam.id}:`, error.message);
        results.push({
          id: mockExam.id,
          mock_type: mockExam.properties.mock_type,
          exam_date: mockExam.properties.exam_date,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80) + '\n');

    const updated = results.filter(r => r.updated === true);
    const unchanged = results.filter(r => r.updated === false);
    const errors = results.filter(r => r.error);

    console.log(`Total mock exams processed: ${results.length}`);
    console.log(`✅ Updated: ${updated.length}`);
    console.log(`⏭️  Unchanged (already correct): ${unchanged.length}`);
    console.log(`❌ Errors: ${errors.length}\n`);

    if (updated.length > 0) {
      console.log('📝 Updated Mock Exams:');
      updated.forEach(r => {
        console.log(`   ${r.mock_type} (${r.exam_date}): ${r.oldValue} → ${r.newValue}`);
      });
      console.log('');
    }

    if (errors.length > 0) {
      console.log('❌ Errors:');
      errors.forEach(r => {
        console.log(`   ${r.mock_type} (${r.exam_date}): ${r.error}`);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('✅ Fix complete!\n');

  } catch (error) {
    console.error('\n❌ Fix failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixAllMockExams()
    .then(() => {
      console.log('✅ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fixAllMockExams };
