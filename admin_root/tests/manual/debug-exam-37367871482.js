/**
 * Deep Diagnostic Script for Exam 37367871482
 *
 * Investigates two issues:
 * 1. Prerequisites not showing (should show December 4 Clinical Skills)
 * 2. Wrong time display (should be 2:00PM-7:00PM)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

const EXAM_ID = '37367871482';
const PREREQUISITE_ASSOCIATION_TYPE = 1340;

async function debugExam() {
  console.log('\n========================================');
  console.log('DEEP DIAGNOSTIC: Exam 37367871482');
  console.log('========================================\n');

  try {
    // ============================================
    // PART 1: BASIC EXAM INFORMATION
    // ============================================
    console.log('1️⃣  FETCHING EXAM DETAILS FROM HUBSPOT...\n');

    const exam = await hubspot.getMockExam(EXAM_ID);

    console.log('📋 Exam Properties:');
    console.log('   Mock Type:', exam.properties.mock_type);
    console.log('   Exam Date:', exam.properties.exam_date);
    console.log('   Location:', exam.properties.location);
    console.log('   Capacity:', exam.properties.capacity);
    console.log('   Is Active:', exam.properties.is_active);
    console.log('   Start Time (raw):', exam.properties.start_time);
    console.log('   End Time (raw):', exam.properties.end_time);

    // ============================================
    // PART 2: TIME ANALYSIS
    // ============================================
    console.log('\n\n2️⃣  ANALYZING TIME VALUES...\n');

    const startTime = exam.properties.start_time;
    const endTime = exam.properties.end_time;

    console.log('Start Time Analysis:');
    console.log('   Raw value:', startTime);
    console.log('   Type:', typeof startTime);

    if (startTime) {
      // Check if it's a Unix timestamp
      if (typeof startTime === 'number' || /^\d+$/.test(startTime)) {
        const timestamp = typeof startTime === 'string' ? parseInt(startTime) : startTime;
        const date = new Date(timestamp);
        console.log('   Parsed as Unix timestamp:', date.toISOString());
        console.log('   Local time:', date.toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        console.log('   Hour:', date.getHours());

        // Expected: 14:00 for 2:00PM
        if (date.getHours() === 14) {
          console.log('   ✅ Correct! This is 2:00 PM');
        } else {
          console.log('   ❌ WRONG! Expected hour 14 (2:00 PM), got', date.getHours());
        }
      }
      // Check if it's HH:mm format
      else if (/^\d{2}:\d{2}/.test(startTime)) {
        console.log('   Format: HH:mm');
        const [hours, minutes] = startTime.split(':').map(Number);
        console.log('   Hours:', hours, '   Minutes:', minutes);

        if (hours === 14) {
          console.log('   ✅ Correct! This is 2:00 PM (14:00)');
        } else {
          console.log('   ❌ WRONG! Expected hour 14 (2:00 PM), got', hours);
        }
      }
    }

    console.log('\nEnd Time Analysis:');
    console.log('   Raw value:', endTime);
    console.log('   Type:', typeof endTime);

    if (endTime) {
      // Check if it's a Unix timestamp
      if (typeof endTime === 'number' || /^\d+$/.test(endTime)) {
        const timestamp = typeof endTime === 'string' ? parseInt(endTime) : endTime;
        const date = new Date(timestamp);
        console.log('   Parsed as Unix timestamp:', date.toISOString());
        console.log('   Local time:', date.toLocaleString('en-US', { timeZone: 'America/Toronto' }));
        console.log('   Hour:', date.getHours());

        // Expected: 19:00 for 7:00PM
        if (date.getHours() === 19) {
          console.log('   ✅ Correct! This is 7:00 PM');
        } else {
          console.log('   ❌ WRONG! Expected hour 19 (7:00 PM), got', date.getHours());
        }
      }
      // Check if it's HH:mm format
      else if (/^\d{2}:\d{2}/.test(endTime)) {
        console.log('   Format: HH:mm');
        const [hours, minutes] = endTime.split(':').map(Number);
        console.log('   Hours:', hours, '   Minutes:', minutes);

        if (hours === 19) {
          console.log('   ✅ Correct! This is 7:00 PM (19:00)');
        } else {
          console.log('   ❌ WRONG! Expected hour 19 (7:00 PM), got', hours);
        }
      }
    }

    // ============================================
    // PART 3: PREREQUISITE ASSOCIATIONS
    // ============================================
    console.log('\n\n3️⃣  CHECKING PREREQUISITE ASSOCIATIONS...\n');

    // First check if this is a Mock Discussion
    if (exam.properties.mock_type !== 'Mock Discussion') {
      console.log('❌ This is NOT a Mock Discussion exam!');
      console.log('   Current type:', exam.properties.mock_type);
      console.log('   Prerequisites only apply to Mock Discussion exams');
      return;
    }

    console.log('✅ Confirmed: This is a Mock Discussion exam\n');

    // Fetch associations using the HubSpot service method
    console.log('Fetching prerequisite associations (Type 1340)...\n');

    try {
      const prerequisites = await hubspot.getMockExamAssociations(EXAM_ID, PREREQUISITE_ASSOCIATION_TYPE);

      console.log(`📊 Found ${prerequisites.length} prerequisite association(s)\n`);

      if (prerequisites.length === 0) {
        console.log('❌ NO PREREQUISITES FOUND!');
        console.log('\n   Possible reasons:');
        console.log('   1. Associations truly don\'t exist in HubSpot');
        console.log('   2. Wrong association type ID (should be 1340)');
        console.log('   3. Associations were deleted');
        console.log('   4. Cache issue (but we\'re querying HubSpot directly)');
      } else {
        console.log('✅ PREREQUISITES EXIST! Details:\n');

        prerequisites.forEach((prereq, index) => {
          console.log(`   Prerequisite ${index + 1}:`);
          console.log('      ID:', prereq.id);
          console.log('      Mock Type:', prereq.properties.mock_type);
          console.log('      Exam Date:', prereq.properties.exam_date);
          console.log('      Location:', prereq.properties.location);
          console.log('      Start Time:', prereq.properties.start_time);
          console.log('      End Time:', prereq.properties.end_time);
          console.log('      Is Active:', prereq.properties.is_active);
          console.log('');

          // Check if this is the December 4 Clinical Skills exam
          if (prereq.properties.exam_date === '2024-12-04' &&
              prereq.properties.mock_type === 'Clinical Skills') {
            console.log('      ✅ THIS IS THE DECEMBER 4 CLINICAL SKILLS EXAM!');
          }
        });
      }
    } catch (error) {
      console.error('❌ ERROR fetching prerequisites:', error.message);
      if (error.response?.status === 404) {
        console.log('\n   HubSpot returned 404 - Exam not found or no associations');
      }
    }

    // ============================================
    // PART 4: RAW ASSOCIATIONS API CALL
    // ============================================
    console.log('\n\n4️⃣  RAW HUBSPOT API CALL FOR ASSOCIATIONS...\n');

    try {
      // Make raw API call to see ALL associations
      const rawResponse = await hubspot.apiCall(
        'GET',
        `/crm/v3/objects/2-50158913/${EXAM_ID}?associations=2-50158913`
      );

      console.log('Full response structure:');
      console.log(JSON.stringify(rawResponse, null, 2));

      if (rawResponse.associations?.['2-50158913']?.results) {
        const allAssociations = rawResponse.associations['2-50158913'].results;
        console.log(`\n📊 Total associations: ${allAssociations.length}`);

        // Filter for type 1340
        const type1340 = allAssociations.filter(assoc =>
          assoc.types?.some(type => type.associationTypeId === 1340)
        );

        console.log(`📊 Type 1340 associations: ${type1340.length}`);

        if (type1340.length > 0) {
          console.log('\n✅ Type 1340 associations found:');
          type1340.forEach((assoc, index) => {
            console.log(`\n   Association ${index + 1}:`);
            console.log('      To Object ID:', assoc.toObjectId || assoc.id);
            console.log('      Types:', JSON.stringify(assoc.types, null, 2));
          });
        }
      } else {
        console.log('\n❌ No associations found in raw response');
      }
    } catch (error) {
      console.error('❌ ERROR in raw API call:', error.message);
    }

    // ============================================
    // PART 5: TEST THE GET ENDPOINT LOGIC
    // ============================================
    console.log('\n\n5️⃣  TESTING THE GET ENDPOINT LOGIC...\n');

    // Simulate what the [id].js endpoint does
    console.log('Simulating backend endpoint logic:\n');

    if (exam.properties.mock_type === 'Mock Discussion') {
      console.log('✅ Exam is Mock Discussion - will fetch prerequisites');

      try {
        const prerequisites = await hubspot.getMockExamAssociations(
          EXAM_ID,
          PREREQUISITE_ASSOCIATION_TYPE
        );

        const prerequisiteDetails = prerequisites.map(exam => ({
          id: exam.id,
          mock_type: exam.properties.mock_type,
          exam_date: exam.properties.exam_date,
          location: exam.properties.location || 'Not specified',
          start_time: exam.properties.start_time,
          end_time: exam.properties.end_time,
          capacity: parseInt(exam.properties.capacity || '0'),
          total_bookings: parseInt(exam.properties.total_bookings || '0'),
          is_active: exam.properties.is_active === 'true'
        }));

        prerequisiteDetails.sort((a, b) => {
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);
          return dateA - dateB;
        });

        console.log(`✅ Backend would return ${prerequisiteDetails.length} prerequisites:\n`);
        console.log(JSON.stringify(prerequisiteDetails, null, 2));
      } catch (error) {
        console.error('❌ Backend would catch error and return empty arrays');
        console.error('   Error:', error.message);
      }
    } else {
      console.log('❌ Exam is NOT Mock Discussion - no prerequisites fetched');
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n========================================');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('========================================\n');

    console.log('Issue 1: Prerequisites not showing');
    if (exam.properties.mock_type !== 'Mock Discussion') {
      console.log('   ❌ ROOT CAUSE: Exam type is NOT "Mock Discussion"');
      console.log(`      Current type: "${exam.properties.mock_type}"`);
      console.log('      Fix: Update exam type to "Mock Discussion" in HubSpot');
    } else {
      console.log('   ⚠️  Need to check association results above');
    }

    console.log('\nIssue 2: Wrong time display');
    console.log('   Check time analysis in Part 2 above');
    console.log('   Expected: 14:00 (2:00 PM) and 19:00 (7:00 PM)');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the diagnostic
debugExam().catch(console.error);
