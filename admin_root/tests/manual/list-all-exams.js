/**
 * List ALL mock exams to see what's in HubSpot
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function listAllExams() {
  console.log('\n========================================');
  console.log('LISTING ALL MOCK EXAMS');
  console.log('========================================\n');

  try {
    console.log('Fetching all mock exams...\n');

    // Get all exams
    const result = await hubspot.listMockExams({
      status: 'all',
      page: 1,
      limit: 100
    });

    const exams = result.results;

    console.log(`📊 Found ${exams.length} total mock exam(s)\n`);

    if (exams.length === 0) {
      console.log('❌ No exams found in HubSpot');
      return;
    }

    // Group by mock type
    const byType = {};
    exams.forEach(exam => {
      const type = exam.properties.mock_type || 'Unknown';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(exam);
    });

    console.log('Breakdown by Type:');
    Object.keys(byType).forEach(type => {
      console.log(`   ${type}: ${byType[type].length} exam(s)`);
    });

    console.log('\n' + '='.repeat(120));
    console.log('\nDETAILED EXAM LIST:\n');

    exams.forEach((exam, index) => {
      console.log(`${index + 1}. ID: ${exam.id}`);
      console.log(`   Type: ${exam.properties.mock_type || 'Unknown'}`);
      console.log(`   Date: ${exam.properties.exam_date || 'Not set'}`);
      console.log(`   Location: ${exam.properties.location || 'Not set'}`);
      console.log(`   Time: ${exam.properties.start_time || 'N/A'} - ${exam.properties.end_time || 'N/A'}`);
      console.log(`   Capacity: ${exam.properties.capacity || '0'}`);
      console.log(`   Active: ${exam.properties.is_active}`);

      // Highlight if this matches our search criteria
      if (exam.id === '37367871482') {
        console.log('   🔴 THIS IS THE EXAM WE WERE LOOKING FOR!');
      }

      // Check if start time is 2:00 PM
      const startTime = exam.properties.start_time;
      if (startTime) {
        if (startTime.includes('14:') || startTime.includes('2:00 PM') || startTime.includes('2:00PM')) {
          console.log('   ⭐ START TIME IS 2:00 PM');
        }
      }

      // Check if end time is 7:00 PM
      const endTime = exam.properties.end_time;
      if (endTime) {
        if (endTime.includes('19:') || endTime.includes('7:00 PM') || endTime.includes('7:00PM')) {
          console.log('   ⭐ END TIME IS 7:00 PM');
        }
      }

      console.log('');
    });

    console.log('='.repeat(120));

    // Now check the specific exam ID
    console.log('\n\n🔍 SEARCHING FOR EXAM ID: 37367871482\n');

    const targetExam = exams.find(exam => exam.id === '37367871482');

    if (targetExam) {
      console.log('✅ FOUND! Here are the details:\n');
      console.log(JSON.stringify(targetExam, null, 2));
    } else {
      console.log('❌ NOT FOUND in the list of all exams');
      console.log('\n   This exam either:');
      console.log('   1. Does not exist in HubSpot');
      console.log('   2. Was deleted');
      console.log('   3. The ID is incorrect');
    }

    // Check for exams with similar IDs
    console.log('\n\n🔍 CHECKING FOR SIMILAR EXAM IDs:\n');

    const similarIds = exams.filter(exam => {
      const id = exam.id;
      return id.startsWith('373') || id.endsWith('482');
    });

    if (similarIds.length > 0) {
      console.log(`Found ${similarIds.length} exam(s) with similar IDs:`);
      similarIds.forEach(exam => {
        console.log(`   - ${exam.id} (${exam.properties.mock_type}, ${exam.properties.exam_date})`);
      });
    } else {
      console.log('No exams with similar IDs found');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

listAllExams().catch(console.error);
