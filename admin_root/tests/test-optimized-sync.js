/**
 * Test Script for Optimized Supabase Sync
 *
 * Usage:
 *   node tests/test-optimized-sync.js
 *
 * Environment Variables Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - HS_PRIVATE_APP_TOKEN
 */

const { syncAllData, getLastSyncTimestamp } = require('../api/_shared/supabaseSync.optimized');

async function testOptimizedSync() {
  console.log('🧪 Testing Optimized Supabase Sync\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check current sync timestamps
    console.log('\n📊 Step 1: Checking current sync state...');
    const lastExamSync = await getLastSyncTimestamp('mock_exams');
    const lastContactSync = await getLastSyncTimestamp('contact_credits');

    console.log(`   Last exam sync: ${lastExamSync ? new Date(parseInt(lastExamSync)).toISOString() : 'Never (will do full sync)'}`);
    console.log(`   Last contact sync: ${lastContactSync ? new Date(parseInt(lastContactSync)).toISOString() : 'Never (will do full sync)'}`);

    // Step 2: Run the sync
    console.log('\n🔄 Step 2: Running optimized sync...');
    const startTime = Date.now();

    const result = await syncAllData();

    const duration = Date.now() - startTime;

    // Step 3: Display results
    console.log('\n✅ Step 3: Sync Results\n');
    console.log('=' .repeat(60));
    console.log(`Mode:                  ${result.summary.sync_mode}`);
    console.log(`Exams Synced:          ${result.summary.exams_synced}`);
    console.log(`Bookings Synced:       ${result.summary.bookings_synced}`);
    console.log(`Contact Credits:       ${result.summary.contact_credits_synced}`);
    console.log(`Errors:                ${result.summary.errors_count}`);
    console.log(`Duration:              ${result.summary.duration_seconds}s`);
    console.log(`Completed At:          ${result.summary.completed_at}`);
    console.log('=' .repeat(60));

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. [${err.type}] ${err.error}`);
      });
    }

    // Step 4: Performance analysis
    console.log('\n📈 Step 4: Performance Analysis\n');
    console.log('=' .repeat(60));

    const avgTimePerExam = result.summary.exams_synced > 0
      ? (duration / result.summary.exams_synced).toFixed(0)
      : 0;

    const avgTimePerContact = result.summary.contact_credits_synced > 0
      ? (duration / result.summary.contact_credits_synced).toFixed(0)
      : 0;

    console.log(`Total Duration:        ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
    console.log(`Avg Time/Exam:         ${avgTimePerExam}ms`);
    console.log(`Avg Time/Contact:      ${avgTimePerContact}ms`);

    if (duration < 10000) {
      console.log('✅ PASS: Sync completed in <10s (excellent!)');
    } else if (duration < 30000) {
      console.log('⚠️  WARN: Sync took 10-30s (acceptable but could be faster)');
    } else {
      console.log('❌ FAIL: Sync took >30s (optimization needed)');
    }

    // Step 5: Recommendations
    console.log('\n💡 Step 5: Recommendations\n');
    console.log('=' .repeat(60));

    if (result.summary.sync_mode === 'full') {
      console.log('ℹ️  This was a FULL sync (first run)');
      console.log('   Next sync will be INCREMENTAL (much faster)');
      console.log('   Run this test again in 2 hours to see the improvement!');
    } else {
      console.log('✅ This was an INCREMENTAL sync');
      console.log(`   Only ${result.summary.exams_synced} exams modified since last sync`);
      console.log(`   Only ${result.summary.contact_credits_synced} contacts modified`);

      if (result.summary.exams_synced === 0 && result.summary.contact_credits_synced === 0) {
        console.log('   💡 No changes detected - sync will be instant!');
      }
    }

    // Step 6: Check new timestamps
    console.log('\n📊 Step 6: Updated sync timestamps\n');
    console.log('=' .repeat(60));
    const newExamSync = await getLastSyncTimestamp('mock_exams');
    const newContactSync = await getLastSyncTimestamp('contact_credits');

    console.log(`   New exam sync timestamp:    ${newExamSync ? new Date(parseInt(newExamSync)).toISOString() : 'Not updated'}`);
    console.log(`   New contact sync timestamp: ${newContactSync ? new Date(parseInt(newContactSync)).toISOString() : 'Not updated'}`);

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Test completed successfully!');
    console.log('=' .repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testOptimizedSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
