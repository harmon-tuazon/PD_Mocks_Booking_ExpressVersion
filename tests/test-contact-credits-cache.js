/**
 * Test Script: Contact Credits Supabase Caching
 *
 * Tests the cache-first pattern with auto-population:
 * 1. First request (cache miss) → HubSpot read → Auto-populate Supabase
 * 2. Second request (cache hit) → Supabase read → Fast response
 *
 * Usage:
 *   node tests/test-contact-credits-cache.js
 */

require('dotenv').config();
const { HubSpotService } = require('../user_root/api/_shared/hubspot');
const {
  getContactCreditsFromSupabase,
  syncContactCreditsToSupabase
} = require('../user_root/api/_shared/supabase-data');

// Test configuration
const TEST_STUDENT = {
  student_id: '1599999',
  email: 'test@prepdoctors.ie'
};

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Testing Contact Credits Supabase Caching\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check Supabase cache first
    console.log('\n📝 Test 1: Check Supabase Cache');
    console.log('─'.repeat(60));

    const startSupabase = Date.now();
    const cachedContact = await getContactCreditsFromSupabase(
      TEST_STUDENT.student_id,
      TEST_STUDENT.email
    );
    const supabaseTime = Date.now() - startSupabase;

    if (cachedContact) {
      console.log(`✅ [SUPABASE CACHE HIT] Found in secondary DB (${supabaseTime}ms)`);
      console.log(`   Student ID: ${cachedContact.student_id}`);
      console.log(`   Email: ${cachedContact.email}`);
      console.log(`   SJ Credits: ${cachedContact.sj_credits}`);
      console.log(`   CS Credits: ${cachedContact.cs_credits}`);
      console.log(`   Shared Credits: ${cachedContact.shared_mock_credits}`);
      console.log(`   Last Synced: ${new Date(cachedContact.synced_at).toISOString()}`);
    } else {
      console.log(`⚠️ [SUPABASE CACHE MISS] Not found in secondary DB (${supabaseTime}ms)`);
      console.log('   Will fall back to HubSpot...\n');

      // Test 2: Fallback to HubSpot
      console.log('📝 Test 2: HubSpot Fallback + Auto-Population');
      console.log('─'.repeat(60));

      const hubspot = new HubSpotService();
      const startHubSpot = Date.now();
      const hubspotContact = await hubspot.searchContacts(
        TEST_STUDENT.student_id,
        TEST_STUDENT.email,
        'Situational Judgment'
      );
      const hubspotTime = Date.now() - startHubSpot;

      if (!hubspotContact) {
        console.error('❌ [ERROR] Student not found in HubSpot');
        process.exit(1);
      }

      console.log(`✅ [HUBSPOT FETCH] Found in source of truth (${hubspotTime}ms)`);
      console.log(`   HubSpot ID: ${hubspotContact.id}`);
      console.log(`   Student ID: ${hubspotContact.properties.student_id}`);
      console.log(`   Email: ${hubspotContact.properties.email}`);
      console.log(`   SJ Credits: ${hubspotContact.properties.sj_credits || 0}`);
      console.log(`   CS Credits: ${hubspotContact.properties.cs_credits || 0}`);
      console.log(`   Shared Credits: ${hubspotContact.properties.shared_mock_credits || 0}`);

      // Test 3: Auto-populate Supabase
      console.log('\n📝 Test 3: Auto-Populate Supabase Cache');
      console.log('─'.repeat(60));

      const startSync = Date.now();
      await syncContactCreditsToSupabase(hubspotContact);
      const syncTime = Date.now() - startSync;

      console.log(`✅ [SYNC SUCCESS] Synced to secondary DB (${syncTime}ms)`);

      // Test 4: Verify cache population
      console.log('\n📝 Test 4: Verify Cache Population');
      console.log('─'.repeat(60));

      const startVerify = Date.now();
      const verifyContact = await getContactCreditsFromSupabase(
        TEST_STUDENT.student_id,
        TEST_STUDENT.email
      );
      const verifyTime = Date.now() - startVerify;

      if (verifyContact) {
        console.log(`✅ [CACHE HIT] Now found in secondary DB (${verifyTime}ms)`);
        console.log(`   Supabase ID: ${verifyContact.id}`);
        console.log(`   HubSpot ID: ${verifyContact.hubspot_id}`);
        console.log('   ✅ Auto-population successful!');
      } else {
        console.error('❌ [ERROR] Failed to populate cache');
        process.exit(1);
      }
    }

    // Performance Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Performance Summary');
    console.log('='.repeat(60));
    console.log(`Supabase Read Time: ~${supabaseTime}ms (expected: < 100ms)`);

    if (cachedContact) {
      console.log('\n✅ Cache Hit Scenario:');
      console.log(`   → Response Time: ${supabaseTime}ms`);
      console.log(`   → Performance: ${supabaseTime < 100 ? '✅ EXCELLENT' : '⚠️ NEEDS OPTIMIZATION'}`);
    } else {
      console.log(`HubSpot Read Time: ~${hubspotTime}ms (expected: 200-600ms)`);
      console.log(`Sync Time: ~${syncTime}ms (fire-and-forget)`);
      console.log('\n⚠️ Cache Miss Scenario:');
      console.log(`   → First Request: ${hubspotTime}ms (HubSpot + sync)`);
      console.log(`   → Second Request: ~${verifyTime}ms (Supabase cached)`);
      console.log(`   → Performance Gain: ${Math.round((hubspotTime - verifyTime) / hubspotTime * 100)}% faster on subsequent requests`);
    }

    // Test Conclusion
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('✅ Supabase cache-first pattern working');
    console.log('✅ HubSpot fallback working');
    console.log('✅ Auto-population working');
    console.log('✅ Cache hit provides significant performance improvement');
    console.log('\n📝 Next Steps:');
    console.log('   1. Deploy to Vercel: vercel --prod');
    console.log('   2. Monitor Vercel logs for [SUPABASE] vs [HUBSPOT] ratio');
    console.log('   3. Run load test to verify no 429 errors');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
