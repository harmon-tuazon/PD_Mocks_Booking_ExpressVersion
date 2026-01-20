/**
 * Find all Mock Discussion exams in HubSpot
 *
 * This will help identify the correct exam ID
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function findMockDiscussions() {
  console.log('\n========================================');
  console.log('FINDING MOCK DISCUSSION EXAMS');
  console.log('========================================\n');

  try {
    console.log('Searching for all Mock Discussion exams...\n');

    // Search for Mock Discussion exams
    const result = await hubspot.listMockExams({
      mockType: 'Mock Discussion',
      status: 'all', // Include both active and inactive
      page: 1,
      limit: 100
    });

    const mockDiscussions = result.results;

    console.log(`📊 Found ${mockDiscussions.length} Mock Discussion exam(s)\n`);

    if (mockDiscussions.length === 0) {
      console.log('❌ No Mock Discussion exams found in HubSpot');
      return;
    }

    console.log('Mock Discussion Exams:\n');
    console.log('='.repeat(100));

    mockDiscussions.forEach((exam, index) => {
      console.log(`\n${index + 1}. Exam ID: ${exam.id}`);
      console.log(`   Mock Type: ${exam.properties.mock_type}`);
      console.log(`   Exam Date: ${exam.properties.exam_date}`);
      console.log(`   Location: ${exam.properties.location || 'Not specified'}`);
      console.log(`   Start Time: ${exam.properties.start_time}`);
      console.log(`   End Time: ${exam.properties.end_time}`);
      console.log(`   Capacity: ${exam.properties.capacity}`);
      console.log(`   Is Active: ${exam.properties.is_active}`);
      console.log(`   Created: ${exam.properties.hs_createdate}`);
      console.log(`   Last Modified: ${exam.properties.hs_lastmodifieddate}`);

      // Check if this exam might be the one we're looking for
      if (exam.properties.start_time && exam.properties.start_time.includes('14:') ||
          exam.properties.start_time && exam.properties.start_time.includes('2:00')) {
        console.log('   ⭐ START TIME MATCHES 2:00 PM!');
      }

      if (exam.properties.end_time && exam.properties.end_time.includes('19:') ||
          exam.properties.end_time && exam.properties.end_time.includes('7:00')) {
        console.log('   ⭐ END TIME MATCHES 7:00 PM!');
      }
    });

    console.log('\n' + '='.repeat(100));

    // Now check for the specific exam ID that was reported
    console.log('\n\nChecking for exam ID 37367871482...');

    const found = mockDiscussions.find(exam => exam.id === '37367871482');

    if (found) {
      console.log('✅ FOUND! This exam exists in the results above');
    } else {
      console.log('❌ NOT FOUND! Exam 37367871482 does not exist in HubSpot');
      console.log('\n   Possible reasons:');
      console.log('   1. The exam was deleted');
      console.log('   2. The exam ID is incorrect');
      console.log('   3. The exam type was changed (no longer Mock Discussion)');
      console.log('   4. The exam is in a different HubSpot account');
    }

    // Now check if any of these Mock Discussions have prerequisites
    console.log('\n\n========================================');
    console.log('CHECKING PREREQUISITES');
    console.log('========================================\n');

    for (const exam of mockDiscussions) {
      console.log(`\nChecking prerequisites for ${exam.id} (${exam.properties.exam_date})...`);

      try {
        const prerequisites = await hubspot.getMockExamAssociations(exam.id, 1340);

        if (prerequisites.length > 0) {
          console.log(`   ✅ ${prerequisites.length} prerequisite(s) found:`);
          prerequisites.forEach((prereq, i) => {
            console.log(`      ${i + 1}. ${prereq.properties.mock_type} - ${prereq.properties.exam_date}`);
          });
        } else {
          console.log('   ⚠️  No prerequisites associated');
        }
      } catch (error) {
        console.log('   ❌ Error fetching prerequisites:', error.message);
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

findMockDiscussions().catch(console.error);
