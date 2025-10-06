#!/usr/bin/env node
/**
 * Test script to verify booking associations are working correctly
 * This script tests the createAssociation method directly and through the booking creation flow
 */

require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test configuration
const TEST_CONTACT_ID = process.argv[2];
const TEST_MOCK_EXAM_ID = process.argv[3];

async function testDirectAssociation() {
  console.log(`\n${colors.cyan}=== Testing Direct Association Creation ===${colors.reset}\n`);

  const hubspot = new HubSpotService();

  try {
    // Create a test booking first
    const testBooking = await hubspot.createBooking({
      bookingId: `TEST-Association-${Date.now()}`,
      name: 'Test User',
      email: 'test@example.com',
      tokenUsed: 'Test Token'
    });

    console.log(`${colors.green}✅ Test booking created:${colors.reset}`, testBooking.id);

    // Test association with Mock Exam
    console.log(`\n${colors.yellow}Testing Mock Exam Association...${colors.reset}`);
    console.log(`Booking ID: ${testBooking.id}`);
    console.log(`Mock Exam ID: ${TEST_MOCK_EXAM_ID}`);

    const mockExamAssoc = await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      testBooking.id,
      HUBSPOT_OBJECTS.mock_exams,
      TEST_MOCK_EXAM_ID
    );

    console.log(`${colors.green}✅ Mock Exam association created successfully${colors.reset}`);
    console.log('Association result:', JSON.stringify(mockExamAssoc, null, 2));

    // Test association with Contact
    console.log(`\n${colors.yellow}Testing Contact Association...${colors.reset}`);
    console.log(`Booking ID: ${testBooking.id}`);
    console.log(`Contact ID: ${TEST_CONTACT_ID}`);

    const contactAssoc = await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      testBooking.id,
      HUBSPOT_OBJECTS.contacts,
      TEST_CONTACT_ID
    );

    console.log(`${colors.green}✅ Contact association created successfully${colors.reset}`);
    console.log('Association result:', JSON.stringify(contactAssoc, null, 2));

    // Verify associations by fetching the booking with associations
    console.log(`\n${colors.yellow}Verifying associations...${colors.reset}`);
    const bookingWithAssoc = await hubspot.apiCall(
      'GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${testBooking.id}?associations=${HUBSPOT_OBJECTS.mock_exams},${HUBSPOT_OBJECTS.contacts}`
    );

    console.log(`\n${colors.cyan}Booking associations:${colors.reset}`);
    console.log(JSON.stringify(bookingWithAssoc.associations, null, 2));

    // Clean up - delete test booking
    console.log(`\n${colors.yellow}Cleaning up test booking...${colors.reset}`);
    await hubspot.deleteBooking(testBooking.id);
    console.log(`${colors.green}✅ Test booking deleted${colors.reset}`);

    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Test failed:${colors.reset}`, error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testAssociationTypes() {
  console.log(`\n${colors.cyan}=== Testing Association Type Configuration ===${colors.reset}\n`);

  const hubspot = new HubSpotService();

  // Test the getDefaultAssociationTypeId method
  const bookingToMockExam = hubspot.getDefaultAssociationTypeId(HUBSPOT_OBJECTS.bookings, HUBSPOT_OBJECTS.mock_exams);
  const bookingToContact = hubspot.getDefaultAssociationTypeId(HUBSPOT_OBJECTS.bookings, HUBSPOT_OBJECTS.contacts);

  console.log(`Booking → Mock Exam association type: ${bookingToMockExam}`);
  console.log(`Booking → Contact association type: ${bookingToContact}`);

  if (bookingToMockExam === 1291 || bookingToMockExam === 1292) {
    console.log(`${colors.green}✅ Mock Exam association type is configured correctly${colors.reset}`);
  } else {
    console.log(`${colors.red}⚠️ Mock Exam association type might be incorrect${colors.reset}`);
  }
}

async function testFullBookingFlow() {
  console.log(`\n${colors.cyan}=== Testing Full Booking Creation Flow ===${colors.reset}\n`);

  try {
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/bookings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AUTH_TOKEN || 'test'}`
      },
      body: JSON.stringify({
        contact_id: TEST_CONTACT_ID,
        mock_exam_id: TEST_MOCK_EXAM_ID,
        student_id: 'TEST123',
        name: 'Test User',
        email: 'test@example.com',
        exam_date: '2025-02-01',
        mock_type: 'Situational Judgment',
        attending_location: 'Mississauga'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`${colors.green}✅ Booking created via API${colors.reset}`);
      console.log('Booking ID:', result.data?.booking_id);
      console.log('Associations:', JSON.stringify(result.data?.associations, null, 2));

      // Check if associations were successful
      const assocResults = result.data?.associations?.results || [];
      const contactAssoc = assocResults.find(r => r.type === 'contact');
      const mockExamAssoc = assocResults.find(r => r.type === 'mock_exam');

      if (contactAssoc?.success) {
        console.log(`${colors.green}✅ Contact association successful${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ Contact association failed${colors.reset}`);
      }

      if (mockExamAssoc?.success) {
        console.log(`${colors.green}✅ Mock Exam association successful${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ Mock Exam association failed${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}❌ Booking creation failed${colors.reset}`);
      console.log('Error:', result);
    }
  } catch (error) {
    console.error(`${colors.red}❌ API test failed:${colors.reset}`, error.message);
  }
}

async function main() {
  if (!TEST_CONTACT_ID || !TEST_MOCK_EXAM_ID) {
    console.log(`${colors.yellow}Usage: node test-booking-association.js <contact_id> <mock_exam_id>${colors.reset}`);
    console.log('\nExample: node test-booking-association.js 12345 67890\n');
    process.exit(1);
  }

  console.log(`${colors.bright}${colors.blue}🔍 Testing Booking Associations${colors.reset}`);
  console.log('=' .repeat(60));
  console.log(`Contact ID: ${TEST_CONTACT_ID}`);
  console.log(`Mock Exam ID: ${TEST_MOCK_EXAM_ID}`);
  console.log('=' .repeat(60));

  // Test 1: Check association type configuration
  await testAssociationTypes();

  // Test 2: Direct association test
  const directTestPassed = await testDirectAssociation();

  // Test 3: Full API flow test (optional - requires running server)
  if (process.argv[4] === '--api') {
    await testFullBookingFlow();
  }

  // Summary
  console.log(`\n${colors.cyan}=== Test Summary ===${colors.reset}`);
  if (directTestPassed) {
    console.log(`${colors.green}✅ All association tests passed${colors.reset}`);
    console.log('\nThe association logic is working correctly.');
    console.log('If associations are still missing in production, check:');
    console.log('1. API rate limits or temporary HubSpot issues');
    console.log('2. Specific Mock Exam or Contact IDs that might be invalid');
    console.log('3. Network issues or timeouts during association creation');
  } else {
    console.log(`${colors.red}❌ Some tests failed${colors.reset}`);
    console.log('\nPossible issues:');
    console.log('1. Invalid Mock Exam or Contact IDs');
    console.log('2. HubSpot API permissions');
    console.log('3. Association type configuration');
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});