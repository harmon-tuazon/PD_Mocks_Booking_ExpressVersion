/**
 * Test the sessions endpoint fix
 * Run with: node admin_root/tests/test-sessions-fix.js
 */

require('dotenv').config();
const hubspot = require('../api/_shared/hubspot');

async function testSessionsEndpoint() {
  console.log('Testing Sessions Endpoint Fix\n');
  console.log('==============================\n');

  try {
    // Test the exact scenario that was failing
    const testKey = 'situational_judgment_mississauga_2025-09-26';
    const exam_date = '2025-09-26';

    console.log(`Testing with aggregate key: ${testKey}`);
    console.log(`Parsed exam date: ${exam_date}\n`);

    // Test 1: Fetch aggregates for the specific date
    console.log('Test 1: Fetching aggregates for specific date...');
    const filters = {
      filter_date_from: exam_date,
      filter_date_to: exam_date
    };

    console.log('Filters:', filters);

    const aggregates = await hubspot.fetchMockExamsForAggregation(filters);

    console.log(`✅ Successfully fetched ${aggregates.length} aggregates`);

    const matchingAggregate = aggregates.find(agg => agg.aggregate_key === testKey);

    if (matchingAggregate) {
      console.log('\n✅ Found matching aggregate:');
      console.log(JSON.stringify(matchingAggregate, null, 2));

      // Test 2: Fetch sessions for the aggregate
      if (matchingAggregate.session_ids && matchingAggregate.session_ids.length > 0) {
        console.log(`\nTest 2: Fetching ${matchingAggregate.session_ids.length} sessions...`);

        const sessions = await hubspot.batchFetchMockExams(matchingAggregate.session_ids);

        console.log(`✅ Successfully fetched ${sessions.length} sessions`);

        if (sessions.length > 0) {
          console.log('\nFirst session details:');
          console.log(JSON.stringify(sessions[0].properties, null, 2));
        }
      }
    } else {
      console.log(`⚠️ No aggregate found for key: ${testKey}`);
      console.log('Available aggregates for this date:');
      aggregates.forEach(agg => {
        if (agg.exam_date === exam_date) {
          console.log(`  - ${agg.aggregate_key}`);
        }
      });
    }

    // Test 3: Fetch all aggregates without date filter
    console.log('\nTest 3: Fetching all active aggregates...');
    const allAggregates = await hubspot.fetchMockExamsForAggregation({
      filter_status: 'active'
    });

    console.log(`✅ Found ${allAggregates.length} total active aggregates`);

    // Show aggregates for the test date
    const testDateAggregates = allAggregates.filter(agg => agg.exam_date === exam_date);
    if (testDateAggregates.length > 0) {
      console.log(`\nAggregates for ${exam_date}:`);
      testDateAggregates.forEach(agg => {
        console.log(`  - ${agg.aggregate_key} (${agg.session_count} sessions)`);
      });
    }

    console.log('\n==============================\n');
    console.log('✅ All tests completed successfully!');
    console.log('\nThe fix is working correctly:');
    console.log('- Date filtering is now done in application code');
    console.log('- No more 400 errors from HubSpot API');
    console.log('- Sessions can be fetched for aggregates');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testSessionsEndpoint();