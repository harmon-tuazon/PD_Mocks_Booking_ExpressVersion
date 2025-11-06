/**
 * Debug script using the existing HubSpot service
 * Tests the getMockExamAssociations method directly
 */

require('dotenv').config();
const hubspot = require('../admin_root/api/_shared/hubspot');

// Configuration
const MOCK_DISCUSSION_EXAM_ID = '37367871482'; // From screenshot
const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340; // "requires attendance at" association

async function debugAssociations() {
  console.log('='.repeat(80));
  console.log('DIRECT HUBSPOT SERVICE TEST');
  console.log('='.repeat(80));
  console.log(`\nMock Discussion Exam ID: ${MOCK_DISCUSSION_EXAM_ID}`);
  console.log(`Association Type ID: ${PREREQUISITE_ASSOCIATION_TYPE_ID}`);
  console.log('\n' + '-'.repeat(80));

  try {
    // hubspot is already a singleton proxy instance

    // Test 1: Get single mock exam details
    console.log('\n[TEST 1] Fetching mock exam details');
    const mockExam = await hubspot.getMockExam(MOCK_DISCUSSION_EXAM_ID);

    console.log('✅ Mock exam retrieved:');
    console.log(`  - ID: ${mockExam.id}`);
    console.log(`  - Type: ${mockExam.properties?.mock_type || 'N/A'}`);
    console.log(`  - Date: ${mockExam.properties?.exam_date || 'N/A'}`);
    console.log(`  - Location: ${mockExam.properties?.location || 'N/A'}`);

    // Test 2: Get associations
    console.log('\n' + '-'.repeat(80));
    console.log('\n[TEST 2] Fetching prerequisite associations');
    const prerequisites = await hubspot.getMockExamAssociations(
      MOCK_DISCUSSION_EXAM_ID,
      PREREQUISITE_ASSOCIATION_TYPE_ID
    );

    console.log(`\n✅ Found ${prerequisites.length} prerequisite associations`);

    if (prerequisites.length > 0) {
      console.log('\n📝 Prerequisite Details:');
      prerequisites.forEach((prereq, idx) => {
        console.log(`\n  ${idx + 1}. Exam ID: ${prereq.id}`);
        console.log(`     - Type: ${prereq.properties?.mock_type || 'N/A'}`);
        console.log(`     - Date: ${prereq.properties?.exam_date || 'N/A'}`);
        console.log(`     - Location: ${prereq.properties?.location || 'N/A'}`);
        console.log(`     - Is Active: ${prereq.properties?.is_active || 'N/A'}`);
      });
    } else {
      console.log('\n⚠️  NO PREREQUISITE ASSOCIATIONS FOUND');
      console.log('\nPossible reasons:');
      console.log('  1. Association type ID 1340 is incorrect');
      console.log('  2. Associations were not created in HubSpot');
      console.log('  3. Association was deleted');
      console.log('  4. Association is using a different type ID');
    }

    // Test 3: Check if associations exist at all (with any type)
    console.log('\n' + '-'.repeat(80));
    console.log('\n[TEST 3] Checking for ANY associations (any type)');

    const rawResponse = await hubspot.apiCall(
      'GET',
      `/crm/v3/objects/2-50158913/${MOCK_DISCUSSION_EXAM_ID}?associations=2-50158913`
    );

    const allAssociations = rawResponse.associations?.mock_exams?.results || [];
    console.log(`\nTotal associations found: ${allAssociations.length}`);

    if (allAssociations.length > 0) {
      console.log('\n📋 All associations (with type IDs):');
      allAssociations.forEach((assoc, idx) => {
        console.log(`\n  ${idx + 1}. Association to: ${assoc.toObjectId || assoc.id}`);
        if (assoc.types) {
          assoc.types.forEach((type, typeIdx) => {
            console.log(`     Type ${typeIdx + 1}:`);
            console.log(`       - Association Type ID: ${type.associationTypeId}`);
            console.log(`       - Category: ${type.associationCategory}`);
            console.log(`       - Label: ${type.label || 'N/A'}`);

            if (type.associationTypeId === PREREQUISITE_ASSOCIATION_TYPE_ID) {
              console.log(`       ✅ THIS IS A PREREQUISITE ASSOCIATION`);
            }
          });
        }
      });

      // Suggest the correct association type ID
      console.log('\n💡 Suggestion:');
      if (allAssociations.some(a => a.types?.some(t => t.associationTypeId === PREREQUISITE_ASSOCIATION_TYPE_ID))) {
        console.log('  ✅ Association type ID 1340 is CORRECT');
      } else {
        console.log('  ⚠️  Association type ID 1340 NOT found');
        const uniqueTypeIds = [...new Set(allAssociations.flatMap(a => a.types?.map(t => t.associationTypeId) || []))];
        console.log(`  Found these type IDs instead: ${uniqueTypeIds.join(', ')}`);
        console.log('  Consider using one of these type IDs in the code');
      }
    } else {
      console.log('\n⚠️  NO associations found at all for this exam');
      console.log('\nThis means:');
      console.log('  - The exam exists in HubSpot');
      console.log('  - But no prerequisite exams are associated with it');
      console.log('  - You need to create associations in HubSpot CRM');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);

    if (error.response) {
      console.error('\nAPI Response Status:', error.response.status);
      console.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('DEBUG COMPLETE');
  console.log('='.repeat(80));
}

// Run the debug
debugAssociations().catch(console.error);
