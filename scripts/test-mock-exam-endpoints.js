#!/usr/bin/env node

/**
 * Test all mock exam admin endpoints to verify the hubspot module fix
 */

console.log('🧪 Testing Mock Exam Admin Endpoints\n');
console.log('=' . repeat(60));

const endpoints = [
  {
    name: 'list',
    file: '../admin_root/api/admin/mock-exams/list.js',
    expectedMethods: ['listMockExams']
  },
  {
    name: 'get',
    file: '../admin_root/api/admin/mock-exams/get.js',
    expectedMethods: ['getMockExamWithBookings']
  },
  {
    name: 'create',
    file: '../admin_root/api/admin/mock-exams/create.js',
    expectedMethods: ['createMockExam'],
    usesClass: true
  },
  {
    name: 'bulk-create',
    file: '../admin_root/api/admin/mock-exams/bulk-create.js',
    expectedMethods: ['batchCreateMockExams'],
    usesClass: true
  },
  {
    name: 'update',
    file: '../admin_root/api/admin/mock-exams/update.js',
    expectedMethods: ['updateMockExam']
  },
  {
    name: 'delete',
    file: '../admin_root/api/admin/mock-exams/delete.js',
    expectedMethods: ['getMockExamWithBookings', 'deleteMockExam']
  },
  {
    name: 'metrics',
    file: '../admin_root/api/admin/mock-exams/metrics.js',
    expectedMethods: ['calculateMetrics']
  }
];

let allPassed = true;

// Set a dummy token for testing
process.env.HS_PRIVATE_APP_TOKEN = 'test-token';

endpoints.forEach(endpoint => {
  console.log(`\n📄 Testing ${endpoint.name}.js:`);
  console.log('-'.repeat(40));

  try {
    // Load the endpoint file to check its imports
    const fs = require('fs');
    const fileContent = fs.readFileSync(require.resolve(endpoint.file), 'utf8');

    // Check import style
    const usesDirectImport = fileContent.includes('const hubspot = require');
    const usesClassImport = fileContent.includes('const { HubSpotService }');
    const createsInstance = fileContent.includes('new HubSpotService()');

    console.log(`   Import Style: ${usesDirectImport ? 'Direct (hubspot)' : ''} ${usesClassImport ? 'Class ({ HubSpotService })' : ''}`);
    if (usesClassImport) {
      console.log(`   Creates Instance: ${createsInstance ? '✅ Yes' : '❌ No'}`);
    }

    // Load the hubspot module the same way the endpoint would
    let hubspot;
    if (usesDirectImport && !usesClassImport) {
      // Direct import
      hubspot = require('../admin_root/api/_shared/hubspot');
    } else if (usesClassImport && createsInstance) {
      // Class import with instance creation
      const { HubSpotService } = require('../admin_root/api/_shared/hubspot');
      hubspot = new HubSpotService();
    } else {
      console.log('   ⚠️ Unclear import pattern');
      hubspot = null;
    }

    // Check if expected methods are available
    console.log(`   Expected Methods:`);
    let endpointPassed = true;

    if (hubspot) {
      endpoint.expectedMethods.forEach(method => {
        const hasMethod = typeof hubspot[method] === 'function';
        console.log(`     - ${method}: ${hasMethod ? '✅' : '❌'}`);
        if (!hasMethod) {
          endpointPassed = false;
          allPassed = false;
        }
      });
    } else {
      console.log('     - Cannot check methods (import issue)');
      endpointPassed = false;
      allPassed = false;
    }

    if (endpointPassed) {
      console.log(`   ✅ Endpoint should work correctly!`);
    } else {
      console.log(`   ❌ Endpoint may have issues!`);
    }

  } catch (error) {
    console.log(`   ❌ Error testing endpoint: ${error.message}`);
    allPassed = false;
  }
});

console.log('\n' + '=' . repeat(60));
if (allPassed) {
  console.log('🎉 SUCCESS! All mock exam endpoints should work correctly.');
  console.log('   The hubspot module fix has resolved the issue.');
} else {
  console.log('⚠️ WARNING: Some endpoints may still have issues.');
  console.log('   Please check the specific endpoints marked with ❌.');
}

process.exit(allPassed ? 0 : 1);