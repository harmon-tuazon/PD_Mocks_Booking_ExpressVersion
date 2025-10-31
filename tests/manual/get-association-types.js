#!/usr/bin/env node

/**
 * Simple GET request to find Note → Mock Exam association types
 * Using HubSpot v3 API endpoint directly
 *
 * Endpoint: GET /crm/v3/associations/{fromObjectType}/{toObjectType}/types
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;

if (!HS_TOKEN) {
  console.error('❌ Error: HS_PRIVATE_APP_TOKEN not found');
  console.log('\nSet it with one of:');
  console.log('  export HS_PRIVATE_APP_TOKEN=your_token');
  console.log('  Or add to .env file');
  process.exit(1);
}

const NOTES_OBJECT = '0-4';         // Standard HubSpot Notes
const MOCK_EXAMS_OBJECT = '2-50158913';

console.log('='.repeat(80));
console.log('🔍 Getting Association Types (v3 API)');
console.log('='.repeat(80));

function makeGetRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Query 1: Notes → Mock Exams
  console.log('\n📋 Query 1: Notes (0-4) → Mock Exams (2-50158913)');
  console.log('─'.repeat(80));
  const url1 = `https://api.hubapi.com/crm/v3/associations/${NOTES_OBJECT}/${MOCK_EXAMS_OBJECT}/types`;
  console.log(`GET ${url1}\n`);

  const result1 = await makeGetRequest(url1);

  if (result1.statusCode === 200) {
    console.log('✅ SUCCESS!\n');
    if (result1.data.results && result1.data.results.length > 0) {
      console.log(`Found ${result1.data.results.length} association type(s):\n`);
      result1.data.results.forEach((type, i) => {
        console.log(`${i + 1}. Type ID: ${type.typeId}`);
        console.log(`   Category: ${type.category}`);
        console.log(`   Label: ${type.label || '(no label)'}`);
        console.log('');
      });
    } else {
      console.log('No association types found.\n');
    }
  } else {
    console.log(`❌ Failed (HTTP ${result1.statusCode})`);
    console.log(JSON.stringify(result1.data, null, 2));
  }

  // Query 2: Mock Exams → Notes (reverse direction)
  console.log('\n📋 Query 2: Mock Exams (2-50158913) → Notes (0-4)');
  console.log('─'.repeat(80));
  const url2 = `https://api.hubapi.com/crm/v3/associations/${MOCK_EXAMS_OBJECT}/${NOTES_OBJECT}/types`;
  console.log(`GET ${url2}\n`);

  const result2 = await makeGetRequest(url2);

  if (result2.statusCode === 200) {
    console.log('✅ SUCCESS!\n');
    if (result2.data.results && result2.data.results.length > 0) {
      console.log(`Found ${result2.data.results.length} association type(s):\n`);
      result2.data.results.forEach((type, i) => {
        console.log(`${i + 1}. Type ID: ${type.typeId}`);
        console.log(`   Category: ${type.category}`);
        console.log(`   Label: ${type.label || '(no label)'}`);
        console.log('');
      });
    } else {
      console.log('No association types found.\n');
    }
  } else {
    console.log(`❌ Failed (HTTP ${result2.statusCode})`);
    console.log(JSON.stringify(result2.data, null, 2));
  }

  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('📊 RECOMMENDATIONS');
  console.log('='.repeat(80));

  if (result1.statusCode === 200 && result1.data.results && result1.data.results.length > 0) {
    const type = result1.data.results[0];

    console.log('\n✅ Use this for Notes → Mock Exams associations:');
    console.log(`   Type ID: ${type.typeId}`);
    console.log(`   Category: ${type.category}`);

    console.log('\n📝 CODE CHANGES NEEDED:\n');

    console.log('File: admin_root/api/_shared/hubspot.js');
    console.log('Line: ~430-434 (createAssociation method)\n');
    console.log('Replace:');
    console.log('  if (fromObjectType === \'notes\' || fromObjectType === \'0-46\') {');
    console.log('    associationCategory = \'USER_DEFINED\';');
    console.log('    associationTypeId = 1250;');
    console.log('  }\n');
    console.log('With:');
    console.log(`  if (fromObjectType === 'notes' || fromObjectType === '${NOTES_OBJECT}') {`);
    console.log(`    associationCategory = '${type.category}';`);
    console.log(`    associationTypeId = ${type.typeId};`);
    console.log('  }');

    console.log('\n\nFile: admin_root/api/admin/mock-exams/[id]/cancel-bookings.js');
    console.log('Line: 433\n');
    console.log('Replace:');
    console.log('  await hubspot.createAssociation(\'0-46\', noteResponse.id, \'2-50158913\', mockExamId);\n');
    console.log('With:');
    console.log(`  await hubspot.createAssociation('${NOTES_OBJECT}', noteResponse.id, '${MOCK_EXAMS_OBJECT}', mockExamId);`);

    console.log('\n\nAlso add to HUBSPOT_OBJECTS constant:');
    console.log('File: admin_root/api/_shared/hubspot.js');
    console.log('Line: ~32\n');
    console.log(`  'notes': '${NOTES_OBJECT}',`);

  } else {
    console.log('\n⚠️  Could not find association types.');
    console.log('\nPossible issues:');
    console.log('  1. Notes object type might not be 0-4 in your portal');
    console.log('  2. Association schema not defined between Notes and Mock Exams');
    console.log('  3. Need to check HubSpot portal settings');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
