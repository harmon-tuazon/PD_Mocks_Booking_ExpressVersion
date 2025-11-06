const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'contacts': '0-1',
  'deals': '0-3',
  'courses': '0-410',
  'transactions': '2-47045790',
  'payment_schedules': '2-47381547',
  'credit_notes': '2-41609496',
  'campus_venues': '2-41607847',
  'enrollments': '2-41701559',
  'lab_stations': '2-41603799',
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

async function testAssociations() {
  const examId = '37367871402';

  console.log('=== Testing Exam 37367871402 Associations ===\n');

  try {
    // 1. Get the exam
    console.log('1. Fetching exam details...');
    const exam = await hubspot.getMockExam(examId);
    console.log('   Mock Type:', exam.properties.mock_type);
    console.log('   Exam Date:', exam.properties.exam_date);
    console.log('   Start Time:', exam.properties.start_time);
    console.log('   End Time:', exam.properties.end_time);

    // 2. Test with association type 1340
    console.log('\n2. Fetching associations with type 1340...');
    try {
      const associations1340 = await hubspot.getMockExamAssociations(examId, 1340);
      console.log('   Found:', associations1340.length, 'associations');
      if (associations1340.length > 0) {
        associations1340.forEach((assoc, i) => {
          console.log(`   [${i+1}] ID: ${assoc.id}, Type: ${assoc.properties.mock_type}, Date: ${assoc.properties.exam_date}`);
        });
      }
    } catch (error) {
      console.log('   Error:', error.message);
    }

    // 3. Try fetching ALL associations (no type filter)
    console.log('\n3. Fetching ALL mock exam associations (no type filter)...');
    try {
      const rawExam = await hubspot.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}?associations=${HUBSPOT_OBJECTS.mock_exams}`);
      console.log('   Raw associations structure:', JSON.stringify(rawExam.associations, null, 2));

      if (rawExam.associations?.mock_exams?.results) {
        const allAssocs = rawExam.associations.mock_exams.results;
        console.log(`   Total associations found: ${allAssocs.length}`);

        allAssocs.forEach((assoc, i) => {
          console.log(`\n   [${i+1}] Association Details:`);
          console.log(`       ID: ${assoc.id || assoc.toObjectId}`);
          console.log(`       Types:`, JSON.stringify(assoc.types, null, 2));
        });

        // Analyze association types
        console.log('\n   Association Type Summary:');
        const typeMap = {};
        allAssocs.forEach(assoc => {
          assoc.types?.forEach(type => {
            const key = `${type.associationCategory}-${type.associationTypeId}`;
            if (!typeMap[key]) {
              typeMap[key] = {
                category: type.associationCategory,
                typeId: type.associationTypeId,
                label: type.label || 'No label',
                count: 0
              };
            }
            typeMap[key].count++;
          });
        });

        Object.values(typeMap).forEach(type => {
          console.log(`       Type ${type.typeId} (${type.category}): ${type.label} - ${type.count} associations`);
        });
      } else {
        console.log('   No associations found in structure');
      }
    } catch (error) {
      console.log('   Error:', error.message);
    }

    // 4. Try reverse direction (using v4 associations API)
    console.log('\n4. Checking with v4 associations API...');
    try {
      const v4Response = await hubspot.apiCall('GET', `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}/associations/${HUBSPOT_OBJECTS.mock_exams}`);
      console.log('   V4 API Response:', JSON.stringify(v4Response, null, 2));
    } catch (error) {
      console.log('   Error:', error.message);
    }

    // 5. Try fetching the two Clinical Skills exams the user mentioned
    console.log('\n5. Attempting to find Clinical Skills exams on mentioned dates...');
    console.log('   Looking for exams on:');
    console.log('   - Saturday, November 1, 2025 @ 10:00 AM - 11:00 AM');
    console.log('   - Thursday, December 4, 2025 @ 2:00 PM - 10:00 PM');

    try {
      const allExams = await hubspot.listMockExams({
        mockType: 'Clinical Skills',
        startDate: '2025-11-01',
        endDate: '2025-12-04',
        limit: 100
      });

      console.log(`\n   Found ${allExams.results.length} Clinical Skills exams in date range:`);
      allExams.results.forEach((exam, i) => {
        console.log(`   [${i+1}] ID: ${exam.id}`);
        console.log(`       Date: ${exam.properties.exam_date}`);
        console.log(`       Time: ${exam.properties.start_time} - ${exam.properties.end_time}`);
        console.log(`       Location: ${exam.properties.location || 'Not specified'}`);
      });
    } catch (error) {
      console.log('   Error:', error.message);
    }

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testAssociations();
