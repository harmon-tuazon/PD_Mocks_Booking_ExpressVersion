/**
 * Diagnose HubSpot API Filter Issues
 * Tests various filter combinations to identify which ones work
 */

require('dotenv').config();

const HUBSPOT_TOKEN = "pat-na1-4f68ab6a-9ffd-4843-8e69-728813a013a2";
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';
const MOCK_EXAMS_OBJECT_TYPE = '2-50158913';

/**
 * Make HubSpot API call with error handling
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

  const url = `${HUBSPOT_BASE_URL}${endpoint}`;
  console.log(`\n📡 Making request to: ${url}`);
  console.log(`📤 Request body:`, JSON.stringify(body, null, 2));

  const response = await fetch(url, options);
  const responseText = await response.text();

  console.log(`📥 Response status: ${response.status}`);

  if (!response.ok) {
    console.log(`❌ Error response:`, responseText);
    return { success: false, status: response.status, error: responseText };
  }

  const data = JSON.parse(responseText);
  console.log(`✅ Success: Found ${data.results?.length || 0} results`);
  return { success: true, data };
}

/**
 * Test different filter combinations
 */
async function runTests() {
  console.log('🧪 Testing HubSpot API Filters for Mock Exams Object\n');
  console.log('='.repeat(80));

  const properties = [
    'mock_exam_name', 'mock_type', 'exam_date', 'start_time', 'end_time',
    'location', 'capacity', 'total_bookings', 'is_active', 'scheduled_activation_datetime',
    'hs_createdate', 'hs_lastmodifieddate'
  ];

  // Calculate timestamps
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffTimestamp = thirtyDaysAgo.getTime();
  const cutoffDateString = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

  console.log(`\n📅 Test timestamps:`);
  console.log(`   30 days ago (timestamp): ${cutoffTimestamp}`);
  console.log(`   30 days ago (date string): ${cutoffDateString}`);
  console.log(`   30 days ago (ISO): ${thirtyDaysAgo.toISOString()}`);

  const tests = [
    {
      name: 'Test 1: No filters (baseline)',
      body: {
        properties,
        limit: 5
      }
    },
    {
      name: 'Test 2: Filter by hs_createdate (timestamp property) with GTE',
      body: {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_createdate',
            operator: 'GTE',
            value: cutoffTimestamp.toString()
          }]
        }],
        properties,
        limit: 5
      }
    },
    {
      name: 'Test 3: Filter by exam_date (string property) with GTE - EXPECTED TO FAIL',
      body: {
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'GTE',
            value: cutoffDateString
          }]
        }],
        properties,
        limit: 5
      }
    },
    {
      name: 'Test 4: Filter by exam_date (string property) with EQ',
      body: {
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'EQ',
            value: '2025-12-15' // Use a specific date you know exists
          }]
        }],
        properties,
        limit: 5
      }
    },
    {
      name: 'Test 5: Filter by hs_lastmodifieddate (what the cron job should use)',
      body: {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_lastmodifieddate',
            operator: 'GTE',
            value: cutoffTimestamp.toString()
          }]
        }],
        properties,
        limit: 5,
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
      }
    },
    {
      name: 'Test 6: Combined - hs_createdate GTE (for full sync)',
      body: {
        filterGroups: [{
          filters: [{
            propertyName: 'hs_createdate',
            operator: 'GTE',
            value: cutoffTimestamp.toString()
          }]
        }],
        properties,
        limit: 5,
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }]
      }
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log('\n' + '='.repeat(80));
    console.log(`\n🧪 ${test.name}\n`);

    try {
      const result = await hubspotApiCall(
        'POST',
        `/crm/v3/objects/${MOCK_EXAMS_OBJECT_TYPE}/search`,
        test.body
      );

      if (result.success) {
        console.log(`\n✅ PASSED: ${test.name}`);
        if (result.data.results?.length > 0) {
          console.log(`   Sample result:`, {
            id: result.data.results[0].id,
            exam_date: result.data.results[0].properties.exam_date,
            mock_type: result.data.results[0].properties.mock_type,
            hs_createdate: result.data.results[0].properties.hs_createdate,
            hs_lastmodifieddate: result.data.results[0].properties.hs_lastmodifieddate
          });
        }
        passedTests++;
      } else {
        console.log(`\n❌ FAILED: ${test.name}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error}`);
        failedTests++;
      }
    } catch (error) {
      console.log(`\n❌ FAILED: ${test.name}`);
      console.log(`   Exception: ${error.message}`);
      failedTests++;
    }

    // Rate limiting between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results: ${passedTests}/${tests.length} passed, ${failedTests} failed`);
  console.log('\n' + '='.repeat(80));

  // Summary
  console.log('\n📋 Summary:');
  console.log('   ✅ hs_createdate with GTE should work (timestamp property)');
  console.log('   ✅ hs_lastmodifieddate with GTE should work (timestamp property)');
  console.log('   ❌ exam_date with GTE should FAIL (string property, not date)');
  console.log('   ✅ exam_date with EQ might work (exact string match)');
  console.log('\n   💡 Recommendation: Use hs_createdate or hs_lastmodifieddate for date filtering');
  console.log('      Filter exam_date in application code after fetching data\n');
}

// Run the tests
runTests()
  .then(() => {
    console.log('✅ Diagnosis complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
