/**
 * Migration Script: Populate Supabase Secondary Database from HubSpot
 *
 * Purpose: Initial population of Supabase read replica with contact credit data from HubSpot
 * Pattern: Same as bookings/exams - HubSpot is source of truth, Supabase is secondary DB
 *
 * Usage:
 *   node scripts/migrate-contact-credits-to-supabase.js [--dry-run] [--limit=N]
 *
 * Options:
 *   --dry-run    : Preview changes without writing to Supabase
 *   --limit=N    : Process only N contacts (for testing)
 *
 * Example:
 *   node scripts/migrate-contact-credits-to-supabase.js --dry-run --limit=10
 */

require('dotenv').config();
const { HubSpotService } = require('../user_root/api/_shared/hubspot');
const { syncContactCreditsToSupabase } = require('../user_root/api/_shared/supabase-data');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Credit properties to fetch
const CREDIT_PROPERTIES = [
  'student_id',
  'firstname',
  'lastname',
  'email',
  'sj_credits',
  'cs_credits',
  'sjmini_credits',
  'mock_discussion_token',
  'shared_mock_credits',
  'ndecc_exam_date',
  'hs_lastmodifieddate'
];

/**
 * Fetch all contacts with credit properties from HubSpot
 */
async function fetchAllContactsFromHubSpot() {
  const hubspot = new HubSpotService();
  let allContacts = [];
  let hasMore = true;
  let after = undefined;
  let page = 0;

  console.log('📥 Fetching contacts from HubSpot...\n');

  while (hasMore) {
    page++;

    const searchPayload = {
      filterGroups: [{
        filters: [{
          propertyName: 'student_id',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: CREDIT_PROPERTIES,
      limit: 100,
      after
    };

    const result = await hubspot.apiCall('POST', `/crm/v3/objects/contacts/search`, searchPayload);

    const contacts = result.results || [];
    allContacts.push(...contacts);

    console.log(`   Page ${page}: Fetched ${contacts.length} contacts (Total: ${allContacts.length})`);

    // Check if we've hit the limit
    if (limit && allContacts.length >= limit) {
      allContacts = allContacts.slice(0, limit);
      console.log(`   ⚠️ Limit of ${limit} contacts reached, stopping fetch\n`);
      break;
    }

    // Check for more pages
    after = result.paging?.next?.after;
    hasMore = !!after;

    // Rate limit throttle - wait 150ms between pages (6.67 pages/sec = safe)
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log(`✅ Total contacts fetched: ${allContacts.length}\n`);
  return allContacts;
}

/**
 * Sync contacts to Supabase secondary database
 * Populates the read replica with contact credit data
 */
async function syncContactsToSupabase(contacts, isDryRun) {
  console.log(`${isDryRun ? '🔍 DRY RUN: ' : '💾 '}Syncing ${contacts.length} contacts to Supabase secondary DB...\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const studentId = contact.properties.student_id;
    const email = contact.properties.email;

    try {
      if (!isDryRun) {
        await syncContactCreditsToSupabase(contact);
      }

      successCount++;

      // Log progress every 50 contacts
      if ((i + 1) % 50 === 0) {
        console.log(`   Progress: ${i + 1}/${contacts.length} contacts processed`);
      }
    } catch (error) {
      errorCount++;
      errors.push({
        studentId,
        email,
        error: error.message
      });

      console.error(`   ❌ Error syncing ${studentId} (${email}): ${error.message}`);
    }

    // Small delay to avoid overwhelming Supabase
    if (!isDryRun && i < contacts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 20 req/sec to Supabase
    }
  }

  return { successCount, errorCount, errors };
}

/**
 * Generate summary statistics
 */
function generateSummary(contacts) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));

  // Count contacts with various credit types
  const creditStats = {
    total: contacts.length,
    withSJCredits: 0,
    withCSCredits: 0,
    withMiniMockCredits: 0,
    withMockDiscussionCredits: 0,
    withSharedCredits: 0,
    withAnyCredits: 0
  };

  contacts.forEach(contact => {
    const props = contact.properties;
    const sj = parseInt(props.sj_credits) || 0;
    const cs = parseInt(props.cs_credits) || 0;
    const mini = parseInt(props.sjmini_credits) || 0;
    const discussion = parseInt(props.mock_discussion_token) || 0;
    const shared = parseInt(props.shared_mock_credits) || 0;

    if (sj > 0) creditStats.withSJCredits++;
    if (cs > 0) creditStats.withCSCredits++;
    if (mini > 0) creditStats.withMiniMockCredits++;
    if (discussion > 0) creditStats.withMockDiscussionCredits++;
    if (shared > 0) creditStats.withSharedCredits++;
    if (sj > 0 || cs > 0 || mini > 0 || discussion > 0 || shared > 0) {
      creditStats.withAnyCredits++;
    }
  });

  console.log(`\nTotal Contacts: ${creditStats.total}`);
  console.log(`Contacts with Any Credits: ${creditStats.withAnyCredits} (${((creditStats.withAnyCredits / creditStats.total) * 100).toFixed(1)}%)`);
  console.log(`\nCredit Type Breakdown:`);
  console.log(`   - SJ Credits: ${creditStats.withSJCredits}`);
  console.log(`   - CS Credits: ${creditStats.withCSCredits}`);
  console.log(`   - Mini-mock Credits: ${creditStats.withMiniMockCredits}`);
  console.log(`   - Mock Discussion Credits: ${creditStats.withMockDiscussionCredits}`);
  console.log(`   - Shared Credits: ${creditStats.withSharedCredits}`);
}

/**
 * Main migration function
 * Populates Supabase secondary database with HubSpot contact credit data
 */
async function runMigration() {
  console.log('🚀 Contact Credits Migration to Supabase Secondary DB');
  console.log('=' .repeat(60));
  console.log(`Pattern: HubSpot (source of truth) → Supabase (read replica)`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will write to Supabase)'}`);
  console.log(`Limit: ${limit ? `${limit} contacts` : 'All contacts'}`);
  console.log('=' .repeat(60) + '\n');

  const startTime = Date.now();

  try {
    // Step 1: Fetch all contacts from HubSpot
    const contacts = await fetchAllContactsFromHubSpot();

    if (contacts.length === 0) {
      console.log('⚠️ No contacts found with student_id property');
      return;
    }

    // Step 2: Generate summary statistics
    generateSummary(contacts);

    // Step 3: Sync to Supabase
    console.log('\n');
    const { successCount, errorCount, errors } = await syncContactsToSupabase(contacts, isDryRun);

    // Step 4: Final report
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n${isDryRun ? 'DRY RUN - ' : ''}Successfully processed: ${successCount}/${contacts.length}`);

    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
      console.log('\nError Details:');
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.studentId} (${err.email}): ${err.error}`);
      });
    }

    console.log(`\n⏱️ Duration: ${duration}s`);
    console.log(`📈 Rate: ${(contacts.length / parseFloat(duration)).toFixed(2)} contacts/second`);

    if (isDryRun) {
      console.log('\n💡 To perform actual migration, run without --dry-run flag');
    } else {
      console.log('\n✅ Contact credits are now in Supabase secondary database!');
      console.log('   Future validate-credits requests will read from Supabase (fast).');
      console.log('   Missing contacts will auto-populate from HubSpot on first read.');
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
runMigration().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
