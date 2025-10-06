/**
 * Comprehensive Association Type Testing Script
 *
 * This script performs extensive testing to:
 * 1. Check if association type 1292 exists
 * 2. List all available association types between bookings and mock exams
 * 3. Test association creation with different methods
 * 4. Provide recommendations for fixes
 *
 * Usage: node tests/manual/test-association-type.js
 */

require('dotenv').config();
const axios = require('axios');

const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_OBJECTS = {
  bookings: '2-50158943',
  mock_exams: '2-50158913',
  contacts: '0-1'
};

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * List all association types between two object types
 */
async function listAssociationTypes() {
  console.log('📋 Checking all available association types between Bookings and Mock Exams...\n');

  try {
    // Try to get association labels/types using the schema API
    const schemaResponse = await hubspotApi.get(
      `/crm/v4/associations/${HUBSPOT_OBJECTS.bookings}/${HUBSPOT_OBJECTS.mock_exams}/labels`
    ).catch(error => {
      console.log('   ⚠️ Schema API not available or no labels defined');
      return null;
    });

    if (schemaResponse && schemaResponse.data) {
      console.log('✅ Available association labels:\n');
      const results = schemaResponse.data.results || [];

      if (results.length === 0) {
        console.log('   No custom labels found.\n');
      } else {
        results.forEach(label => {
          console.log(`   Type ID: ${label.typeId}`);
          console.log(`   Label: ${label.label || 'Unlabeled'}`);
          console.log(`   Category: ${label.category}`);
          console.log('   ' + '-'.repeat(40));
        });
      }
    }

    // Also check reverse direction
    console.log('\n📋 Checking reverse direction (Mock Exam → Booking)...\n');

    const reverseResponse = await hubspotApi.get(
      `/crm/v4/associations/${HUBSPOT_OBJECTS.mock_exams}/${HUBSPOT_OBJECTS.bookings}/labels`
    ).catch(error => {
      console.log('   ⚠️ No labels in reverse direction');
      return null;
    });

    if (reverseResponse && reverseResponse.data) {
      const results = reverseResponse.data.results || [];
      if (results.length > 0) {
        console.log('✅ Reverse association labels:\n');
        results.forEach(label => {
          console.log(`   Type ID: ${label.typeId}`);
          console.log(`   Label: ${label.label || 'Unlabeled'}`);
          console.log(`   Category: ${label.category}`);
          console.log('   ' + '-'.repeat(40));
        });
      }
    }

  } catch (error) {
    console.error('❌ Failed to list association types:', error.response?.data || error.message);
  }
}

/**
 * Test creating associations with different methods
 */
