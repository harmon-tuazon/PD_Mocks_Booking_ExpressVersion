/**
 * Find exams by time range (looking for 2:00PM-7:00PM)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function findExamsByTime() {
  console.log('\n========================================');
  console.log('FINDING EXAMS BY TIME (2:00PM-7:00PM)');
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

    console.log(`Total exams: ${exams.length}\n`);

    // Helper function to parse time
    function parseTime(timeValue) {
      if (!timeValue) return null;

      // Unix timestamp (milliseconds)
      if (typeof timeValue === 'number' || /^\d+$/.test(timeValue)) {
        const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
        const date = new Date(timestamp);
        return {
          hours: date.getHours(),
          minutes: date.getMinutes(),
          display: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        };
      }

      // HH:mm format
      if (/^\d{2}:\d{2}/.test(timeValue)) {
        const [hours, minutes] = timeValue.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return {
          hours,
          minutes,
          display: `${displayHour}:${String(minutes).padStart(2, '0')} ${ampm}`
        };
      }

      // Already formatted
      if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(timeValue)) {
        return { display: timeValue };
      }

      return null;
    }

    // Filter exams with 2:00PM start time and 7:00PM end time
    const matchingExams = [];

    exams.forEach(exam => {
      const startTime = parseTime(exam.properties.start_time);
      const endTime = parseTime(exam.properties.end_time);

      let startMatches = false;
      let endMatches = false;

      // Check if start time is 2:00 PM (14:00)
      if (startTime) {
        if (startTime.hours === 14 && startTime.minutes === 0) {
          startMatches = true;
        }
      }

      // Check if end time is 7:00 PM (19:00)
      if (endTime) {
        if (endTime.hours === 19 && endTime.minutes === 0) {
          endMatches = true;
        }
      }

      if (startMatches && endMatches) {
        matchingExams.push({
          exam,
          startTime,
          endTime
        });
      }
    });

    console.log(`Found ${matchingExams.length} exam(s) with 2:00PM-7:00PM time range:\n`);

    if (matchingExams.length === 0) {
      console.log('No exams found with 2:00PM-7:00PM time range');

      console.log('\nLet me show all exams with their time ranges:\n');
      console.log('='.repeat(120));

      exams.forEach((exam, index) => {
        const startTime = parseTime(exam.properties.start_time);
        const endTime = parseTime(exam.properties.end_time);

        console.log(`${index + 1}. ID: ${exam.id}`);
        console.log(`   Type: ${exam.properties.mock_type || 'Unknown'}`);
        console.log(`   Date: ${exam.properties.exam_date || 'Not set'}`);
        console.log(`   Location: ${exam.properties.location || 'Not set'}`);
        console.log(`   Start Time: ${startTime?.display || exam.properties.start_time || 'N/A'}`);
        console.log(`   End Time: ${endTime?.display || exam.properties.end_time || 'N/A'}`);
        console.log(`   Active: ${exam.properties.is_active}`);
        console.log('');
      });

      console.log('='.repeat(120));
    } else {
      matchingExams.forEach(({ exam, startTime, endTime }, index) => {
        console.log(`${index + 1}. 🎯 MATCH!`);
        console.log(`   ID: ${exam.id}`);
        console.log(`   Type: ${exam.properties.mock_type || 'Unknown'}`);
        console.log(`   Date: ${exam.properties.exam_date || 'Not set'}`);
        console.log(`   Location: ${exam.properties.location || 'Not set'}`);
        console.log(`   Start Time: ${startTime?.display || exam.properties.start_time}`);
        console.log(`   End Time: ${endTime?.display || exam.properties.end_time}`);
        console.log(`   Capacity: ${exam.properties.capacity || '0'}`);
        console.log(`   Active: ${exam.properties.is_active}`);
        console.log(`   Created: ${exam.properties.hs_createdate}`);
        console.log(`   Last Modified: ${exam.properties.hs_lastmodifieddate}`);

        // Check if this is a Mock Discussion
        if (exam.properties.mock_type === 'Mock Discussion') {
          console.log(`   ⭐ THIS IS A MOCK DISCUSSION!`);

          // Check for prerequisites
          console.log(`   Checking prerequisites...`);
        }

        console.log('');
      });

      // Now check prerequisites for Mock Discussion exams
      for (const { exam } of matchingExams) {
        if (exam.properties.mock_type === 'Mock Discussion') {
          console.log(`\nChecking prerequisites for ${exam.id}...`);

          try {
            const prerequisites = await hubspot.getMockExamAssociations(exam.id, 1340);

            if (prerequisites.length > 0) {
              console.log(`   ✅ ${prerequisites.length} prerequisite(s) found:`);
              prerequisites.forEach((prereq, i) => {
                console.log(`      ${i + 1}. ${prereq.properties.mock_type} - ${prereq.properties.exam_date} (ID: ${prereq.id})`);
              });
            } else {
              console.log('   ⚠️  No prerequisites associated');
            }
          } catch (error) {
            console.log('   ❌ Error fetching prerequisites:', error.message);
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

findExamsByTime().catch(console.error);
