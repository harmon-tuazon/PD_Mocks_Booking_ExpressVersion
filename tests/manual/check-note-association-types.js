#!/usr/bin/env node

/**
 * Diagnostic Script: Check Note Association Types
 *
 * Purpose: Verify the correct association type IDs between Notes (0-46) and Mock Exams (2-50158913)
 *
 * This script helps diagnose why notes aren't appearing in HubSpot by checking:
 * 1. Available association types from Notes → Mock Exams
 * 2. Available association types from Mock Exams → Notes
 * 3. Current association type being used in code vs actual schema
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const NOTES_OBJECT = '0-46';  // Notes object type
const MOCK_EXAMS_OBJECT = '2-50158913';  // Mock Exams object type

if (!HS_TOKEN) {
  console.error('❌ Error: HS_PRIVATE_APP_TOKEN environment variable not found');
  console.log('\nPlease ensure you have a .env file with:');
  console.log('HS_PRIVATE_APP_TOKEN=your_token_here');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('🔍 Checking Note → Mock Exam Association Types');
console.log('='.repeat(70));

/**
 * Make HubSpot API call
 */
function makeApiCall(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API call failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function main() {
  try {
    // Check 1: Notes → Mock Exams association types
    console.log('\n📋 Step 1: Checking Notes (0-46) → Mock Exams (2-50158913)');
    console.log('API Call: GET /crm/v3/associations/0-46/2-50158913/types\n');

    const notesToMockExams = await makeApiCall(`/crm/v3/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/types`);

    console.log('Available Association Types:');
    if (notesToMockExams.results && notesToMockExams.results.length > 0) {
      notesToMockExams.results.forEach(type => {
        console.log(`  • Type ID: ${type.typeId}`);
        console.log(`    Category: ${type.category}`);
        console.log(`    Label: ${type.label || 'No label'}`);
        console.log('');
      });
    } else {
      console.log('  ⚠️  No association types found for Notes → Mock Exams');
    }

    // Check 2: Mock Exams → Notes association types
    console.log('\n📋 Step 2: Checking Mock Exams (2-50158913) → Notes (0-46)');
    console.log('API Call: GET /crm/v3/associations/2-50158913/0-46/types\n');

    const mockExamsToNotes = await makeApiCall(`/crm/v3/associations/${MOCK_EXAMS_OBJECT}/${NOTES_OBJECT}/types`);

    console.log('Available Association Types:');
    if (mockExamsToNotes.results && mockExamsToNotes.results.length > 0) {
      mockExamsToNotes.results.forEach(type => {
        console.log(`  • Type ID: ${type.typeId}`);
        console.log(`    Category: ${type.category}`);
        console.log(`    Label: ${type.label || 'No label'}`);
        console.log('');
      });
    } else {
      console.log('  ⚠️  No association types found for Mock Exams → Notes');
    }

    // Analysis
    console.log('\n' + '='.repeat(70));
    console.log('📊 ANALYSIS');
    console.log('='.repeat(70));

    console.log('\n🔍 Current Code Implementation:');
    console.log('  • Using: associationCategory = "USER_DEFINED"');
    console.log('  • Using: associationTypeId = 1250 (for Notes → other objects)');
    console.log('  • Using: associationTypeId = 1249 (for other objects → Notes)');

    console.log('\n✅ Recommended Fix:');

    if (notesToMockExams.results && notesToMockExams.results.length > 0) {
      const recommended = notesToMockExams.results[0];
      console.log(`  • Use typeId: ${recommended.typeId}`);
      console.log(`  • Use category: ${recommended.category}`);
      console.log(`  • Direction: Notes (0-46) → Mock Exams (2-50158913)`);

      console.log('\n📝 Code Update Required:');
      console.log('  File: admin_root/api/_shared/hubspot.js');
      console.log('  Method: createAssociation()');
      console.log(`  Line: ~431-434`);
      console.log('\n  Change from:');
      console.log('    associationTypeId = 1250;');
      console.log(`  To:`);
      console.log(`    associationTypeId = ${recommended.typeId};`);
    } else {
      console.log('  ⚠️  No valid association types found!');
      console.log('  This might mean:');
      console.log('    1. Notes cannot be associated with Mock Exams in this portal');
      console.log('    2. Association definition needs to be created in HubSpot first');
      console.log('    3. Different object types should be used');
    }

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('  1. Verify HS_PRIVATE_APP_TOKEN is correct');
    console.log('  2. Ensure token has proper scopes (crm.objects.notes.read, crm.schemas.associations.read)');
    console.log('  3. Check that object type IDs are correct for your portal');
    process.exit(1);
  }
}

main();
