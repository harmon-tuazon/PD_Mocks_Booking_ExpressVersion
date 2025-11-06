/**
 * Test script to verify prerequisite exam associations retrieval
 * Tests the actual API endpoint with the Mock Discussion exam ID from the screenshot
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const MOCK_DISCUSSION_EXAM_ID = '37367871482'; // From screenshot

async function testPrerequisitesAPI() {
  console.log('='.repeat(80));
  console.log('PREREQUISITE EXAMS API TEST');
  console.log('='.repeat(80));
  console.log(`\nTesting exam ID: ${MOCK_DISCUSSION_EXAM_ID}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log('\n' + '-'.repeat(80));

  try {
    // Test 1: Call the main GET endpoint (should include prerequisites)
    console.log('\n[TEST 1] Calling GET /api/admin/mock-exams/[id]');
    console.log(`URL: ${API_BASE_URL}/api/admin/mock-exams/${MOCK_DISCUSSION_EXAM_ID}`);

    const response1 = await axios.get(
      `${API_BASE_URL}/api/admin/mock-exams/${MOCK_DISCUSSION_EXAM_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`
        }
      }
    );

    console.log('\n✅ Response received');
    console.log('Status:', response1.status);
    console.log('Success:', response1.data?.success);

    if (response1.data?.data) {
      const examData = response1.data.data;
      console.log('\n📋 Exam Details:');
      console.log(`  - ID: ${examData.id}`);
      console.log(`  - Type: ${examData.mock_type}`);
      console.log(`  - Date: ${examData.exam_date}`);
      console.log(`  - Location: ${examData.location}`);

      console.log('\n🔗 Prerequisite Data:');
      console.log(`  - prerequisite_exam_ids present: ${!!examData.prerequisite_exam_ids}`);
      console.log(`  - prerequisite_exam_ids count: ${examData.prerequisite_exam_ids?.length || 0}`);
      console.log(`  - prerequisite_exam_ids:`, examData.prerequisite_exam_ids || []);

      console.log(`  - prerequisite_exams present: ${!!examData.prerequisite_exams}`);
      console.log(`  - prerequisite_exams count: ${examData.prerequisite_exams?.length || 0}`);

      if (examData.prerequisite_exams && examData.prerequisite_exams.length > 0) {
        console.log('\n  📝 Prerequisite Exam Details:');
        examData.prerequisite_exams.forEach((prereq, idx) => {
          console.log(`    ${idx + 1}. ${prereq.mock_type} - ${prereq.exam_date} at ${prereq.location}`);
          console.log(`       ID: ${prereq.id}, Active: ${prereq.is_active}`);
        });
      } else {
        console.log('\n  ⚠️  NO PREREQUISITE EXAMS FOUND IN RESPONSE');
      }
    }

    console.log('\n' + '-'.repeat(80));

    // Test 2: Call the dedicated prerequisites endpoint
    console.log('\n[TEST 2] Calling GET /api/admin/mock-exams/[id]/prerequisites');
    console.log(`URL: ${API_BASE_URL}/api/admin/mock-exams/${MOCK_DISCUSSION_EXAM_ID}/prerequisites`);

    const response2 = await axios.get(
      `${API_BASE_URL}/api/admin/mock-exams/${MOCK_DISCUSSION_EXAM_ID}/prerequisites`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`
        }
      }
    );

    console.log('\n✅ Response received');
    console.log('Status:', response2.status);
    console.log('Success:', response2.data?.success);

    if (response2.data?.data) {
      const prereqData = response2.data.data;
      console.log('\n📋 Prerequisites Data:');
      console.log(`  - Mock Exam ID: ${prereqData.mock_exam_id}`);
      console.log(`  - Mock Exam Type: ${prereqData.mock_exam_type}`);
      console.log(`  - Total Prerequisites: ${prereqData.total_prerequisites}`);

      if (prereqData.prerequisite_exams && prereqData.prerequisite_exams.length > 0) {
        console.log('\n  📝 Prerequisite Exams:');
        prereqData.prerequisite_exams.forEach((prereq, idx) => {
          console.log(`    ${idx + 1}. ${prereq.mock_type} - ${prereq.exam_date} at ${prereq.location}`);
          console.log(`       ID: ${prereq.id}, Active: ${prereq.is_active}`);
        });
      } else {
        console.log('\n  ⚠️  NO PREREQUISITE EXAMS FOUND');
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.response) {
      console.error('\nResponse Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('\nNo response received from server');
      console.error('Check if the server is running and accessible');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run the test
testPrerequisitesAPI().catch(console.error);
