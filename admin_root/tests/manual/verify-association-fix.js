const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const hubspot = require('../../api/_shared/hubspot');

async function verifyFix() {
  const examId = '37367871402';
  const PREREQUISITE_ASSOCIATION_TYPE = 1340;

  console.log('\n========================================');
  console.log('VERIFY ASSOCIATION FIX');
  console.log('========================================\n');

  console.log(`Testing exam ID: ${examId}`);
  console.log(`Association Type: ${PREREQUISITE_ASSOCIATION_TYPE}\n`);

  try {
    // 1. Get exam details
    console.log('1. Fetching exam details...');
    const exam = await hubspot.getMockExam(examId);
    console.log(`   ✓ Mock Type: ${exam.properties.mock_type}`);
    console.log(`   ✓ Exam Date: ${exam.properties.exam_date}`);
    console.log(`   ✓ Start Time: ${exam.properties.start_time}`);
    console.log(`   ✓ End Time: ${exam.properties.end_time}`);

    // 2. Get prerequisite associations using the FIXED method
    console.log('\n2. Fetching prerequisite associations (using FIXED method)...');
    const prerequisites = await hubspot.getMockExamAssociations(
      examId,
      PREREQUISITE_ASSOCIATION_TYPE
    );

    console.log(`   ✓ Found ${prerequisites.length} prerequisite associations`);

    if (prerequisites.length > 0) {
      console.log('\n3. Prerequisite Exam Details:');
      prerequisites.forEach((prereq, i) => {
        console.log(`\n   [${i + 1}] Exam ID: ${prereq.id}`);
        console.log(`       Type: ${prereq.properties.mock_type}`);
        console.log(`       Date: ${prereq.properties.exam_date}`);
        console.log(`       Time: ${prereq.properties.start_time} - ${prereq.properties.end_time}`);
        console.log(`       Location: ${prereq.properties.location || 'Not specified'}`);
        console.log(`       Capacity: ${prereq.properties.capacity || 0}`);
        console.log(`       Active: ${prereq.properties.is_active}`);
      });

      console.log('\n========================================');
      console.log('✅ FIX VERIFIED - Associations retrieved successfully!');
      console.log('========================================\n');

      console.log('Expected Results:');
      console.log('  - 2 Clinical Skills exams should be found');
      console.log('  - Saturday, November 1, 2025 @ 10:00 AM - 11:00 AM');
      console.log('  - Thursday, December 4, 2025 @ 2:00 PM - 10:00 PM');

      // Verify the correct exams are found
      const expectedExamIds = ['35864533276', '38759726724'];
      const foundExamIds = prerequisites.map(p => p.id);

      const allFound = expectedExamIds.every(id => foundExamIds.includes(id));

      if (allFound) {
        console.log('\n✅ CORRECT EXAMS FOUND!');
      } else {
        console.log('\n⚠️ WARNING: Expected exam IDs not found');
        console.log('   Expected:', expectedExamIds);
        console.log('   Found:', foundExamIds);
      }

    } else {
      console.log('\n========================================');
      console.log('❌ FIX FAILED - No associations retrieved');
      console.log('========================================\n');
      console.log('The associations should exist but were not retrieved.');
      console.log('Please check the HubSpot API response and association type.');
    }

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ ERROR DURING VERIFICATION');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

verifyFix();
