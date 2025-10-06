/**
 * Migration Script: Clean up duplicate associations
 *
 * This script removes duplicate associations between Bookings and Mock Exams
 * that were created with different association types (1277 vs 1292).
 *
 * It keeps only the Type 1277 associations which work correctly for retrieval.
 *
 * Usage: node tests/manual/cleanup-duplicate-associations.js [--dry-run]
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

const isDryRun = process.argv.includes('--dry-run');

async function getAllMockExams() {
  console.log('📊 Fetching all mock exams...');

  const searchPayload = {
    filterGroups: [],
    properties: ['mock_type', 'exam_date', 'hs_object_id'],
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

async function getAssociationsForMockExam(mockExamId) {
  try {
    const response = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/associations/${HUBSPOT_OBJECTS.bookings}`
    );

    return response.data.results || [];
  } catch (error) {
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
}

async function cleanupDuplicateAssociations() {
  console.log('🧹 Starting duplicate associations cleanup...');
  if (isDryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made\n');
  }

  const stats = {
    mockExamsChecked: 0,
    duplicatesFound: 0,
    associationsRemoved: 0,
    errors: 0
  };

  try {
    // Get all mock exams
    const mockExams = await getAllMockExams();
    console.log(`✅ Found ${mockExams.length} mock exam(s)\n`);

    for (const mockExam of mockExams) {
      stats.mockExamsChecked++;
      const mockExamName = `${mockExam.properties.mock_type} - ${mockExam.properties.exam_date}`;
      console.log(`\n📋 Checking Mock Exam: ${mockExamName} (ID: ${mockExam.id})`);

      // Get all associations for this mock exam
      const associations = await getAssociationsForMockExam(mockExam.id);

      if (associations.length === 0) {
        console.log('  No bookings associated');
        continue;
      }

      // Group associations by booking ID
      const bookingMap = new Map();

      associations.forEach(assoc => {
        const bookingId = assoc.toObjectId;
        if (!bookingMap.has(bookingId)) {
          bookingMap.set(bookingId, []);
        }
        bookingMap.get(bookingId).push(assoc);
      });

      // Check for duplicates
      for (const [bookingId, bookingAssocs] of bookingMap.entries()) {
        if (bookingAssocs.length > 1 ||
            (bookingAssocs[0].associationTypes && bookingAssocs[0].associationTypes.length > 1)) {
          stats.duplicatesFound++;
          console.log(`  ⚠️ Found duplicate/multiple associations for booking ${bookingId}`);

          // Collect all association types
          const typeMap = new Map();
          bookingAssocs.forEach(assoc => {
            if (assoc.associationTypes) {
              assoc.associationTypes.forEach(type => {
                typeMap.set(type.typeId, type);
              });
            }
          });

          if (typeMap.size > 1) {
            console.log(`    Multiple association types found:`);
            typeMap.forEach(type => {
              console.log(`      - Type ${type.typeId}: ${type.label || 'Unlabeled'} (${type.category})`);
            });

            // If we have Type 1292 ("Mock Bookings"), we need to remove it and keep Type 1277
            if (typeMap.has(1292)) {
              console.log(`    🔧 Action: Remove Type 1292 "Mock Bookings" association`);

              if (!isDryRun) {
                try {
                  // Remove the specific association type
                  // Note: We need to recreate with only Type 1277
                  console.log(`    Recreating association with only Type 1277...`);

                  // First, delete all associations
                  await hubspotApi.delete(
                    `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExam.id}/associations/${HUBSPOT_OBJECTS.bookings}/${bookingId}`
                  );

                  // Then recreate with empty payload (defaults to Type 1277)
                  await hubspotApi.put(
                    `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExam.id}/associations/${HUBSPOT_OBJECTS.bookings}/${bookingId}`,
                    []  // Empty payload for default Type 1277
                  );

                  console.log(`    ✅ Fixed association for booking ${bookingId}`);
                  stats.associationsRemoved++;
                } catch (error) {
                  console.error(`    ❌ Failed to fix association: ${error.message}`);
                  stats.errors++;
                }
              } else {
                console.log(`    [DRY RUN] Would recreate association with Type 1277 only`);
              }
            }
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Mock Exams checked: ${stats.mockExamsChecked}`);
    console.log(`Duplicate associations found: ${stats.duplicatesFound}`);

    if (!isDryRun) {
      console.log(`Associations fixed: ${stats.associationsRemoved}`);
      console.log(`Errors: ${stats.errors}`);

      if (stats.associationsRemoved > 0) {
        console.log('\n✅ Cleanup completed successfully!');
        console.log('All duplicate Type 1292 associations have been replaced with Type 1277.');
      }
    } else {
      console.log(`\n📋 DRY RUN COMPLETE`);
      console.log(`Would fix ${stats.duplicatesFound} duplicate association(s)`);
      console.log(`\nRun without --dry-run flag to apply changes.`);
    }

    return true;

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

// Main execution
async function main() {
  const success = await cleanupDuplicateAssociations();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { cleanupDuplicateAssociations };