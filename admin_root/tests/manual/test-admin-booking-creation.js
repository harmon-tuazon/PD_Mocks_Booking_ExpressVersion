/**
 * Manual Test Script for Admin Booking Creation
 *
 * This script tests the admin booking creation endpoint with real HubSpot data.
 *
 * Usage:
 *   node tests/manual/test-admin-booking-creation.js [mock_exam_id] [student_id] [email]
 *
 * Examples:
 *   # Test with Mock Discussion exam
 *   node tests/manual/test-admin-booking-creation.js 12345678 TEST001 test@example.com
 *
 *   # Test with Clinical Skills exam (requires dominant_hand)
 *   node tests/manual/test-admin-booking-creation.js 12345678 TEST002 test2@example.com
 *
 *   # Test with Situational Judgment exam (requires attending_location)
 *   node tests/manual/test-admin-booking-creation.js 12345678 TEST003 test3@example.com
 */

require('dotenv').config();
const { HubSpotService } = require('../../api/_shared/hubspot');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAdminBookingCreation() {
  // Parse command line arguments
  const [mockExamId, studentId, email] = process.argv.slice(2);

  if (!mockExamId || !studentId || !email) {
    log('❌ Missing required arguments', 'red');
    log('\nUsage: node tests/manual/test-admin-booking-creation.js [mock_exam_id] [student_id] [email]', 'yellow');
    log('\nExamples:', 'yellow');
    log('  node tests/manual/test-admin-booking-creation.js 12345678 TEST001 test@example.com');
    log('  node tests/manual/test-admin-booking-creation.js 12345678 TEST002 test2@example.com');
    process.exit(1);
  }

  log('\n🔧 Admin Booking Creation Manual Test', 'cyan');
  log('=====================================\n', 'cyan');

  const hubspot = new HubSpotService();

  try {
    // Step 1: Verify mock exam exists
    log('📋 Step 1: Fetching mock exam details...', 'blue');
    const mockExam = await hubspot.getMockExam(mockExamId);

    if (!mockExam) {
      log('❌ Mock exam not found', 'red');
      process.exit(1);
    }

    log(`✅ Found mock exam: ${mockExam.properties.mock_type}`, 'green');
    log(`   Date: ${mockExam.properties.exam_date}`, 'cyan');
    log(`   Location: ${mockExam.properties.location}`, 'cyan');
    log(`   Active: ${mockExam.properties.is_active}`, 'cyan');
    log(`   Capacity: ${mockExam.properties.total_bookings}/${mockExam.properties.capacity}`, 'cyan');

    if (mockExam.properties.is_active !== 'true') {
      log('❌ Mock exam is not active', 'red');
      process.exit(1);
    }

    // Step 2: Search for contact
    log('\n🔍 Step 2: Searching for contact...', 'blue');
    const contact = await hubspot.searchContacts(studentId, email, mockExam.properties.mock_type);

    if (!contact) {
      log('❌ Contact not found', 'red');
      log(`   Searched for: student_id=${studentId}, email=${email}`, 'yellow');
      process.exit(1);
    }

    const contactName = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || studentId;
    log(`✅ Found contact: ${contactName}`, 'green');
    log(`   ID: ${contact.id}`, 'cyan');
    log(`   Email: ${contact.properties.email}`, 'cyan');

    // Step 3: Check for duplicate booking
    log('\n🔎 Step 3: Checking for duplicate bookings...', 'blue');
    const formatBookingDate = (dateString) => {
      const dateParts = dateString.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const day = parseInt(dateParts[2]);
      const date = new Date(year, month, day);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const formattedDate = formatBookingDate(mockExam.properties.exam_date);
    const bookingId = `${mockExam.properties.mock_type}-${studentId}-${formattedDate}`;

    const isDuplicate = await hubspot.checkExistingBooking(bookingId);
    if (isDuplicate) {
      log('❌ Duplicate booking found', 'red');
      log(`   Existing booking ID: ${bookingId}`, 'yellow');
      log('\n⚠️  This booking already exists. Please use a different student_id or delete the existing booking first.', 'yellow');
      process.exit(1);
    }

    log('✅ No duplicate found', 'green');

    // Step 4: Prepare booking data based on mock type
    log('\n📝 Step 4: Preparing booking data...', 'blue');
    const bookingPayload = {
      mock_exam_id: mockExamId,
      student_id: studentId,
      email: email,
      mock_type: mockExam.properties.mock_type,
      exam_date: mockExam.properties.exam_date
    };

    // Add conditional fields based on mock type
    const mockType = mockExam.properties.mock_type;
    if (mockType === 'Clinical Skills') {
      // Prompt for dominant hand
      log('\n❓ Clinical Skills exam requires dominant hand.', 'yellow');
      log('   Please enter in code: true for Right, false for Left', 'yellow');
      log('   Or edit this script to set dominant_hand directly', 'yellow');
      bookingPayload.dominant_hand = true; // Default to Right
      log(`   Using: ${bookingPayload.dominant_hand ? 'Right' : 'Left'}`, 'cyan');
    } else if (mockType === 'Situational Judgment' || mockType === 'Mini-mock') {
      // Prompt for location
      log('\n❓ This exam type requires attending location.', 'yellow');
      log('   Please edit this script to set attending_location', 'yellow');
      log('   Valid options: Mississauga, Calgary, Vancouver, Montreal, Richmond Hill', 'yellow');
      bookingPayload.attending_location = mockExam.properties.location || 'Mississauga';
      log(`   Using: ${bookingPayload.attending_location}`, 'cyan');
    }

    log('\n📤 Booking Payload:', 'blue');
    log(JSON.stringify(bookingPayload, null, 2), 'cyan');

    // Step 5: Confirm before creating
    log('\n⚠️  DRY RUN MODE', 'yellow');
    log('   To actually create the booking, modify this script to call the endpoint', 'yellow');
    log('   Or use the admin frontend UI to create the booking', 'yellow');

    log('\n✅ Pre-flight checks complete!', 'green');
    log('\nNext steps:', 'cyan');
    log('  1. Open admin frontend', 'cyan');
    log(`  2. Navigate to mock exam details for ID: ${mockExamId}`, 'cyan');
    log('  3. Click "Create Booking" button', 'cyan');
    log(`  4. Enter student_id: ${studentId}`, 'cyan');
    log(`  5. Enter email: ${email}`, 'cyan');
    if (mockType === 'Clinical Skills') {
      log('  6. Select dominant hand', 'cyan');
    } else if (mockType === 'Situational Judgment' || mockType === 'Mini-mock') {
      log(`  6. Select location: ${bookingPayload.attending_location}`, 'cyan');
    }
    log('  7. Submit the form', 'cyan');
    log('\n📊 Expected Result:', 'cyan');
    log(`  - Booking ID: ${bookingId}`, 'cyan');
    log(`  - Contact: ${contactName}`, 'cyan');
    log(`  - Token: Admin Override`, 'cyan');
    log(`  - Associations: Contact + Mock Exam`, 'cyan');
    log(`  - Audit Note: Created with 3 associations`, 'cyan');
    log(`  - Total Bookings: ${parseInt(mockExam.properties.total_bookings) + 1}/${mockExam.properties.capacity}`, 'cyan');

    if (parseInt(mockExam.properties.total_bookings) >= parseInt(mockExam.properties.capacity)) {
      log('\n⚠️  WARNING: This booking will exceed capacity (admin override)', 'yellow');
    }

  } catch (error) {
    log('\n❌ Error during test:', 'red');
    log(error.message, 'red');
    if (error.response) {
      log('\nHubSpot API Response:', 'yellow');
      log(JSON.stringify(error.response.data, null, 2), 'yellow');
    }
    process.exit(1);
  }
}

// Run the test
testAdminBookingCreation();
