#!/usr/bin/env node
/**
 * Diagnostic script to identify the booking association issue
 * This script will test the association creation step by step
 */

require('dotenv').config();
const axios = require('axios');
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Test direct API call to HubSpot
 */
async function testDirectApiCall(bookingId, mockExamId) {
  console.log(`\n${colors.cyan}=== Testing Direct HubSpot API Call ===${colors.reset}\n`);

  const token = process.env.HS_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error(`${colors.red}❌ HS_PRIVATE_APP_TOKEN not found in environment${colors.reset}`);
    return false;
  }

  const path = `/crm/v4/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`;
  const url = `https://api.hubapi.com${path}`;

  console.log(`URL: ${url}`);
  console.log(`Method: PUT`);

  // Test with Type 1292 payload
  const payload = [
    {
      associationCategory: 'USER_DEFINED',
      associationTypeId: 1292
    }
  ];

  console.log(`Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios({
      method: 'PUT',
      url,
      data: payload,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`${colors.green}✅ Direct API call successful${colors.reset}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Direct API call failed${colors.reset}`);
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test using HubSpotService
 */
async function testViaService(bookingId, mockExamId) {
  console.log(`\n${colors.cyan}=== Testing via HubSpotService ===${colors.reset}\n`);

  const hubspot = new HubSpotService();

  try {
    console.log(`Calling createAssociation...`);
    console.log(`From: ${HUBSPOT_OBJECTS.bookings} (${bookingId})`);
    console.log(`To: ${HUBSPOT_OBJECTS.mock_exams} (${mockExamId})`);

    const result = await hubspot.createAssociation(
      HUBSPOT_OBJECTS.bookings,
      bookingId,
      HUBSPOT_OBJECTS.mock_exams,
      mockExamId
    );

    console.log(`${colors.green}✅ Service call successful${colors.reset}`);
    console.log('Result:', JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Service call failed${colors.reset}`);
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Verify the objects exist
 */
async function verifyObjects(bookingId, mockExamId) {
  console.log(`\n${colors.cyan}=== Verifying Objects Exist ===${colors.reset}\n`);

  const hubspot = new HubSpotService();
  let bookingExists = false;
  let mockExamExists = false;

  // Check booking
  try {
    const booking = await hubspot.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}`);
    console.log(`${colors.green}✅ Booking ${bookingId} exists${colors.reset}`);
    console.log(`  Name: ${booking.properties.name}`);
    console.log(`  Email: ${booking.properties.email}`);
    bookingExists = true;
  } catch (error) {
    console.error(`${colors.red}❌ Booking ${bookingId} not found${colors.reset}`);
    console.error(`  Error: ${error.message}`);
  }

  // Check mock exam
  try {
    const mockExam = await hubspot.apiCall('GET', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}`);
    console.log(`${colors.green}✅ Mock Exam ${mockExamId} exists${colors.reset}`);
    console.log(`  Date: ${mockExam.properties.exam_date}`);
    console.log(`  Type: ${mockExam.properties.mock_type}`);
    mockExamExists = true;
  } catch (error) {
    console.error(`${colors.red}❌ Mock Exam ${mockExamId} not found${colors.reset}`);
    console.error(`  Error: ${error.message}`);
  }

  return bookingExists && mockExamExists;
}

/**
 * Check existing associations
 */
async function checkExistingAssociations(bookingId) {
  console.log(`\n${colors.cyan}=== Checking Existing Associations ===${colors.reset}\n`);

  const hubspot = new HubSpotService();

  try {
    const booking = await hubspot.apiCall(
      'GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}?associations=${HUBSPOT_OBJECTS.mock_exams},${HUBSPOT_OBJECTS.contacts}`
    );

    console.log('Booking associations:');

    if (booking.associations) {
      Object.keys(booking.associations).forEach(objectType => {
        const assocs = booking.associations[objectType]?.results || [];
        console.log(`  ${objectType}: ${assocs.length} association(s)`);
        assocs.forEach(assoc => {
          console.log(`    - ID: ${assoc.id}, Type: ${assoc.type}`);
        });
      });
    } else {
      console.log('  No associations found');
    }

    return booking.associations || {};
  } catch (error) {
    console.error(`${colors.red}❌ Failed to check associations${colors.reset}`);
    console.error('Error:', error.message);
    return {};
  }
}

/**
 * Main diagnostic function
 */
async function main() {
  const bookingId = process.argv[2];
  const mockExamId = process.argv[3];

  if (!bookingId || !mockExamId) {
    console.log(`${colors.yellow}Usage: node diagnose-association-issue.js <booking_id> <mock_exam_id>${colors.reset}`);
    console.log('\nExample: node diagnose-association-issue.js 12345 67890\n');
    process.exit(1);
  }

  console.log(`${colors.bright}${colors.blue}🔍 Diagnosing Booking Association Issue${colors.reset}`);
  console.log('=' .repeat(60));
  console.log(`Booking ID: ${bookingId}`);
  console.log(`Mock Exam ID: ${mockExamId}`);
  console.log('=' .repeat(60));

  // Step 1: Verify objects exist
  const objectsExist = await verifyObjects(bookingId, mockExamId);
  if (!objectsExist) {
    console.log(`\n${colors.red}❌ One or both objects don't exist. Cannot proceed.${colors.reset}`);
    process.exit(1);
  }

  // Step 2: Check existing associations
  await checkExistingAssociations(bookingId);

  // Step 3: Test via HubSpotService
  const serviceSuccess = await testViaService(bookingId, mockExamId);

  // Step 4: Test direct API call
  const directSuccess = await testDirectApiCall(bookingId, mockExamId);

  // Step 5: Re-check associations
  console.log(`\n${colors.cyan}=== Re-checking Associations After Tests ===${colors.reset}\n`);
  await checkExistingAssociations(bookingId);

  // Summary
  console.log(`\n${colors.cyan}=== Diagnostic Summary ===${colors.reset}`);
  console.log(`Service call: ${serviceSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`Direct API call: ${directSuccess ? '✅ Success' : '❌ Failed'}`);

  if (serviceSuccess && directSuccess) {
    console.log(`\n${colors.green}✅ Association logic is working correctly${colors.reset}`);
    console.log('The issue might be:');
    console.log('1. Transient API errors during booking creation');
    console.log('2. Invalid IDs being passed during actual booking');
    console.log('3. Rate limiting during bulk operations');
  } else {
    console.log(`\n${colors.red}❌ Association issue confirmed${colors.reset}`);
    console.log('Check the error messages above for details.');
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});