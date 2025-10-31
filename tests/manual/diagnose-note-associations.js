#!/usr/bin/env node

/**
 * Enhanced Diagnostic: Find Correct Note Association Types
 * Tests multiple Note object type variations to find the correct one
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const MOCK_EXAMS_OBJECT = '2-50158913';

// Try multiple variations of Notes object type
const NOTES_VARIATIONS = [
  { id: '0-4', label: 'Standard HubSpot Notes' },
  { id: '0-46', label: 'Currently used in code' },
  { id: 'notes', label: 'Object name string' },
  { id: '0-5', label: 'Alternative ID' }
];

if (!HS_TOKEN) {
  console.error('\n❌ Error: HS_PRIVATE_APP_TOKEN not found');
  console.log('Set it with: export HS_PRIVATE_APP_TOKEN=your_token');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('🔍 DIAGNOSTIC: Finding Correct Note → Mock Exam Association Types');
console.log('='.repeat(80));

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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          resolve({ error: true, statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  let successfulVariation = null;

  // Test each Notes object type variation
  for (const variation of NOTES_VARIATIONS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📋 Testing: ${variation.label} (${variation.id})`);
    console.log(`${'─'.repeat(80)}`);

    try {
      // Test Notes → Mock Exams
      console.log(`\n🔄 Query: GET /crm/v3/associations/${variation.id}/${MOCK_EXAMS_OBJECT}/types`);

      const result = await makeApiCall(`/crm/v3/associations/${variation.id}/${MOCK_EXAMS_OBJECT}/types`);

      if (result.error) {
        console.log(`❌ Failed (HTTP ${result.statusCode})`);
        if (result.statusCode === 400) {
          console.log('   → Invalid object type');
        } else if (result.statusCode === 404) {
          console.log('   → No associations defined');
        }
        continue;
      }

      if (!result.results || result.results.length === 0) {
        console.log('⚠️  No association types found');
        continue;
      }

      console.log(`✅ SUCCESS! Found ${result.results.length} association type(s):`);
      result.results.forEach((type, i) => {
        console.log(`\n   ${i + 1}. Type ID: ${type.typeId}`);
        console.log(`      Category: ${type.category}`);
        console.log(`      Label: ${type.label || '(no label)'}`);
        if (type.name) console.log(`      Name: ${type.name}`);
      });

      successfulVariation = { ...variation, types: result.results };
      break; // Found it!

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Results summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RESULTS & RECOMMENDATIONS');
  console.log('='.repeat(80));

  if (successfulVariation) {
    const type = successfulVariation.types[0];

    console.log(`\n✅ CORRECT OBJECT TYPE: ${successfulVariation.id}`);
    console.log(`   Label: ${successfulVariation.label}`);
    console.log(`\n✅ ASSOCIATION TYPE TO USE: ${type.typeId}`);
    console.log(`   Category: ${type.category}`);

    console.log('\n📝 REQUIRED CODE CHANGES:\n');

    console.log('1. Update HUBSPOT_OBJECTS constant:');
    console.log('   File: admin_root/api/_shared/hubspot.js (line ~32)');
    console.log('   Add:  \'notes\': \'' + successfulVariation.id + '\'');

    console.log('\n2. Update createAssociation() method:');
    console.log('   File: admin_root/api/_shared/hubspot.js (line ~431-434)');
    console.log('   Change:');
    console.log('     if (fromObjectType === \'notes\' || fromObjectType === \'' + successfulVariation.id + '\') {');
    console.log('       associationCategory = \'' + type.category + '\';');
    console.log('       associationTypeId = ' + type.typeId + ';');
    console.log('     }');

    console.log('\n3. Fix hardcoded values in cancel-bookings.js:');
    console.log('   File: admin_root/api/admin/mock-exams/[id]/cancel-bookings.js');
    console.log('   Line 37: \'notes\': \'' + successfulVariation.id + '\'');
    console.log('   Line 433: await hubspot.createAssociation(\'' + successfulVariation.id + '\', ...)');

  } else {
    console.log('\n❌ NO VALID ASSOCIATION TYPES FOUND');
    console.log('\nPossible reasons:');
    console.log('  1. Notes object type ID is different in your portal');
    console.log('  2. Association schema not configured in HubSpot');
    console.log('  3. Insufficient API permissions');

    console.log('\n🔧 Next steps:');
    console.log('  1. Check HubSpot Settings → Objects → Notes for object type ID');
    console.log('  2. Verify API token has "crm.schemas.associations.read" scope');
    console.log('  3. May need to create custom association definition in HubSpot');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
