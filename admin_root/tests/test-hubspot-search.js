/**
 * Test HubSpot Search API with different date filter configurations
 * Run with: node admin_root/tests/test-hubspot-search.js
 */

require('dotenv').config();

async function testHubSpotSearch() {
  const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
  const MOCK_EXAMS_OBJECT_ID = process.env.MOCK_EXAMS_OBJECT_ID || '2-50158913';

  if (!HS_TOKEN) {
    console.error('❌ HS_PRIVATE_APP_TOKEN environment variable is required');
    console.log('Please set it in your .env file or environment');
    process.exit(1);
  }

  console.log('Testing HubSpot Search API for Mock Exams\n');
  console.log('==========================================\n');

  // Test different search configurations
  const testCases = [
    {
      name: 'No filters - Get all mock exams',
      request: {
        properties: ['mock_type', 'exam_date', 'location', 'capacity'],
        limit: 10
      }
    },
    {
      name: 'Single date with EQ operator',
      request: {
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'EQ',
            value: '2025-09-26'
          }]
        }],
        properties: ['mock_type', 'exam_date', 'location', 'capacity'],
        limit: 10
      }
    },
    {
      name: 'Date range with GTE/LTE operators',
      request: {
        filterGroups: [{
          filters: [
            {
              propertyName: 'exam_date',
              operator: 'GTE',
              value: '2025-09-26'
            },
            {
              propertyName: 'exam_date',
              operator: 'LTE',
              value: '2025-09-26'
            }
          ]
        }],
        properties: ['mock_type', 'exam_date', 'location', 'capacity'],
        limit: 10
      }
    }
  ];

  // Test each configuration
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log('Request:', JSON.stringify(testCase.request, null, 2));

    try {
      const response = await fetch(
        `https://api.hubapi.com/crm/v3/objects/${MOCK_EXAMS_OBJECT_ID}/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testCase.request)
        }
      );

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Success! Found ${data.results?.length || 0} results`);
        if (data.results && data.results.length > 0) {
          console.log('First result:', JSON.stringify(data.results[0].properties, null, 2));
        }
      } else {
        console.error(`❌ Error ${response.status}:`, data);
        console.error('Full error response:', JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
    }
  }

  console.log('\n==========================================\n');
  console.log('Test completed!\n');
}

// Run the test
testHubSpotSearch();