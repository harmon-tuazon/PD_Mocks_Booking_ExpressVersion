/**
 * Direct HubSpot search to find all exams
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function directSearch() {
  console.log('\n========================================');
  console.log('DIRECT HUBSPOT SEARCH');
  console.log('========================================\n');

  try {
    console.log('Performing direct search on mock_exams object...\n');

    // Direct API call to search
    const searchResult = await hubspot.apiCall('POST', '/crm/v3/objects/2-50158913/search', {
      properties: [
        'mock_type',
        'exam_date',
        'start_time',
        'end_time',
        'location',
        'capacity',
        'is_active'
      ],
      limit: 100,
      sorts: [
        {
          propertyName: 'exam_date',
          direction: 'ASCENDING'
        }
      ]
    });

    const exams = searchResult.results || [];

    console.log(`Total exams found: ${searchResult.total || 0}`);
    console.log(`Returned in this page: ${exams.length}\n`);

    if (exams.length === 0) {
      console.log('❌ No exams found!');
      console.log('\nThis means the HubSpot instance has NO mock exams at all.');
      return;
    }

    // Helper to format time
    function formatTime(timeValue) {
      if (!timeValue) return 'N/A';

      // Unix timestamp (milliseconds)
      if (typeof timeValue === 'number' || /^\d+$/.test(timeValue)) {
        const timestamp = typeof timeValue === 'string' ? parseInt(timeValue) : timeValue;
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
          timeZone: 'America/Toronto',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }

      return String(timeValue);
    }

    console.log('='.repeat(120));
    console.log('ALL EXAMS:\n');

    exams.forEach((exam, index) => {
      console.log(`${index + 1}. ID: ${exam.id}`);
      console.log(`   Type: ${exam.properties.mock_type || 'Unknown'}`);
      console.log(`   Date: ${exam.properties.exam_date || 'Not set'}`);
      console.log(`   Location: ${exam.properties.location || 'Not set'}`);
      console.log(`   Start Time (raw): ${exam.properties.start_time || 'N/A'}`);
      console.log(`   Start Time (formatted): ${formatTime(exam.properties.start_time)}`);
      console.log(`   End Time (raw): ${exam.properties.end_time || 'N/A'}`);
      console.log(`   End Time (formatted): ${formatTime(exam.properties.end_time)}`);
      console.log(`   Capacity: ${exam.properties.capacity || '0'}`);
      console.log(`   Active: ${exam.properties.is_active || 'N/A'}`);

      // Check for Mock Discussion
      if (exam.properties.mock_type === 'Mock Discussion') {
        console.log(`   🔥 MOCK DISCUSSION EXAM!`);
      }

      // Check if times match 2:00PM-7:00PM
      const startTime = exam.properties.start_time;
      const endTime = exam.properties.end_time;

      if (startTime && typeof startTime === 'number') {
        const date = new Date(startTime);
        if (date.getHours() === 14) {
          console.log(`   ⭐ START TIME is 2:00 PM!`);
        }
      }

      if (endTime && typeof endTime === 'number') {
        const date = new Date(endTime);
        if (date.getHours() === 19) {
          console.log(`   ⭐ END TIME is 7:00 PM!`);
        }
      }

      console.log('');
    });

    console.log('='.repeat(120));

    // Now check Mock Discussion exams specifically
    const mockDiscussions = exams.filter(e => e.properties.mock_type === 'Mock Discussion');

    if (mockDiscussions.length > 0) {
      console.log(`\n\n📚 Found ${mockDiscussions.length} Mock Discussion exam(s):\n`);

      for (const exam of mockDiscussions) {
        console.log(`Mock Discussion: ${exam.id} (${exam.properties.exam_date})`);
        console.log(`   Checking prerequisites...\n`);

        try {
          const prerequisites = await hubspot.getMockExamAssociations(exam.id, 1340);

          if (prerequisites.length > 0) {
            console.log(`   ✅ ${prerequisites.length} prerequisite(s):`);
            prerequisites.forEach((prereq, i) => {
              console.log(`      ${i + 1}. ${prereq.properties.mock_type} - ${prereq.properties.exam_date} (ID: ${prereq.id})`);
            });
          } else {
            console.log(`   ⚠️  No prerequisites associated`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }

        console.log('');
      }
    } else {
      console.log('\n\n❌ No Mock Discussion exams found');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

directSearch().catch(console.error);
