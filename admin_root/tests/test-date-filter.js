/**
 * Test different date filtering approaches
 * Run with: node admin_root/tests/test-date-filter.js
 */

require('dotenv').config();

async function testDateFiltering() {
  const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
  const MOCK_EXAMS_OBJECT_ID = process.env.MOCK_EXAMS_OBJECT_ID || '2-50158913';

  if (!HS_TOKEN) {
    console.error('❌ HS_PRIVATE_APP_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('Testing Date Filtering Approaches\n');
  console.log('==================================\n');

  // First, let's get all exams to understand the data
  console.log('1. Fetching sample data to understand date format...');

  const sampleResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/${MOCK_EXAMS_OBJECT_ID}/search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: ['mock_type', 'exam_date', 'location', 'start_time', 'end_time'],
        limit: 5,
        sorts: [{
          propertyName: 'exam_date',
          direction: 'ASCENDING'
        }]
      })
    }
  );

  const sampleData = await sampleResponse.json();

  if (sampleResponse.ok && sampleData.results?.length > 0) {
    console.log('Sample exam dates:');
    sampleData.results.forEach(r => {
      console.log(`  - ${r.properties.exam_date} (${r.properties.mock_type} at ${r.properties.location})`);
    });

    // Get a real date to test with
    const testDate = sampleData.results[0].properties.exam_date;
    console.log(`\nUsing ${testDate} for testing...\n`);

    // Test different filter approaches
    const testCases = [
      {
        name: 'String match with CONTAINS_TOKEN',
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'CONTAINS_TOKEN',
            value: testDate
          }]
        }]
      },
      {
        name: 'String match with IN operator',
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'IN',
            values: [testDate]
          }]
        }]
      },
      {
        name: 'String match with HAS_PROPERTY',
        filterGroups: [{
          filters: [{
            propertyName: 'exam_date',
            operator: 'HAS_PROPERTY'
          }]
        }]
      },
      {
        name: 'No filter - get all and filter in code',
        // No filterGroups, we'll handle filtering in the application
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n2. Testing: ${testCase.name}`);

      const request = {
        properties: ['mock_type', 'exam_date', 'location'],
        limit: 100,
        ...testCase
      };

      try {
        const response = await fetch(
          `https://api.hubapi.com/crm/v3/objects/${MOCK_EXAMS_OBJECT_ID}/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
          }
        );

        const data = await response.json();

        if (response.ok) {
          console.log(`✅ Success! Found ${data.results?.length || 0} results`);
          if (testCase.name === 'No filter - get all and filter in code') {
            // Show how we'd filter in application code
            const filtered = data.results.filter(r => r.properties.exam_date === testDate);
            console.log(`   After filtering for ${testDate}: ${filtered.length} results`);
          }
        } else {
          console.error(`❌ Error ${response.status}: ${data.message}`);
        }
      } catch (error) {
        console.error(`❌ Request failed:`, error.message);
      }
    }
  } else {
    console.error('❌ Could not fetch sample data');
  }

  console.log('\n==================================\n');
  console.log('Recommendation: Since exam_date is a string property, not a date property,');
  console.log('we should either:');
  console.log('1. Use CONTAINS_TOKEN or IN operators for exact matches');
  console.log('2. Fetch all records and filter in application code');
  console.log('3. Convert exam_date to a proper date property in HubSpot');
}

// Run the test
testDateFiltering();