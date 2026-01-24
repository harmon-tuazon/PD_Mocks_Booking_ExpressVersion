#!/usr/bin/env node

/**
 * Test Script: Create and Associate a Test Note
 *
 * Purpose: Test the complete flow of creating a note and associating it with a mock exam
 * to identify exactly where the failure occurs.
 */

require('dotenv').config();
const https = require('https');

const HS_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;

if (!HS_TOKEN) {
  console.error('❌ Error: HS_PRIVATE_APP_TOKEN environment variable not found');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('🧪 Testing Note Creation and Association');
console.log('='.repeat(70));

/**
 * Make HubSpot API call
 */
function makeApiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: 'api.hubapi.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`API call failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

async function main() {
  try {
    // Step 1: Get a mock exam to associate with
    console.log('\n📋 Step 1: Finding a mock exam to test with...\n');

    const searchResponse = await makeApiCall('POST', `/crm/v3/objects/2-50158913/search`, {
      limit: 1,
      properties: ['mock_type', 'exam_date']
    });

    if (!searchResponse.results || searchResponse.results.length === 0) {
      console.error('❌ No mock exams found in HubSpot');
      process.exit(1);
    }

    const mockExam = searchResponse.results[0];
    console.log(`✅ Found mock exam: ${mockExam.properties.mock_type} (ID: ${mockExam.id})`);

    // Step 2: Create a test note using different object types
    console.log('\n📝 Step 2: Testing note creation with different object types...\n');

    const noteContent = `
      <strong>🧪 TEST NOTE - ${new Date().toISOString()}</strong><br/>
      <hr/>
      This is a test note to verify note creation and association.<br/>
      If you see this note on the Mock Exam timeline, the fix is working!
    `;

    // Test 2a: Try creating note using "notes" string
    console.log('Test 2a: Creating note using endpoint /crm/v3/objects/notes');
    let noteId1 = null;
    try {
      const note1Response = await makeApiCall('POST', `/crm/v3/objects/notes`, {
        properties: {
          hs_note_body: noteContent,
          hs_timestamp: Date.now()
        }
      });
      noteId1 = note1Response.id;
      console.log(`✅ Note created with ID: ${noteId1}`);
      console.log(`   Object returned: ${JSON.stringify(note1Response, null, 2)}\n`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}\n`);
    }

    // Test 2b: Try creating note using object type 0-4
    console.log('Test 2b: Creating note using endpoint /crm/v3/objects/0-4');
    let noteId2 = null;
    try {
      const note2Response = await makeApiCall('POST', `/crm/v3/objects/0-4`, {
        properties: {
          hs_note_body: noteContent,
          hs_timestamp: Date.now()
        }
      });
      noteId2 = note2Response.id;
      console.log(`✅ Note created with ID: ${noteId2}\n`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}\n`);
    }

    // Step 3: Try associating the notes
    console.log('📎 Step 3: Testing associations...\n');

    if (noteId1) {
      console.log(`Test 3a: Associating note ${noteId1} (created via "notes") with mock exam ${mockExam.id}`);
      console.log('Using: fromObjectType=0-46, toObjectType=2-50158913');
      try {
        await makeApiCall('PUT', `/crm/v4/objects/0-46/${noteId1}/associations/2-50158913/${mockExam.id}`, [
          {
            associationCategory: 'USER_DEFINED',
            associationTypeId: 1250
          }
        ]);
        console.log('✅ Association created successfully!\n');
      } catch (error) {
        console.log(`❌ Association failed: ${error.message}\n`);
      }
    }

    if (noteId2) {
      console.log(`Test 3b: Associating note ${noteId2} (created via "0-4") with mock exam ${mockExam.id}`);
      console.log('Using: fromObjectType=0-4, toObjectType=2-50158913');
      try {
        await makeApiCall('PUT', `/crm/v4/objects/0-4/${noteId2}/associations/2-50158913/${mockExam.id}`, [
          {
            associationCategory: 'USER_DEFINED',
            associationTypeId: 1250
          }
        ]);
        console.log('✅ Association created successfully!\n');
      } catch (error) {
        console.log(`❌ Association failed: ${error.message}\n`);
      }
    }

    // Step 4: Verify by checking mock exam associations
    console.log('🔍 Step 4: Verifying notes appear on mock exam timeline...\n');

    const mockExamWithNotes = await makeApiCall('GET',
      `/crm/v4/objects/2-50158913/${mockExam.id}/associations/0-4`
    );

    console.log('Notes associated with mock exam (using 0-4):');
    if (mockExamWithNotes.results && mockExamWithNotes.results.length > 0) {
      console.log(`✅ Found ${mockExamWithNotes.results.length} note(s):`);
      mockExamWithNotes.results.forEach((note, idx) => {
        console.log(`  ${idx + 1}. Note ID: ${note.toObjectId}`);
      });
    } else {
      console.log('❌ No notes found using 0-4');
    }

    console.log('\n');

    // Try with 0-46 as well
    try {
      const mockExamWithNotes2 = await makeApiCall('GET',
        `/crm/v4/objects/2-50158913/${mockExam.id}/associations/0-46`
      );

      console.log('Notes associated with mock exam (using 0-46):');
      if (mockExamWithNotes2.results && mockExamWithNotes2.results.length > 0) {
        console.log(`✅ Found ${mockExamWithNotes2.results.length} note(s):`);
        mockExamWithNotes2.results.forEach((note, idx) => {
          console.log(`  ${idx + 1}. Note ID: ${note.toObjectId}`);
        });
      } else {
        console.log('❌ No notes found using 0-46');
      }
    } catch (error) {
      console.log(`❌ Failed to query with 0-46: ${error.message}`);
    }

    // Step 5: Cleanup test notes
    console.log('\n\n🗑️ Step 5: Cleaning up test notes...\n');

    if (noteId1) {
      try {
        await makeApiCall('DELETE', `/crm/v3/objects/notes/${noteId1}`);
        console.log(`✅ Deleted test note ${noteId1}`);
      } catch (error) {
        console.log(`⚠️  Could not delete note ${noteId1}: ${error.message}`);
      }
    }

    if (noteId2) {
      try {
        await makeApiCall('DELETE', `/crm/v3/objects/0-4/${noteId2}`);
        console.log(`✅ Deleted test note ${noteId2}`);
      } catch (error) {
        console.log(`⚠️  Could not delete note ${noteId2}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\n💡 Based on the results above, update your code to use the');
    console.log('   object type that successfully created AND associated notes.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
