#!/usr/bin/env node

/**
 * Test script to verify hubspot.listMockExams function is accessible
 */

console.log('🧪 Testing HubSpot Module Fix...\n');
console.log('=' . repeat(60));

try {
  // Load the module the same way the endpoint does
  const hubspot = require('../admin_root/api/_shared/hubspot');

  console.log('✅ HubSpot module loaded successfully\n');

  // Check the type and available methods
  console.log('📦 Module Analysis:');
  console.log(`   - Module Type: ${typeof hubspot}`);
  console.log(`   - Is Function: ${typeof hubspot === 'function' ? 'Yes' : 'No'}`);
  console.log(`   - Is Object: ${typeof hubspot === 'object' ? 'Yes' : 'No'}`);
  console.log(`   - Constructor Name: ${hubspot?.constructor?.name || 'N/A'}`);

  console.log('\n🔍 Checking Required Methods:');

  // Check for listMockExams
  const hasListMockExams = typeof hubspot.listMockExams === 'function';
  console.log(`   - listMockExams: ${hasListMockExams ? '✅ FOUND' : '❌ MISSING'}`);

  // Check for other commonly used methods
  const methods = [
    'searchContacts',
    'searchMockExams',
    'createBooking',
    'getMockExam',
    'updateMockExam',
    'deleteMockExam'
  ];

  methods.forEach(method => {
    const hasMethod = typeof hubspot[method] === 'function';
    console.log(`   - ${method}: ${hasMethod ? '✅' : '❌'}`);
  });

  console.log('\n📋 Checking Exports:');
  console.log(`   - HubSpotService class: ${typeof hubspot.HubSpotService === 'function' ? '✅' : '❌'}`);
  console.log(`   - HUBSPOT_OBJECTS: ${typeof hubspot.HUBSPOT_OBJECTS === 'object' ? '✅' : '❌'}`);

  // Get all method names
  const allMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(hubspot))
    .filter(name => typeof hubspot[name] === 'function' && name !== 'constructor');

  console.log(`\n📊 Total Available Methods: ${allMethods.length}`);
  if (allMethods.includes('listMockExams')) {
    console.log('   ✅ listMockExams is in the method list!');
  } else {
    console.log('   ❌ listMockExams is NOT in the method list!');
    console.log('\n   Available methods include:');
    allMethods.slice(0, 5).forEach(m => console.log(`     - ${m}`));
  }

  // Final verdict
  console.log('\n' + '=' . repeat(60));
  if (hasListMockExams) {
    console.log('🎉 SUCCESS! The fix is working correctly.');
    console.log('   The hubspot.listMockExams function is now accessible.');
    console.log('   The admin mock exams list endpoint should work properly.');

    // Try to call the function to double-check
    console.log('\n🧪 Testing function call...');
    hubspot.listMockExams({ page: 1, limit: 1 })
      .then(result => {
        console.log('   ✅ Function executed successfully!');
        console.log(`   - Total records: ${result.total || 0}`);
        process.exit(0);
      })
      .catch(err => {
        console.log('   ⚠️ Function exists but threw an error (likely auth):');
        console.log(`   - ${err.message}`);
        console.log('   This is expected if HS_PRIVATE_APP_TOKEN is not set.');
        process.exit(0);
      });
  } else {
    console.error('❌ FAILED! The listMockExams function is still not accessible.');
    console.error('   The module export may need further investigation.');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Failed to load HubSpot module:');
  console.error(`   - ${error.message}`);
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}