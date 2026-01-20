/**
 * Check HubSpot connection and custom objects
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function checkConnection() {
  console.log('\n========================================');
  console.log('HUBSPOT CONNECTION TEST');
  console.log('========================================\n');

  console.log('Environment Check:');
  console.log('   HS_PRIVATE_APP_TOKEN:', process.env.HS_PRIVATE_APP_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('   Token length:', process.env.HS_PRIVATE_APP_TOKEN?.length || 0);
  console.log('');

  try {
    // Test 1: Try to get schema for mock_exams custom object
    console.log('1️⃣  Testing Mock Exams Custom Object Schema...\n');

    try {
      const schema = await hubspot.apiCall('GET', '/crm/v3/schemas/2-50158913');
      console.log('✅ Mock Exams object exists!');
      console.log('   Name:', schema.name);
      console.log('   Label:', schema.label);
      console.log('   Object Type ID:', schema.objectTypeId);
      console.log('   Properties:', schema.properties?.length || 0);
      console.log('');
    } catch (error) {
      console.log('❌ Mock Exams object schema not accessible');
      console.log('   Error:', error.message);
      console.log('');
    }

    // Test 2: Try to search for ANY object in mock_exams
    console.log('2️⃣  Searching for ANY mock exams (using search API)...\n');

    try {
      const searchResult = await hubspot.apiCall('POST', '/crm/v3/objects/2-50158913/search', {
        properties: ['mock_type', 'exam_date'],
        limit: 1
      });

      console.log('✅ Search succeeded!');
      console.log('   Total results:', searchResult.total || 0);
      console.log('');

      if (searchResult.total === 0) {
        console.log('⚠️  No mock exams found in HubSpot (empty database)');
      } else {
        console.log('First exam:', JSON.stringify(searchResult.results[0], null, 2));
      }
    } catch (error) {
      console.log('❌ Search failed');
      console.log('   Error:', error.message);
      console.log('');
    }

    // Test 3: Try to get the specific exam directly
    console.log('3️⃣  Trying to get exam 37367871482 directly...\n');

    try {
      const exam = await hubspot.apiCall('GET', '/crm/v3/objects/2-50158913/37367871482');
      console.log('✅ Exam found!');
      console.log(JSON.stringify(exam, null, 2));
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('❌ Exam 37367871482 does NOT exist (404 Not Found)');
      } else {
        console.log('❌ Error:', error.message);
      }
      console.log('');
    }

    // Test 4: Check bookings custom object
    console.log('4️⃣  Testing Bookings Custom Object...\n');

    try {
      const searchResult = await hubspot.apiCall('POST', '/crm/v3/objects/2-50158943/search', {
        properties: ['is_active'],
        limit: 5
      });

      console.log('✅ Bookings object accessible!');
      console.log('   Total bookings:', searchResult.total || 0);
      console.log('');
    } catch (error) {
      console.log('❌ Bookings search failed:', error.message);
      console.log('');
    }

    // Test 5: Try to list ALL custom objects
    console.log('5️⃣  Listing all accessible custom objects...\n');

    try {
      const schemas = await hubspot.apiCall('GET', '/crm/v3/schemas');
      console.log(`✅ Found ${schemas.results?.length || 0} custom object(s):\n`);

      schemas.results?.forEach((schema, i) => {
        console.log(`   ${i + 1}. ${schema.label} (${schema.name})`);
        console.log(`      ID: ${schema.objectTypeId}`);
        console.log(`      Fully Qualified Name: ${schema.fullyQualifiedName}`);
        console.log('');
      });

      // Check if mock_exams is in the list
      const mockExamsSchema = schemas.results?.find(s =>
        s.objectTypeId === '2-50158913' ||
        s.name === 'mock_exams' ||
        s.fullyQualifiedName?.includes('mock')
      );

      if (mockExamsSchema) {
        console.log('✅ Mock Exams custom object found in schemas!');
        console.log('   Full details:');
        console.log(JSON.stringify(mockExamsSchema, null, 2));
      } else {
        console.log('❌ Mock Exams custom object NOT found in schemas!');
        console.log('   This HubSpot account may not have mock_exams configured');
      }
    } catch (error) {
      console.log('❌ Could not list schemas:', error.message);
    }

    console.log('\n\n========================================');
    console.log('CONNECTION TEST SUMMARY');
    console.log('========================================\n');

    console.log('If mock_exams custom object does not exist:');
    console.log('   - You may be connected to the wrong HubSpot account');
    console.log('   - The custom object may need to be created');
    console.log('   - Check HUBSPOT_OBJECTS constant matches actual object IDs');
    console.log('');
    console.log('If exam 37367871482 does not exist:');
    console.log('   - The exam was deleted from HubSpot');
    console.log('   - The ID is incorrect');
    console.log('   - Use the list-all-exams.js script to find existing exams');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

checkConnection().catch(console.error);
