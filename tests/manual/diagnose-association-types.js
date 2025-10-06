/**
 * Diagnostic Script: Check Association Types and Labels
 *
 * This script queries HubSpot to identify different association types/labels
 * between Mock Exams and Bookings to determine if "Mock Bookings" label filtering is needed.
 *
 * Usage: node tests/manual/diagnose-association-types.js
 */

require('dotenv').config();
const axios = require('axios');

const HUBSPOT_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const HUBSPOT_OBJECTS = {
  bookings: '2-50158943',
  mock_exams: '2-50158913'
};

const hubspotApi = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Get all mock exams
 */
async function getAllMockExams() {
  console.log('📊 Fetching all mock exams from HubSpot...\n');

  const searchPayload = {
    filterGroups: [],
    properties: [
      'exam_date',
      'mock_type',
      'capacity',
      'total_bookings',
      'is_active',
      'hs_object_id'
    ],
    limit: 100
  };

  try {
    const response = await hubspotApi.post(
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      searchPayload
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch mock exams:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get associations for a mock exam with association type details
 */
async function getMockExamAssociationsWithTypes(mockExamId) {
  console.log(`\n🔗 Fetching associations for mock exam ${mockExamId}...\n`);

  try {
    const response = await hubspotApi.get(
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}/associations/${HUBSPOT_OBJECTS.bookings}`
    );

    return response.data.results || [];
  } catch (error) {
    console.error(`❌ Failed to fetch associations for ${mockExamId}:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Get association schema/types between mock exams and bookings
 */
async function getAssociationSchema() {
  console.log('📋 Fetching association schema between Mock Exams and Bookings...\n');

  try {
    // Get association types from object to object
    const response = await hubspotApi.get(
      `/crm/v4/associations/${HUBSPOT_OBJECTS.mock_exams}/${HUBSPOT_OBJECTS.bookings}/labels`
    );

    return response.data.results || [];
  } catch (error) {
    console.error('❌ Failed to fetch association schema:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Analyze association types across all mock exams
 */
async function analyzeAssociationTypes(mockExams) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ASSOCIATION TYPE ANALYSIS REPORT');
  console.log('='.repeat(80) + '\n');

  const associationTypeStats = new Map();
  const mockExamAssociations = [];

  for (const mockExam of mockExams) {
    const associations = await getMockExamAssociationsWithTypes(mockExam.id);

    if (associations.length > 0) {
      console.log(`\n📋 Mock Exam: ${mockExam.properties.mock_type} - ${mockExam.properties.exam_date}`);
      console.log(`   ID: ${mockExam.id}`);
      console.log(`   Total Bookings (stored): ${mockExam.properties.total_bookings}`);
      console.log(`   Total Associations found: ${associations.length}`);

      const typeBreakdown = new Map();

      associations.forEach(assoc => {
        // HubSpot v4 API returns association type information
        const types = assoc.associationTypes || [];

        types.forEach(type => {
          const typeKey = `${type.category}_${type.typeId}`;
          const typeName = type.label || `Type ${type.typeId}`;

          if (!typeBreakdown.has(typeKey)) {
            typeBreakdown.set(typeKey, {
              category: type.category,
              typeId: type.typeId,
              label: typeName,
              count: 0,
              bookingIds: []
            });
          }

          const typeInfo = typeBreakdown.get(typeKey);
          typeInfo.count++;
          typeInfo.bookingIds.push(assoc.toObjectId);

          // Update global stats
          if (!associationTypeStats.has(typeKey)) {
            associationTypeStats.set(typeKey, {
              category: type.category,
              typeId: type.typeId,
              label: typeName,
              totalCount: 0,
              mockExamsUsing: new Set()
            });
          }

          const globalStats = associationTypeStats.get(typeKey);
          globalStats.totalCount++;
          globalStats.mockExamsUsing.add(mockExam.id);
        });
      });

      if (typeBreakdown.size > 0) {
        console.log(`\n   Association Type Breakdown:`);
        typeBreakdown.forEach((info, typeKey) => {
          console.log(`     - ${info.label} (${info.category}, ID: ${info.typeId}): ${info.count} booking(s)`);
          console.log(`       Booking IDs: ${info.bookingIds.join(', ')}`);
        });
      } else {
        console.log(`   ⚠️  No association type information available (might be default associations)`);
      }

      mockExamAssociations.push({
        mockExam: mockExam,
        associations: associations,
        typeBreakdown: typeBreakdown
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 GLOBAL ASSOCIATION TYPE STATISTICS');
  console.log('='.repeat(80) + '\n');

  if (associationTypeStats.size === 0) {
    console.log('⚠️  No labeled association types found. All associations may be using default/unlabeled type.');
    console.log('   This means the API is returning all associations without type filtering.\n');
  } else {
    console.log(`Found ${associationTypeStats.size} distinct association type(s):\n`);

    associationTypeStats.forEach((stats, typeKey) => {
      console.log(`📌 ${stats.label}`);
      console.log(`   Category: ${stats.category}`);
      console.log(`   Type ID: ${stats.typeId}`);
      console.log(`   Total Associations: ${stats.totalCount}`);
      console.log(`   Used by ${stats.mockExamsUsing.size} Mock Exam(s)\n`);
    });
  }

  // Check for discrepancies
  console.log('='.repeat(80));
  console.log('🔍 CHECKING FOR DISCREPANCIES');
  console.log('='.repeat(80) + '\n');

  let discrepancyCount = 0;

  mockExamAssociations.forEach(({ mockExam, associations, typeBreakdown }) => {
    const storedTotal = parseInt(mockExam.properties.total_bookings) || 0;
    const actualTotal = associations.length;

    if (storedTotal !== actualTotal) {
      discrepancyCount++;
      console.log(`\n⚠️  DISCREPANCY FOUND:`);
      console.log(`   Mock Exam: ${mockExam.properties.mock_type} - ${mockExam.properties.exam_date}`);
      console.log(`   ID: ${mockExam.id}`);
      console.log(`   Stored total_bookings: ${storedTotal}`);
      console.log(`   Actual associations: ${actualTotal}`);
      console.log(`   Difference: ${actualTotal - storedTotal}`);

      if (typeBreakdown.size > 1) {
        console.log(`   ⚠️  This exam has MULTIPLE association types!`);
        typeBreakdown.forEach((info, typeKey) => {
          console.log(`     - ${info.label}: ${info.count} booking(s)`);
        });
        console.log(`   💡 This might indicate that total_bookings should only count specific labeled associations!`);
      }
    }
  });

  if (discrepancyCount === 0) {
    console.log('✅ No discrepancies found between stored total_bookings and actual associations.');
  }

  return { associationTypeStats, mockExamAssociations };
}

/**
 * Main diagnostic function
 */
async function runDiagnostic() {
  try {
    console.log('🔍 Starting Association Type Diagnostic...\n');
    console.log('This script will check all association types between Mock Exams and Bookings.\n');

    // Step 1: Get association schema
    console.log('Step 1: Fetching association schema...\n');
    const schema = await getAssociationSchema();

    if (schema.length > 0) {
      console.log(`✅ Found ${schema.length} defined association type(s):\n`);
      schema.forEach(type => {
        console.log(`   - ${type.label || 'Unlabeled'} (Category: ${type.category}, ID: ${type.typeId})`);
      });
    } else {
      console.log('⚠️  No association schema found or using default associations.\n');
    }

    // Step 2: Get all mock exams
    console.log('\nStep 2: Fetching all mock exams...\n');
    const mockExams = await getAllMockExams();
    console.log(`✅ Found ${mockExams.length} total mock exam(s)\n`);

    if (mockExams.length === 0) {
      console.log('No mock exams found in HubSpot. Exiting.');
      return;
    }

    // Step 3: Analyze association types
    console.log('\nStep 3: Analyzing association types for each mock exam...\n');
    const results = await analyzeAssociationTypes(mockExams);

    console.log('\n' + '='.repeat(80));
    console.log('📋 DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80) + '\n');

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');

    if (results.associationTypeStats.size > 1) {
      console.log('⚠️  MULTIPLE ASSOCIATION TYPES DETECTED!');
      console.log('   Your code currently fetches ALL associations without filtering by type.');
      console.log('   If only "Mock Bookings" labeled associations should count:');
      console.log('   1. Update API calls to filter by association type ID');
      console.log('   2. Or update total_bookings calculation to only count specific types\n');
    } else if (results.associationTypeStats.size === 1) {
      const singleType = Array.from(results.associationTypeStats.values())[0];
      console.log(`✅ Only one association type found: "${singleType.label}"`);
      console.log('   Current behavior (counting all associations) is correct.\n');
    } else {
      console.log('✅ All associations appear to use default/unlabeled type.');
      console.log('   Current behavior (counting all associations) is correct.\n');
    }

    return results;

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDiagnostic()
    .then(() => {
      console.log('\n✅ Diagnostic complete.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runDiagnostic, getAssociationSchema, analyzeAssociationTypes };
