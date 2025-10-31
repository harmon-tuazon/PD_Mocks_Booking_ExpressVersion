#!/usr/bin/env node

/**
 * Script: Create Association Definition Between Notes and Mock Exams
 *
 * Purpose: Define the association type between Notes (0-46) and Mock Exams (2-50158913)
 * in HubSpot so we can create associations between them.
 *
 * This script:
 * 1. Checks if association definition already exists
 * 2. If not, creates the association definition
 * 3. Returns the association type ID to use in code
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = "pat-na1-caf844b4-e964-4cbd-b7db-756f1184ed84"
const NOTES_OBJECT = '0-46';  // Notes object type
const MOCK_EXAMS_OBJECT = '2-50158913';  // Mock Exams object type

if (!HS_TOKEN) {
  console.error('❌ Error: HS_PRIVATE_APP_TOKEN environment variable not found');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('🔧 Creating Note ↔ Mock Exam Association Definition');
console.log('='.repeat(70));

/**
 * Make HubSpot API GET call
 */
function makeGetRequest(path) {
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

/**
 * Make HubSpot API POST call
 */
function makePostRequest(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);

    const options = {
      hostname: 'api.hubapi.com',
      path: path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API call failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Check if association already exists
    console.log('\n📋 Step 1: Checking for existing association definitions...\n');

    let existingTypes = [];
    try {
      const result = await makeGetRequest(`/crm/v4/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/labels`);
      existingTypes = result.results || [];

      if (existingTypes.length > 0) {
        console.log('✅ Found existing association definition(s):\n');
        existingTypes.forEach(type => {
          console.log(`  • ${type.label || 'Unlabeled'}`);
          console.log(`    Type ID: ${type.typeId}`);
          console.log(`    Category: ${type.category}`);
          console.log('');
        });

        console.log('✅ Association definition already exists!');
        console.log('\n📝 Use this in your code:');
        console.log(`  associationCategory = '${existingTypes[0].category}';`);
        console.log(`  associationTypeId = ${existingTypes[0].typeId};`);
        return;
      } else {
        console.log('ℹ️  No existing association definition found. Will create one.\n');
      }
    } catch (error) {
      console.log('ℹ️  No existing association definition found. Will create one.\n');
    }

    // Step 2: Create association definition
    console.log('📝 Step 2: Creating association definition...\n');

    const associationDefinition = {
      name: "note_to_mock_exam",  // Internal name (snake_case)
      label: "Mock Exam Note"     // Display name in HubSpot UI
    };

    console.log('Creating association:');
    console.log(`  From: Notes (${NOTES_OBJECT})`);
    console.log(`  To: Mock Exams (${MOCK_EXAMS_OBJECT})`);
    console.log(`  Label: "${associationDefinition.label}"`);
    console.log(`  Internal Name: "${associationDefinition.name}"\n`);

    const createResponse = await makePostRequest(
      `/crm/v4/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/labels`,
      associationDefinition
    );

    console.log('✅ Association definition created successfully!\n');
    console.log('Created association details:');
    console.log(`  • Label: ${createResponse.label}`);
    console.log(`  • Type ID: ${createResponse.typeId}`);
    console.log(`  • Category: ${createResponse.category}`);
    console.log('');

    // Step 3: Verify by reading back
    console.log('\n📋 Step 3: Verifying creation...\n');

    const verifyResult = await makeGetRequest(`/crm/v4/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/labels`);
    const verifiedTypes = verifyResult.results || [];

    if (verifiedTypes.length > 0) {
      console.log('✅ Verification successful! Association is now available.\n');
    }

    // Step 4: Provide code update instructions
    console.log('='.repeat(70));
    console.log('📝 CODE UPDATE REQUIRED');
    console.log('='.repeat(70));
    console.log('\nUpdate admin_root/api/_shared/hubspot.js (around line 431-434):');
    console.log('\n```javascript');
    console.log('if (fromObjectType === "notes" || fromObjectType === "0-46") {');
    console.log(`  associationCategory = '${createResponse.category}';`);
    console.log(`  associationTypeId = ${createResponse.typeId};`);
    console.log('}');
    console.log('```');
    console.log('\n✅ After updating the code, notes will appear on Mock Exam timelines!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('403') || error.message.includes('401')) {
      console.log('\n💡 Authentication Error:');
      console.log('  - Verify HS_PRIVATE_APP_TOKEN is correct');
      console.log('  - Ensure token has these scopes:');
      console.log('    • crm.objects.contacts.write');
      console.log('    • crm.schemas.associations.read');
      console.log('    • crm.schemas.associations.write (REQUIRED)');
    } else if (error.message.includes('400')) {
      console.log('\n💡 Bad Request Error:');
      console.log('  - Association definition might already exist');
      console.log('  - Object types might be incorrect');
      console.log('  - Label name might be invalid');
    }

    console.log('\nRaw error:', error.message);
    process.exit(1);
  }
}

main();
