const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');
const { getCache } = require('../../api/_shared/cache');

// Simulate the GET endpoint handler
async function handleGetRequest(mockExamId) {
  const HUBSPOT_OBJECTS = {
    'mock_exams': '2-50158913'
  };

  try {
    // Initialize cache
    const cache = getCache();
    const cacheKey = `admin:mock-exam:details:${mockExamId}`;

    // Clear cache for this test
    await cache.delete(cacheKey);
    console.log(`🗑️  Cleared cache for exam ${mockExamId}\n`);

    console.log(`📋 Fetching mock exam ${mockExamId} from HubSpot`);

    // Fetch mock exam from HubSpot
    const response = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?properties=mock_type,exam_date,start_time,end_time,location,address,capacity,total_bookings,is_active,status,hs_createdate,hs_lastmodifieddate`
    );
    const mockExam = response;

    console.log(`   Mock Type: ${mockExam.properties.mock_type}`);
    console.log(`   Exam Date: ${mockExam.properties.exam_date}`);

    // Build base response
    const result = {
      success: true,
      data: {
        id: mockExam.id,
        mock_type: mockExam.properties.mock_type,
        exam_date: mockExam.properties.exam_date,
        start_time: mockExam.properties.start_time,
        end_time: mockExam.properties.end_time,
        location: mockExam.properties.location,
        address: mockExam.properties.address,
        capacity: parseInt(mockExam.properties.capacity || '0'),
        total_bookings: parseInt(mockExam.properties.total_bookings || '0'),
        is_active: mockExam.properties.is_active === 'true',
        status: mockExam.properties.status,
        created_at: mockExam.properties.hs_createdate,
        updated_at: mockExam.properties.hs_lastmodifieddate
      }
    };

    // If this is a Mock Discussion, fetch prerequisite associations
    if (mockExam.properties.mock_type === 'Mock Discussion') {
      console.log('\n📚 This is a Mock Discussion - fetching prerequisite associations...');

      try {
        const PREREQUISITE_ASSOCIATION_TYPE_ID = 1340;
        const prerequisites = await hubspot.getMockExamAssociations(
          mockExamId,
          PREREQUISITE_ASSOCIATION_TYPE_ID
        );

        // Format prerequisite details
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

        // Sort by exam date (earliest first)
        prerequisiteDetails.sort((a, b) => {
          const dateA = new Date(a.exam_date);
          const dateB = new Date(b.exam_date);
          return dateA - dateB;
        });

        // Add prerequisite exams to response data
        result.data.prerequisite_exams = prerequisiteDetails;
        result.data.prerequisite_exam_ids = prerequisites.map(p => p.id);

        console.log(`   ✓ Included ${prerequisiteDetails.length} prerequisite associations`);

        if (prerequisiteDetails.length > 0) {
          console.log('\n   Prerequisite Exams:');
          prerequisiteDetails.forEach((prereq, i) => {
            console.log(`   [${i + 1}] ID: ${prereq.id}`);
            console.log(`       Type: ${prereq.mock_type}`);
            console.log(`       Date: ${prereq.exam_date}`);
            console.log(`       Location: ${prereq.location}`);
          });
        }
      } catch (error) {
        console.error('   ❌ Error fetching prerequisite associations:', error.message);
        result.data.prerequisite_exams = [];
        result.data.prerequisite_exam_ids = [];
      }
    }

    return result;

  } catch (error) {
    throw error;
  }
}

async function testEndpoint() {
  const examId = '37367871402';

  console.log('\n========================================');
  console.log('TEST GET ENDPOINT WITH FIX');
  console.log('========================================\n');

  try {
    const response = await handleGetRequest(examId);

    console.log('\n========================================');
    console.log('ENDPOINT RESPONSE');
    console.log('========================================\n');

    console.log('Success:', response.success);
    console.log('\nData Structure:');
    console.log('  - id:', response.data.id);
    console.log('  - mock_type:', response.data.mock_type);
    console.log('  - exam_date:', response.data.exam_date);
    console.log('  - prerequisite_exam_ids:', response.data.prerequisite_exam_ids);
    console.log('  - prerequisite_exams count:', response.data.prerequisite_exams?.length || 0);

    console.log('\n========================================');
    console.log('FULL RESPONSE (JSON)');
    console.log('========================================\n');
    console.log(JSON.stringify(response, null, 2));

    // Verify the fix
    if (response.data.prerequisite_exams && response.data.prerequisite_exams.length === 2) {
      console.log('\n========================================');
      console.log('✅ TEST PASSED');
      console.log('========================================\n');
      console.log('The GET endpoint now correctly returns 2 prerequisite exams!');
    } else {
      console.log('\n========================================');
      console.log('❌ TEST FAILED');
      console.log('========================================\n');
      console.log('Expected 2 prerequisite exams, got:', response.data.prerequisite_exams?.length || 0);
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ ERROR');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testEndpoint();
