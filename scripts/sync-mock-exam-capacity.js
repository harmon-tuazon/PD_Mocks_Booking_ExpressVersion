#!/usr/bin/env node

/**
 * Manual Sync Script for Mock Exam Capacity
 *
 * This script recalculates the total_bookings property for all active mock exams
 * by counting actual active booking associations, fixing any discrepancies caused
 * by deleted bookings.
 *
 * Usage:
 *   node scripts/sync-mock-exam-capacity.js                  # Sync all active mock exams
 *   node scripts/sync-mock-exam-capacity.js --exam-id=12345  # Sync specific mock exam
 *   node scripts/sync-mock-exam-capacity.js --dry-run        # Preview changes without updating
 */

require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../admin_root/api/_shared/hubspot');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
  const [key, value] = arg.split('=');
  options[key.replace('--', '')] = value || true;
});

const DRY_RUN = options['dry-run'] === true;
const SPECIFIC_EXAM_ID = options['exam-id'];

console.log('='.repeat(60));
console.log('Mock Exam Capacity Sync Utility');
console.log('='.repeat(60));
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
console.log(`Target: ${SPECIFIC_EXAM_ID ? `Exam ID ${SPECIFIC_EXAM_ID}` : 'All active mock exams'}`);
console.log('='.repeat(60));

/**
 * Fetch all active mock exams
 */
async function fetchAllActiveMockExams(hubspot) {
  const allExams = [];
  let after = null;
  const limit = 100;

  do {
    const searchPayload = {
      filterGroups: [{
        filters: [{
          propertyName: 'is_active',
          operator: 'EQ',
          value: 'true'
        }]
      }],
      properties: [
        'exam_date',
        'capacity',
        'total_bookings',
        'mock_type',
        'location',
        'hs_object_id'
      ],
      limit,
      after
    };

    const result = await hubspot.apiCall(
      'POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      searchPayload
    );

    if (result.results) {
      allExams.push(...result.results);
    }

    after = result.paging?.next?.after || null;
  } while (after);

  return allExams;
}

/**
 * Sync capacity for a single mock exam
 */
async function syncMockExamCapacity(hubspot, exam) {
  const examId = exam.id;
  const currentStoredCount = parseInt(exam.properties.total_bookings) || 0;

  console.log(`\nProcessing: ${exam.properties.mock_type} - ${exam.properties.exam_date} (ID: ${examId})`);
  console.log(`  Current stored count: ${currentStoredCount}`);

  try {
    // Get actual active bookings count
    const actualCount = await hubspot.getActiveBookingsCount(examId);
    console.log(`  Actual active bookings: ${actualCount}`);

    const capacity = parseInt(exam.properties.capacity) || 0;
    const availableSlots = Math.max(0, capacity - actualCount);

    if (actualCount !== currentStoredCount) {
      console.log(`  ⚠️  DISCREPANCY FOUND: Difference of ${actualCount - currentStoredCount}`);
      console.log(`  Available slots: ${availableSlots} / ${capacity}`);

      if (!DRY_RUN) {
        await hubspot.updateMockExamBookings(examId, actualCount);
        console.log(`  ✅ Updated total_bookings to ${actualCount}`);
      } else {
        console.log(`  🔍 DRY RUN: Would update total_bookings from ${currentStoredCount} to ${actualCount}`);
      }

      return {
        examId,
        examDate: exam.properties.exam_date,
        mockType: exam.properties.mock_type,
        previousCount: currentStoredCount,
        actualCount,
        difference: actualCount - currentStoredCount,
        updated: !DRY_RUN
      };
    } else {
      console.log(`  ✓ No update needed - count is accurate`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error processing exam ${examId}:`, error.message);
    return {
      examId,
      examDate: exam.properties.exam_date,
      mockType: exam.properties.mock_type,
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Verify environment variables
    if (!process.env.HS_PRIVATE_APP_TOKEN) {
      throw new Error('HS_PRIVATE_APP_TOKEN environment variable is required');
    }

    const hubspot = new HubSpotService();

    let examsToProcess = [];

    if (SPECIFIC_EXAM_ID) {
      // Fetch specific exam
      console.log(`\nFetching mock exam ${SPECIFIC_EXAM_ID}...`);
      const exam = await hubspot.getMockExam(SPECIFIC_EXAM_ID);
      if (exam) {
        examsToProcess = [exam];
      } else {
        throw new Error(`Mock exam ${SPECIFIC_EXAM_ID} not found`);
      }
    } else {
      // Fetch all active exams
      console.log('\nFetching all active mock exams...');
      examsToProcess = await fetchAllActiveMockExams(hubspot);
      console.log(`Found ${examsToProcess.length} active mock exams`);
    }

    if (examsToProcess.length === 0) {
      console.log('No mock exams to process');
      return;
    }

    // Process each exam
    const results = [];
    for (const exam of examsToProcess) {
      const result = await syncMockExamCapacity(hubspot, exam);
      if (result) {
        results.push(result);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(60));

    const updated = results.filter(r => !r.error);
    const errors = results.filter(r => r.error);

    console.log(`Total exams processed: ${examsToProcess.length}`);
    console.log(`Exams with discrepancies: ${updated.length}`);
    console.log(`Exams with errors: ${errors.length}`);

    if (updated.length > 0) {
      console.log('\nUpdated Exams:');
      console.log('-'.repeat(60));

      updated.forEach(result => {
        console.log(`${result.mockType} - ${result.examDate}`);
        console.log(`  Previous: ${result.previousCount}, Actual: ${result.actualCount} (${result.difference > 0 ? '+' : ''}${result.difference})`);
        console.log(`  Status: ${result.updated ? 'Updated ✅' : 'Dry Run 🔍'}`);
      });
    }

    if (errors.length > 0) {
      console.log('\nErrors:');
      console.log('-'.repeat(60));

      errors.forEach(result => {
        console.log(`${result.mockType} - ${result.examDate}: ${result.error}`);
      });
    }

    // Calculate totals
    const totalDifference = updated.reduce((sum, r) => sum + Math.abs(r.difference), 0);
    console.log('\n' + '-'.repeat(60));
    console.log(`Total booking count corrections: ${totalDifference}`);

    if (DRY_RUN) {
      console.log('\n📋 DRY RUN COMPLETE - No changes were made');
      console.log('Run without --dry-run flag to apply these changes');
    } else {
      console.log('\n✅ SYNC COMPLETE - All changes applied');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().then(() => {
    console.log('\n' + '='.repeat(60));
    process.exit(0);
  }).catch(error => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
}

module.exports = { syncMockExamCapacity, fetchAllActiveMockExams };