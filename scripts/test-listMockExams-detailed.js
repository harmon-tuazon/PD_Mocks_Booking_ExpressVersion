/**
 * Test Script: Detailed test of listMockExams with logging
 *
 * This script calls listMockExams and checks what's happening step by step.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

async function testListMockExamsDetailed() {
  console.log('\n🔍 DETAILED TEST OF listMockExams\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📋 Calling listMockExams with filter for exams with bookings...');

    const result = await hubspot.listMockExams({
      page: 1,
      limit: 3,
      filter_has_bookings: true
    });

    console.log(`\n   Results returned: ${result.results?.length || 0}`);
    console.log(`   Total exams: ${result.pagination?.total || 0}`);

    if (result.results && result.results.length > 0) {
      for (const exam of result.results) {
        console.log(`\n   📌 Exam ID: ${exam.id}`);
        console.log(`      - mock_type: ${exam.properties.mock_type}`);
        console.log(`      - exam_date: ${exam.properties.exam_date}`);
        console.log(`      - total_bookings (FINAL): ${exam.properties.total_bookings}`);
        console.log(`      - Has associations object: ${exam.associations ? 'YES' : 'NO'}`);

        if (exam.associations) {
          const keys = Object.keys(exam.associations);
          console.log(`      - Association keys: ${JSON.stringify(keys)}`);

          keys.forEach(key => {
            const assocResults = exam.associations[key].results || [];
            console.log(`        - ${key}: ${assocResults.length} items`);
          });
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the test
testListMockExamsDetailed();