async function testAssociationMethods() {
  console.log('\n🧪 Testing different association creation methods...\n');
  console.log('='.repeat(80) + '\n');

  let bookingId, mockExamId;

  try {
    // Create test objects
    console.log('1️⃣ Creating test objects...\n');

    // Create test booking
    const bookingResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}`,
      {
        properties: {
          booking_id: `TEST-${Date.now()}`,
          name: 'Association Test',
          email: 'test@example.com',
          is_active: 'Active'
        }
      }
    );
    bookingId = bookingResponse.data.id;
    console.log(`   ✅ Test booking created: ${bookingId}`);

    // Find a mock exam
    const mockExamResponse = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      {
        filterGroups: [],
        properties: ['exam_date', 'mock_type'],
        limit: 1
      }
    );

    if (!mockExamResponse.data.results?.length) {
      throw new Error('No mock exams found');
    }

    mockExamId = mockExamResponse.data.results[0].id;
    console.log(`   ✅ Using mock exam: ${mockExamId}\n`);

    // Test Method 1: V4 API with Type 1292
    console.log('2️⃣ Test Method 1: V4 API with Type 1292 (USER_DEFINED)...\n');

    try {
      const v4Response = await hubspotApi.put(
        `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`,
        [
          {
            associationCategory: 'USER_DEFINED',
            associationTypeId: 1292
          }
        ]
      );
      console.log('   ✅ SUCCESS: V4 API with Type 1292 worked!');
      console.log(`   Response:`, JSON.stringify(v4Response.data, null, 2));
    } catch (error) {
      console.log('   ❌ FAILED: V4 API with Type 1292');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.context) {
        console.log(`   Context:`, JSON.stringify(error.response.data.context, null, 2));
      }
    }

    console.log('\n' + '-'.repeat(80) + '\n');

    // Test Method 2: V4 API without type (default)
    console.log('3️⃣ Test Method 2: V4 API with empty array (default association)...\n');

    try {
      const v4DefaultResponse = await hubspotApi.put(
        `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`,
        []
      );
      console.log('   ✅ SUCCESS: V4 API with default association worked!');
      console.log(`   Response:`, JSON.stringify(v4DefaultResponse.data, null, 2));
    } catch (error) {
      console.log('   ❌ FAILED: V4 API with default association');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

    console.log('\n' + '-'.repeat(80) + '\n');

    // Test Method 3: V3 API batch association
    console.log('4️⃣ Test Method 3: V3 API batch association...\n');

    try {
      const v3Response = await hubspotApi.post(
        `/crm/v3/associations/${HUBSPOT_OBJECTS.bookings}/${HUBSPOT_OBJECTS.mock_exams}/batch/create`,
        {
          inputs: [
            {
              from: { id: bookingId },
              to: { id: mockExamId },
              type: 'booking_to_mock_exam'  // Try with a label
            }
          ]
        }
      );
      console.log('   ✅ SUCCESS: V3 batch API worked!');
      console.log(`   Response:`, JSON.stringify(v3Response.data, null, 2));
    } catch (error) {
      // Try without type
      try {
        const v3ResponseNoType = await hubspotApi.post(
          `/crm/v3/associations/${HUBSPOT_OBJECTS.bookings}/${HUBSPOT_OBJECTS.mock_exams}/batch/create`,
          {
            inputs: [
              {
                from: { id: bookingId },
                to: { id: mockExamId }
                // No type specified - use default
              }
            ]
          }
        );
        console.log('   ✅ SUCCESS: V3 batch API (without type) worked!');
        console.log(`   Response:`, JSON.stringify(v3ResponseNoType.data, null, 2));
      } catch (error2) {
        console.log('   ❌ FAILED: V3 batch API');
        console.log(`   Error: ${error2.response?.data?.message || error2.message}`);
      }
    }

    console.log('\n' + '-'.repeat(80) + '\n');

    // Verify what associations were created
    console.log('5️⃣ Verifying created associations...\n');

    try {
      const verifyResponse = await hubspotApi.get(
        `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}`
      );

      console.log('   Current associations:');
      const associations = verifyResponse.data.results || [];

      if (associations.length === 0) {
        console.log('   ⚠️ No associations found!');
      } else {
        associations.forEach(assoc => {
          console.log(`\n   To Mock Exam: ${assoc.toObjectId}`);
          const types = assoc.associationTypes || [];
          types.forEach(type => {
            console.log(`     - Type ID: ${type.typeId}`);
            console.log(`       Category: ${type.category}`);
            console.log(`       Label: ${type.label || 'No label'}`);
          });
        });
      }
    } catch (error) {
      console.log('   ❌ Failed to verify associations:', error.message);
    }

    // Cleanup
    console.log('\n\n6️⃣ Cleaning up test data...\n');

    if (bookingId) {
      await hubspotApi.delete(`/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
      console.log(`   ✅ Deleted test booking: ${bookingId}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    // Cleanup on error
    if (bookingId) {
      try {
        await hubspotApi.delete(`/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
        console.log('   ✅ Cleaned up test booking');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check association type 1292 specifically
 */
async function checkType1292() {
  console.log('\n🔍 Checking association type 1292 specifically...\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Try to get info about type 1292
    const response = await hubspotApi.get(
      `/crm/v4/associations/${HUBSPOT_OBJECTS.bookings}/${HUBSPOT_OBJECTS.mock_exams}/labels`
    ).catch(() => null);

    if (response && response.data) {
      const type1292 = response.data.results?.find(r => r.typeId === 1292);

      if (type1292) {
        console.log('✅ Type 1292 EXISTS in HubSpot schema!');
        console.log(`   Label: ${type1292.label}`);
        console.log(`   Category: ${type1292.category}`);
      } else {
        console.log('❌ Type 1292 NOT FOUND in available association types.');
        console.log('   This type ID may not be valid for Booking → Mock Exam associations.');
      }
    } else {
      console.log('⚠️ Could not verify Type 1292 - association labels API not accessible.');
    }

  } catch (error) {
    console.error('❌ Error checking Type 1292:', error.message);
  }
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(findings) {
  console.log('\n💡 RECOMMENDATIONS\n');
  console.log('='.repeat(80) + '\n');

  console.log('Based on the test results, here are the recommended fixes:\n');

  console.log('1. **Primary Issue**: Association Type 1292 may not be valid');
  console.log('   - The type ID 1292 might not exist for Booking → Mock Exam associations');
  console.log('   - Consider using default associations (empty array) instead\n');

  console.log('2. **Recommended Fix for `/api/_shared/hubspot.js`**:\n');
  console.log('```javascript');
  console.log('async createAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId) {');
  console.log('  const path = `/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`;');
  console.log('  ');
  console.log('  // For Booking → Mock Exam, use default association (empty array)');
  console.log('  // HubSpot will automatically create the correct association type');
  console.log('  const payload = [];');
  console.log('  ');
  console.log('  console.log(`🔗 Creating association: ${fromObjectType}(${fromObjectId}) → ${toObjectType}(${toObjectId})`);');
  console.log('  ');
  console.log('  try {');
  console.log('    const result = await this.apiCall("PUT", path, payload);');
  console.log('    console.log(`✅ Association created successfully`);');
  console.log('    return result;');
  console.log('  } catch (error) {');
  console.log('    console.error(`❌ Association failed:`, error.response?.data || error.message);');
  console.log('    throw error;');
  console.log('  }');
  console.log('}');
  console.log('```\n');

  console.log('3. **Alternative: Use V3 Batch API**:');
  console.log('   - If V4 continues to fail, switch to V3 batch association API');
  console.log('   - V3 is more reliable for custom object associations\n');

  console.log('4. **Testing Steps**:');
  console.log('   - Remove the Type 1292 specification');
  console.log('   - Use empty array for payload to let HubSpot use defaults');
  console.log('   - Test with actual booking creation flow');
  console.log('   - Verify associations are visible in HubSpot UI\n');
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n🚀 HUBSPOT ASSOCIATION TYPE DIAGNOSTIC\n');
  console.log('='.repeat(80));
  console.log('\nThis script will diagnose why Booking → Mock Exam associations are failing\n');
  console.log('='.repeat(80) + '\n');

  if (!HUBSPOT_TOKEN) {
    console.error('❌ Error: HS_PRIVATE_APP_TOKEN environment variable not set');
    process.exit(1);
  }

  const findings = {};

  // Step 1: Check Type 1292
  await checkType1292();

  // Step 2: List all available association types
  await listAssociationTypes();

  // Step 3: Test different association methods
  await testAssociationMethods();

  // Step 4: Generate recommendations
  generateRecommendations(findings);

  console.log('\n✅ Diagnostic complete!\n');
}

// Run if called directly
if (require.main === module) {
  runTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };