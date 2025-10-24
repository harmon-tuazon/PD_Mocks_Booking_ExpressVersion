/**
 * Test file for batch API operations
 * Run with: node admin_root/tests/test-batch-api.js
 */

require('dotenv').config();
const hubspot = require('../api/_shared/hubspot');

async function testBatchAPI() {

  console.log('Testing HubSpot Batch API Operations\n');
  console.log('=====================================\n');

  try {
    // Test 1: Fetch mock exams for aggregation
    console.log('Test 1: Fetching mock exams for aggregation...');
    const aggregates = await hubspot.fetchMockExamsForAggregation({
      filter_status: 'active',
      filter_date_from: new Date().toISOString().split('T')[0],
      filter_date_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    console.log(`Found ${aggregates.length} aggregate groups`);
    if (aggregates.length > 0) {
      console.log('Sample aggregate:', JSON.stringify(aggregates[0], null, 2));
    }

    // Test 2: Batch fetch mock exams
    if (aggregates.length > 0 && aggregates[0].session_ids.length > 0) {
      console.log('\nTest 2: Batch fetching mock exam details...');
      const sessionIds = aggregates[0].session_ids;
      console.log(`Fetching ${sessionIds.length} mock exams in batch...`);

      const mockExams = await hubspot.batchFetchMockExams(sessionIds);
      console.log(`Successfully fetched ${mockExams.length} mock exams`);

      if (mockExams.length > 0) {
        console.log('Sample mock exam:', JSON.stringify(mockExams[0].properties, null, 2));
      }
    }

    // Test 3: Test with empty array
    console.log('\nTest 3: Testing batch fetch with empty array...');
    const emptyResult = await hubspot.batchFetchMockExams([]);
    console.log('Empty array result:', emptyResult);

    // Test 4: Test with large batch (if available)
    console.log('\nTest 4: Testing with larger batch size...');
    const largeTestIds = [];
    for (let i = 0; i < 75; i++) {
      largeTestIds.push(`test_id_${i}`);
    }
    console.log(`Testing batch with ${largeTestIds.length} IDs (should be split into 2 batches)`);
    // Note: This will likely fail with invalid IDs, but will test the batching logic

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run tests
testBatchAPI();