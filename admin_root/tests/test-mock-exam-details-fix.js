/**
 * Test script to verify the fix for HubSpot API 400 error when viewing mock exam details
 *
 * This script tests the getMockExamWithBookings method after fixing the issue where
 * it was trying to search bookings using mock_exam_id property which doesn't exist
 * on the bookings object. The fix now uses associations API instead.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const HubSpotService = require('../api/_shared/hubspot').HubSpotService;

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

// Initialize HubSpot service
const hubspotService = new HubSpotService();

async function testMockExamDetails() {
  console.log(`\n${colors.bold}${colors.blue}=== Testing Mock Exam Details Fix ===${colors.reset}\n`);

  try {
    // Test with a specific mock exam ID (the one from the error logs)
    const mockExamId = '34613479980';

    console.log(`${colors.yellow}Testing getMockExamWithBookings for Mock Exam ID: ${mockExamId}${colors.reset}`);
    console.log('This previously failed with: HubSpot API Error (400) - "There was a problem with the request."\n');

    // Call the fixed method
    const result = await hubspotService.getMockExamWithBookings(mockExamId);

    // Display results
    console.log(`${colors.green}✓ Successfully retrieved mock exam details!${colors.reset}\n`);

    console.log(`${colors.bold}Mock Exam Information:${colors.reset}`);
    console.log(`- ID: ${result.mockExam.id}`);
    console.log(`- Type: ${result.mockExam.mock_type || 'N/A'}`);
    console.log(`- Date: ${result.mockExam.exam_date || 'N/A'}`);
    console.log(`- Location: ${result.mockExam.location || 'N/A'}`);
    console.log(`- Capacity: ${result.mockExam.capacity || 'N/A'}`);
    console.log(`- Total Bookings: ${result.mockExam.total_bookings || 0}`);

    console.log(`\n${colors.bold}Bookings Information:${colors.reset}`);
    console.log(`- Total Bookings Found: ${result.bookings.length}`);

    if (result.bookings.length > 0) {
      console.log('\nFirst 5 bookings:');
      result.bookings.slice(0, 5).forEach((booking, index) => {
        console.log(`  ${index + 1}. Booking ID: ${booking.id}`);
        console.log(`     - Status: ${booking.booking_status || 'N/A'}`);
        console.log(`     - Contact ID: ${booking.contact_id || 'N/A'}`);
        console.log(`     - Created: ${booking.created_at || 'N/A'}`);
        if (booking.contact) {
          console.log(`     - Contact: ${booking.contact.firstname || ''} ${booking.contact.lastname || ''} (${booking.contact.email || 'N/A'})`);
        }
      });
    } else {
      console.log('  No bookings found for this mock exam.');
    }

    console.log(`\n${colors.bold}Statistics:${colors.reset}`);
    console.log(`- Total: ${result.statistics.total}`);
    console.log(`- Confirmed: ${result.statistics.confirmed}`);
    console.log(`- Pending: ${result.statistics.pending}`);
    console.log(`- Cancelled: ${result.statistics.cancelled}`);

    console.log(`\n${colors.green}${colors.bold}✓ Test passed! The fix is working correctly.${colors.reset}`);
    console.log(`\n${colors.blue}The issue was fixed by:${colors.reset}`);
    console.log('1. Using associations API to get bookings linked to a mock exam');
    console.log('2. Batch fetching booking details using the associated booking IDs');
    console.log('3. Removing the invalid search filter on mock_exam_id property\n');

  } catch (error) {
    console.error(`${colors.red}✗ Test failed!${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);

    if (error.status === 400) {
      console.error('\n🔍 This indicates the fix may not be working properly.');
      console.error('The error suggests the HubSpot API is still receiving an invalid request.');
    }

    if (error.response) {
      console.error('\nFull error response:', JSON.stringify(error.response.data || error.response, null, 2));
    }

    process.exit(1);
  }
}

// Also test the getActiveBookingsCount method which was also fixed
async function testActiveBookingsCount() {
  console.log(`\n${colors.bold}${colors.blue}=== Testing Active Bookings Count Fix ===${colors.reset}\n`);

  try {
    const mockExamId = '34613479980';

    console.log(`${colors.yellow}Testing getActiveBookingsCount for Mock Exam ID: ${mockExamId}${colors.reset}`);

    const count = await hubspotService.getActiveBookingsCount(mockExamId);

    console.log(`${colors.green}✓ Successfully retrieved active bookings count!${colors.reset}`);
    console.log(`Active bookings (confirmed/pending): ${count}`);

  } catch (error) {
    console.error(`${colors.red}✗ Count test failed!${colors.reset}`);
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

// Run tests
async function runAllTests() {
  console.log(`${colors.bold}${colors.blue}Starting HubSpot API Fix Tests${colors.reset}`);
  console.log('Testing the fix for 400 error when searching bookings by mock_exam_id\n');

  await testMockExamDetails();
  await testActiveBookingsCount();

  console.log(`\n${colors.green}${colors.bold}All tests completed!${colors.reset}\n`);
}

runAllTests().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});