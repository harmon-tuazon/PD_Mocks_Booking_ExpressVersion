/**
 * Migration Script: Populate Supabase Secondary Database from HubSpot
 *
 * Purpose: Initial population of Supabase read replica with contact credit data from HubSpot
 * Pattern: Same as bookings/exams - HubSpot is source of truth, Supabase is secondary DB
 *
 * Usage:
 *   node scripts/migrate-contact-credits-to-supabase.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

// Environment validation
if (!process.env.HS_PRIVATE_APP_TOKEN) {
  console.error('❌ Missing HS_PRIVATE_APP_TOKEN in environment');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

// HubSpot API configuration
const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Supabase client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: process.env.SUPABASE_SCHEMA_NAME || 'public' }
  }
);

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
 * HubSpot API call helper
 */
async function hubspotApiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch all contacts with credit properties from HubSpot
 * ONLY fetches contacts that have at least one credit > 0
 * Uses batched approach to avoid 10k limit on search API pagination
 */
async function fetchAllContactsFromHubSpot() {
  const allContacts = [];
  let after = undefined;
  let totalFetched = 0;

  console.log('📥 Fetching contacts with credits from HubSpot...\n');

  do {
    const searchPayload = {
      filterGroups: [
        // Filter Group 1: Has student_id AND has SJ credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sj_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 2: Has student_id AND has CS credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'cs_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 3: Has student_id AND has Mini-mock credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'sjmini_credits', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 4: Has student_id AND has Discussion token > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'mock_discussion_token', operator: 'GT', value: '0' }
          ]
        },
        // Filter Group 5: Has student_id AND has Shared credits > 0
        {
          filters: [
            { propertyName: 'student_id', operator: 'HAS_PROPERTY' },
            { propertyName: 'shared_mock_credits', operator: 'GT', value: '0' }
          ]
        }
      ],
      properties: CREDIT_PROPERTIES,
      limit: 100,
      sorts: [
        { propertyName: 'hs_object_id', direction: 'ASCENDING' }
      ]
    };

    if (after) {
      searchPayload.after = after;
    }

    try {
      const response = await hubspotApiCall('POST', `/crm/v3/objects/contacts/search`, searchPayload);

      const results = response.results || [];
      allContacts.push(...results);
      totalFetched += results.length;

      after = response.paging?.next?.after;

      console.log(`  Fetched ${totalFetched} contacts so far...`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      // If we hit the 10k limit, we've likely got all contacts
      if (error.message.includes('400') && totalFetched >= 10000) {
        console.log(`  ⚠️ Hit HubSpot 10k search limit at ${totalFetched} contacts`);
        console.log(`  This is expected - HubSpot search API has a 10k result maximum`);
        break;
      }
      throw error;
    }

  } while (after);

  console.log(`✅ Fetched ${allContacts.length} total contacts\n`);
  return allContacts;
}

/**
 * Sync a single contact to Supabase
 */
async function syncContactToSupabase(contact) {
  if (!contact || !contact.properties) {
    throw new Error('Invalid contact object');
  }

  const props = contact.properties;

  const record = {
    hubspot_id: contact.id,
    student_id: props.student_id,
    email: props.email?.toLowerCase(),
    firstname: props.firstname,
    lastname: props.lastname,
    sj_credits: parseInt(props.sj_credits) || 0,
    cs_credits: parseInt(props.cs_credits) || 0,
    sjmini_credits: parseInt(props.sjmini_credits) || 0,
    mock_discussion_token: parseInt(props.mock_discussion_token) || 0,
    shared_mock_credits: parseInt(props.shared_mock_credits) || 0,
    ndecc_exam_date: props.ndecc_exam_date,
    updated_at: props.hs_lastmodifieddate || new Date().toISOString(),
    synced_at: new Date().toISOString()
  };

  const { error } = await supabaseAdmin
    .from('hubspot_contact_credits')
    .upsert(record, { onConflict: 'hubspot_id' });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
}

/**
 * Generate summary statistics
 */
function generateSummary(contacts) {
  console.log('📊 Summary Statistics\n');

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

  console.log(`Total Contacts: ${creditStats.total}`);
  console.log(`Contacts with Any Credits: ${creditStats.withAnyCredits} (${((creditStats.withAnyCredits / creditStats.total) * 100).toFixed(1)}%)`);
  console.log(`\nCredit Type Breakdown:`);
  console.log(`   - SJ Credits: ${creditStats.withSJCredits}`);
  console.log(`   - CS Credits: ${creditStats.withCSCredits}`);
  console.log(`   - Mini-mock Credits: ${creditStats.withMiniMockCredits}`);
  console.log(`   - Mock Discussion Credits: ${creditStats.withMockDiscussionCredits}`);
  console.log(`   - Shared Credits: ${creditStats.withSharedCredits}\n`);
}

/**
 * Main migration function
 */
async function runMigration() {
  const startTime = Date.now();
  const errors = [];

  console.log('=' .repeat(60));
  console.log('🚀 Contact Credits Migration to Supabase Secondary DB');
  console.log('=' .repeat(60));
  console.log('Pattern: HubSpot (source of truth) → Supabase (read replica)\n');

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
    console.log('💾 Syncing contacts to Supabase...\n');

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        await syncContactToSupabase(contact);

        // Log progress every 10 contacts
        if ((i + 1) % 10 === 0) {
          console.log(`  Progress: ${i + 1}/${contacts.length} contacts synced`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to sync contact ${contact.id}: ${error.message}`);
        errors.push({
          type: 'contact',
          id: contact.id,
          studentId: contact.properties.student_id,
          error: error.message
        });
      }
    }

    // Step 4: Final report
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Migration Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   - Contacts: ${contacts.length}`);
    console.log(`   - Errors: ${errors.length}`);
    console.log(`   - Duration: ${duration}s`);

    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(err => {
        console.log(`   - ${err.type} ${err.id} (${err.studentId}): ${err.error}`);
      });
    }

    console.log('\n✅ Contact credits are now in Supabase secondary database!');
    console.log('   Future validate-credits requests will read from Supabase (fast).');
    console.log('   Missing contacts will auto-populate from HubSpot on first read.');
    console.log('=' .repeat(60) + '\n');

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
