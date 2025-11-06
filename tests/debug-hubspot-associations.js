/**
 * Debug script to directly test HubSpot associations API
 * This tests the raw HubSpot CRM API to verify associations exist
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const HS_PRIVATE_APP_TOKEN = process.env.HS_PRIVATE_APP_TOKEN;
const MOCK_DISCUSSION_EXAM_ID = '37367871482'; // From screenshot
const MOCK_EXAMS_OBJECT_TYPE = '2-50158913'; // Mock Exams object type ID
const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340; // "requires attendance at" association

async function debugHubSpotAssociations() {
  console.log('='.repeat(80));
  console.log('HUBSPOT ASSOCIATIONS DEBUG');
  console.log('='.repeat(80));
  console.log(`\nExam ID: ${MOCK_DISCUSSION_EXAM_ID}`);
  console.log(`Object Type: ${MOCK_EXAMS_OBJECT_TYPE}`);
  console.log(`Association Type ID: ${PREREQUISITE_ASSOCIATION_TYPE_ID}`);
  console.log('\n' + '-'.repeat(80));

  if (!HS_PRIVATE_APP_TOKEN) {
    console.error('❌ ERROR: HS_PRIVATE_APP_TOKEN not found in environment variables');
    console.error('Please ensure .env file is configured with HubSpot token');
    process.exit(1);
  }

  try {
    // Step 1: Fetch mock exam with associations
    console.log('\n[STEP 1] Fetching mock exam with associations from HubSpot');
    const url = `https://api.hubapi.com/crm/v3/objects/${MOCK_EXAMS_OBJECT_TYPE}/${MOCK_DISCUSSION_EXAM_ID}`;
    const params = {
      associations: MOCK_EXAMS_OBJECT_TYPE, // Request mock_exams associations
      properties: 'mock_type,exam_date,location,is_active'
    };

    console.log(`URL: ${url}`);
    console.log(`Params:`, params);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${HS_PRIVATE_APP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params
    });

    console.log('\n✅ Response received');
    console.log('Status:', response.status);

    // Step 2: Display basic exam info
    const exam = response.data;
    console.log('\n📋 Mock Exam Properties:');
    console.log(`  - ID: ${exam.id}`);
    console.log(`  - Type: ${exam.properties?.mock_type || 'N/A'}`);
    console.log(`  - Date: ${exam.properties?.exam_date || 'N/A'}`);
    console.log(`  - Location: ${exam.properties?.location || 'N/A'}`);
    console.log(`  - Is Active: ${exam.properties?.is_active || 'N/A'}`);

    // Step 3: Check associations
    console.log('\n🔗 Associations Data:');
    console.log('  - associations object present:', !!exam.associations);

    if (exam.associations) {
      console.log('  - Association types found:', Object.keys(exam.associations));

      if (exam.associations.mock_exams) {
        const mockExamAssociations = exam.associations.mock_exams;
        console.log(`  - mock_exams associations present: YES`);
        console.log(`  - Total associations count: ${mockExamAssociations.results?.length || 0}`);

        if (mockExamAssociations.results && mockExamAssociations.results.length > 0) {
          console.log('\n  📝 Association Details:');

          mockExamAssociations.results.forEach((assoc, idx) => {
            console.log(`\n    Association ${idx + 1}:`);
            console.log(`      - ID: ${assoc.id}`);
            console.log(`      - toObjectId: ${assoc.toObjectId}`);
            console.log(`      - Types array length: ${assoc.types?.length || 0}`);

            if (assoc.types && assoc.types.length > 0) {
              assoc.types.forEach((type, typeIdx) => {
                console.log(`        Type ${typeIdx + 1}:`);
                console.log(`          - associationCategory: ${type.associationCategory}`);
                console.log(`          - associationTypeId: ${type.associationTypeId}`);
                console.log(`          - label: ${type.label || 'N/A'}`);

                // Check if this matches our prerequisite type
                if (type.associationTypeId === PREREQUISITE_ASSOCIATION_TYPE_ID) {
                  console.log(`          ✅ MATCHES PREREQUISITE TYPE ID ${PREREQUISITE_ASSOCIATION_TYPE_ID}`);
                }
              });
            }
          });

          // Step 4: Filter for prerequisite associations
          console.log('\n' + '-'.repeat(80));
          console.log('\n[STEP 2] Filtering for prerequisite associations');
          const prerequisiteAssociations = mockExamAssociations.results.filter(assoc =>
            assoc.types?.some(type =>
              type.associationCategory === 'USER_DEFINED' &&
              type.associationTypeId === PREREQUISITE_ASSOCIATION_TYPE_ID
            )
          );

          console.log(`Found ${prerequisiteAssociations.length} prerequisite associations`);

          if (prerequisiteAssociations.length > 0) {
            console.log('\n✅ PREREQUISITE ASSOCIATIONS FOUND:');
            prerequisiteAssociations.forEach((assoc, idx) => {
              console.log(`  ${idx + 1}. Exam ID: ${assoc.toObjectId || assoc.id}`);
            });

            // Step 5: Fetch details for each prerequisite
            console.log('\n' + '-'.repeat(80));
            console.log('\n[STEP 3] Fetching details for prerequisite exams');

            for (const assoc of prerequisiteAssociations) {
              const prereqId = assoc.toObjectId || assoc.id;
              console.log(`\nFetching details for prerequisite exam: ${prereqId}`);

              try {
                const prereqResponse = await axios.get(
                  `https://api.hubapi.com/crm/v3/objects/${MOCK_EXAMS_OBJECT_TYPE}/${prereqId}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${HS_PRIVATE_APP_TOKEN}`,
                      'Content-Type': 'application/json'
                    },
                    params: {
                      properties: 'mock_type,exam_date,start_time,end_time,location,capacity,total_bookings,is_active'
                    }
                  }
                );

                const prereqExam = prereqResponse.data;
                console.log(`  ✅ Details retrieved:`);
                console.log(`    - Type: ${prereqExam.properties?.mock_type || 'N/A'}`);
                console.log(`    - Date: ${prereqExam.properties?.exam_date || 'N/A'}`);
                console.log(`    - Location: ${prereqExam.properties?.location || 'N/A'}`);
                console.log(`    - Is Active: ${prereqExam.properties?.is_active || 'N/A'}`);
              } catch (error) {
                console.error(`  ❌ Error fetching details: ${error.message}`);
              }
            }
          } else {
            console.log('\n⚠️  NO PREREQUISITE ASSOCIATIONS FOUND');
            console.log('\nPossible reasons:');
            console.log('  1. Association type ID 1340 is incorrect');
            console.log('  2. Associations were not created properly');
            console.log('  3. Association was deleted or modified');
            console.log('\n  All associations found (with their type IDs):');
            mockExamAssociations.results.forEach((assoc, idx) => {
              console.log(`    ${idx + 1}. Association ID: ${assoc.id}`);
              assoc.types?.forEach(type => {
                console.log(`       - Type ID: ${type.associationTypeId}, Category: ${type.associationCategory}`);
              });
            });
          }
        } else {
          console.log('\n  ⚠️  NO associations found in results array');
        }
      } else {
        console.log('  - mock_exams associations present: NO');
        console.log('\n  ⚠️  No mock_exams associations found at all');
      }
    } else {
      console.log('  ⚠️  No associations object in response');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.response) {
      console.error('\nResponse Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('\nNo response received from HubSpot');
      console.error('Check network connection and API token');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('DEBUG COMPLETE');
  console.log('='.repeat(80));
}

// Run the debug
debugHubSpotAssociations().catch(console.error);
