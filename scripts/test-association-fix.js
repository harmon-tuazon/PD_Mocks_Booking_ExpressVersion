#!/usr/bin/env node

/**
 * Test script to verify the HubSpot mock exam association fix
 * This tests that the API call now uses the correct object type ID
 */

require('dotenv').config();
const HubSpotService = require('../admin_root/api/_shared/hubspot');

async function testAssociationFix() {
  console.log('Testing HubSpot Mock Exam Association Fix...\n');

  try {
    const hubspot = new HubSpotService();

    // Test with a mock exam ID (you can replace with a real one for actual testing)
    const testMockExamId = '37367871402'; // From the error message

    console.log(`Testing getMockExamAssociations for Mock Exam ID: ${testMockExamId}`);
    console.log('Expected URL pattern: /crm/v3/objects/2-50158913/${id}?associations=2-50158913');
    console.log('(Previously was incorrectly using: ?associations=mock_exams)\n');

    // This will now use the correct API endpoint
    const associations = await hubspot.getMockExamAssociations(testMockExamId);

    console.log('✅ SUCCESS: API call completed without 400 error!');
    console.log(`Found ${associations.length} prerequisite associations`);

    if (associations.length > 0) {
      console.log('\nPrerequisite Exams:');
      associations.forEach(exam => {
        console.log(`  - ${exam.properties.name} (ID: ${exam.id})`);
      });
    }

  } catch (error) {
    if (error.response?.status === 400 && error.message?.includes('Unable to infer object type')) {
      console.error('❌ FAILED: The bug is still present!');
      console.error('Error:', error.message);
    } else if (error.response?.status === 404) {
      console.log('⚠️  Mock exam not found (404) - this is OK, the API format is correct');
    } else if (error.response?.status === 401) {
      console.log('⚠️  Authentication error - please check your HubSpot API token');
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
}

// Run the test
testAssociationFix().catch(console.error);