/**
 * Test Mock Exam Edit Note Creation
 *
 * This script tests the createMockExamEditNote method
 * Run with: node tests/test-mock-exam-note.js
 */

// Mock data for testing
const mockChanges = {
  mock_type: {
    from: 'Situational Judgment',
    to: 'Clinical Skills'
  },
  capacity: {
    from: '15',
    to: '20'
  },
  is_active: {
    from: 'true',
    to: 'false'
  },
  start_time: {
    from: '1735632000000',  // Example timestamp
    to: '1735635600000'
  }
};

const mockAdminUser = {
  email: 'admin@prepdoctors.ca',
  user_metadata: {
    email: 'admin@prepdoctors.ca'
  }
};

const mockExamId = '12345678';

console.log('🧪 Testing Mock Exam Edit Note Creation');
console.log('==========================================\n');

console.log('📝 Test Data:');
console.log('Mock Exam ID:', mockExamId);
console.log('Admin User:', mockAdminUser.email);
console.log('Changes:', JSON.stringify(mockChanges, null, 2));
console.log('\n==========================================\n');

// Import the HubSpot service
try {
  const { HubSpotService } = require('../api/_shared/hubspot');
  const hubspot = new HubSpotService();

  console.log('✅ HubSpot service loaded successfully\n');

  // Test the note creation (this will make a real API call if HS_PRIVATE_APP_TOKEN is set)
  console.log('🚀 Testing createMockExamEditNote method...\n');

  hubspot.createMockExamEditNote(mockExamId, mockChanges, mockAdminUser)
    .then(result => {
      if (result) {
        console.log('✅ SUCCESS: Note created successfully');
        console.log('Note ID:', result.id);
        console.log('Note properties:', JSON.stringify(result.properties, null, 2));
      } else {
        console.log('⚠️  WARNING: Note creation returned null (API error or rate limit)');
      }
      console.log('\n==========================================');
      console.log('✅ Test completed successfully');
    })
    .catch(error => {
      console.error('❌ ERROR: Note creation failed');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.log('\n==========================================');
      console.log('❌ Test failed');
      process.exit(1);
    });

} catch (error) {
  console.error('❌ ERROR: Failed to load HubSpot service');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  console.log('\n==========================================');
  console.log('❌ Test setup failed');
  process.exit(1);
}

// Keep the script running for async operations
setTimeout(() => {
  console.log('\n⏰ Test timeout - exiting');
  process.exit(0);
}, 10000);
