/**
 * Test script for bulk update endpoint
 * Tests the validation and basic functionality of the bulk update feature
 */

const Joi = require('joi');

// Import validation schemas from the actual validation file
const { schemas } = require('../api/_shared/validation');

console.log('📝 Testing Bulk Update Validation Schema\n');

// Test cases for validation
const testCases = [
  {
    name: 'Valid request with location update',
    input: {
      sessionIds: ['123456', '123457'],
      updates: { location: 'Calgary' }
    },
    expectedValid: true
  },
  {
    name: 'Valid request with multiple updates',
    input: {
      sessionIds: ['123456'],
      updates: {
        location: 'Calgary',
        capacity: 12,
        mock_type: 'Clinical Skills'
      }
    },
    expectedValid: true
  },
  {
    name: 'Valid request with scheduled status',
    input: {
      sessionIds: ['123456'],
      updates: {
        is_active: 'scheduled',
        scheduled_activation_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    },
    expectedValid: true
  },
  {
    name: 'Invalid - no updates provided',
    input: {
      sessionIds: ['123456'],
      updates: {}
    },
    expectedValid: false
  },
  {
    name: 'Invalid - empty string updates only',
    input: {
      sessionIds: ['123456'],
      updates: {
        location: '',
        capacity: ''
      }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - scheduled without datetime',
    input: {
      sessionIds: ['123456'],
      updates: {
        is_active: 'scheduled'
      }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - scheduled with past datetime',
    input: {
      sessionIds: ['123456'],
      updates: {
        is_active: 'scheduled',
        scheduled_activation_datetime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - too many session IDs',
    input: {
      sessionIds: Array(101).fill('123456'),
      updates: { location: 'Calgary' }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - invalid location',
    input: {
      sessionIds: ['123456'],
      updates: { location: 'InvalidLocation' }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - invalid mock type',
    input: {
      sessionIds: ['123456'],
      updates: { mock_type: 'Invalid Type' }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - capacity out of range',
    input: {
      sessionIds: ['123456'],
      updates: { capacity: 150 }
    },
    expectedValid: false
  },
  {
    name: 'Invalid - invalid date format',
    input: {
      sessionIds: ['123456'],
      updates: { exam_date: '2025-1-1' }
    },
    expectedValid: false
  },
  {
    name: 'Valid - clearing scheduled status',
    input: {
      sessionIds: ['123456'],
      updates: { is_active: 'active' }
    },
    expectedValid: true
  }
];

// Run tests
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const { error } = schemas.bulkUpdate.validate(testCase.input);
  const isValid = !error;
  const testPassed = isValid === testCase.expectedValid;

  if (testPassed) {
    console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Expected: ${testCase.expectedValid ? 'valid' : 'invalid'}`);
    console.log(`   Got: ${isValid ? 'valid' : 'invalid'}`);
    if (error) {
      console.log(`   Error: ${error.message}`);
    }
    failed++;
  }
});

console.log('\n📊 Test Results:');
console.log(`   Passed: ${passed}/${testCases.length}`);
console.log(`   Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✅ All validation tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please check the validation schema.');
  process.exit(1);
}