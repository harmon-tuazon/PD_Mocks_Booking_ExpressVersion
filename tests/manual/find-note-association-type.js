#!/usr/bin/env node

/**
 * Find Note Association Type using HubSpot v4 API
 *
 * Strategy:
 * 1. Get a real Mock Exam from HubSpot
 * 2. Check what associations it has (including any notes)
 * 3. Create a test note and try associating it
 * 4. Identify the correct association type from actual usage
 *
 * Based on: https://developers.hubspot.com/docs/api-reference/crm-associations-v4/basic/
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const MOCK_EXAMS_OBJECT = '2-50158913';
const NOTES_OBJECT = '0-4'; // Standard HubSpot Notes

if (!HS_TOKEN) {
  console.error('❌ Error: HS_PRIVATE_APP_TOKEN not found');
  console.log('Set it with: export HS_PRIVATE_APP_TOKEN=your_token');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('🔍 Finding Correct Note → Mock Exam Association Type');
console.log('='.repeat(80));

function makeApiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            resolve({ error: true, statusCode: res.statusCode, body: parsed });
          }
        } catch (e) {
          resolve({ error: true, statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Get a Mock Exam to work with
    console.log('\n📋 Step 1: Finding a Mock Exam to test with...\n');

    const searchResult = await makeApiCall(
      'POST',
      `/crm/v3/objects/${MOCK_EXAMS_OBJECT}/search`,
      {
        limit: 1,
        properties: ['mock_type', 'exam_date', 'mock_exam_name']
      }
    );

    if (searchResult.error || !searchResult.results || searchResult.results.length === 0) {
      console.error('❌ Could not find any Mock Exams');
      process.exit(1);
    }

    const mockExam = searchResult.results[0];
    const mockExamId = mockExam.id;
    console.log(`✅ Using Mock Exam: ${mockExamId}`);
    console.log(`   Type: ${mockExam.properties.mock_type}`);
    console.log(`   Date: ${mockExam.properties.exam_date}`);

    // Step 2: Check existing associations on this Mock Exam
    console.log('\n📋 Step 2: Checking existing associations on Mock Exam...\n');
    console.log(`   API: GET /crm/v4/objects/${MOCK_EXAMS_OBJECT}/${mockExamId}/associations/${NOTES_OBJECT}`);

    const existingAssociations = await makeApiCall(
      'GET',
      `/crm/v4/objects/${MOCK_EXAMS_OBJECT}/${mockExamId}/associations/${NOTES_OBJECT}`
    );

    if (existingAssociations.error) {
      console.log(`⚠️  No existing note associations found (HTTP ${existingAssociations.statusCode})`);
    } else if (existingAssociations.results && existingAssociations.results.length > 0) {
      console.log(`✅ Found ${existingAssociations.results.length} existing note association(s):`);
      existingAssociations.results.forEach((assoc, i) => {
        console.log(`\n   ${i + 1}. Note ID: ${assoc.toObjectId}`);
        assoc.associationTypes.forEach(type => {
          console.log(`      • Type ID: ${type.typeId}`);
          console.log(`        Category: ${type.category}`);
          console.log(`        Label: ${type.label || '(no label)'}`);
        });
      });
    } else {
      console.log('   No note associations found on this Mock Exam');
    }

    // Step 3: Get all possible association types between Mock Exams and Notes
    console.log('\n📋 Step 3: Querying available association types...\n');
    console.log(`   API: GET /crm/v4/associations/${MOCK_EXAMS_OBJECT}/${NOTES_OBJECT}/labels`);

    const availableTypes = await makeApiCall(
      'GET',
      `/crm/v4/associations/${MOCK_EXAMS_OBJECT}/${NOTES_OBJECT}/labels`
    );

    let recommendedTypeId = null;

    if (availableTypes.error) {
      console.log(`⚠️  Could not fetch association labels (HTTP ${availableTypes.statusCode})`);
    } else if (availableTypes.results && availableTypes.results.length > 0) {
      console.log(`✅ Available association types (Mock Exam → Note):`);
      availableTypes.results.forEach((type, i) => {
        console.log(`\n   ${i + 1}. Type ID: ${type.typeId}`);
        console.log(`      Category: ${type.category}`);
        console.log(`      Label: ${type.label || '(no label)'}`);
        if (i === 0) recommendedTypeId = type.typeId;
      });
    }

    // Step 4: Check reverse direction (Note → Mock Exam)
    console.log('\n📋 Step 4: Checking reverse direction (Note → Mock Exam)...\n');
    console.log(`   API: GET /crm/v4/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/labels`);

    const reverseTypes = await makeApiCall(
      'GET',
      `/crm/v4/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/labels`
    );

    let reverseTypeId = null;

    if (reverseTypes.error) {
      console.log(`⚠️  Could not fetch reverse association labels (HTTP ${reverseTypes.statusCode})`);
    } else if (reverseTypes.results && reverseTypes.results.length > 0) {
      console.log(`✅ Available association types (Note → Mock Exam):`);
      reverseTypes.results.forEach((type, i) => {
        console.log(`\n   ${i + 1}. Type ID: ${type.typeId}`);
        console.log(`      Category: ${type.category}`);
        console.log(`      Label: ${type.label || '(no label)'}`);
        if (i === 0) reverseTypeId = type.typeId;
      });
    }

    // Summary and Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS & RECOMMENDATIONS');
    console.log('='.repeat(80));

    if (reverseTypeId) {
      console.log(`\n✅ FOUND: Use Type ID ${reverseTypeId} for Note → Mock Exam associations`);
      console.log(`   Direction: Notes (${NOTES_OBJECT}) → Mock Exams (${MOCK_EXAMS_OBJECT})`);

      console.log('\n📝 REQUIRED CODE CHANGES:\n');

      console.log('1. Add to HUBSPOT_OBJECTS constant:');
      console.log('   File: admin_root/api/_shared/hubspot.js (line ~32)');
      console.log(`   Add:  'notes': '${NOTES_OBJECT}'`);

      console.log('\n2. Update createAssociation() method:');
      console.log('   File: admin_root/api/_shared/hubspot.js (lines ~430-434)');
      console.log('   Replace the notes section with:');
      console.log(`   if (fromObjectType === 'notes' || fromObjectType === '${NOTES_OBJECT}') {`);
      console.log(`     // Use default association - don't specify category/typeId`);
      console.log(`     // HubSpot v4 API will use the default type automatically`);
      console.log(`     // Or explicitly use typeId ${reverseTypeId}`);
      console.log('   }');

      console.log('\n3. Fix in cancel-bookings.js:');
      console.log('   Line 37: Update to use consistent object type');
      console.log(`   Line 433: createAssociation('${NOTES_OBJECT}', noteId, '${MOCK_EXAMS_OBJECT}', mockExamId)`);

      console.log('\n4. IMPORTANT: v4 API Usage');
      console.log('   Current code uses v4 endpoint which should work with empty payload:');
      console.log('   PUT /crm/v4/objects/{fromType}/{fromId}/associations/{toType}/{toId}');
      console.log('   Body: [] (empty array for default type)');
      console.log(`   Or:   [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ${reverseTypeId} }]`);

    } else {
      console.log('\n⚠️  No standard association types found between Notes and Mock Exams');
      console.log('\nThis might mean:');
      console.log('  1. Custom association needs to be defined in HubSpot portal');
      console.log('  2. Using empty payload [] should use HubSpot default');
      console.log('  3. The objects may not support direct associations');

      console.log('\n💡 Try using EMPTY payload in createAssociation:');
      console.log('   await this.apiCall("PUT", `/crm/v4/objects/${NOTES_OBJECT}/${noteId}/associations/${MOCK_EXAMS_OBJECT}/${mockExamId}`, []);');
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
