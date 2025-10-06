/**
 * Diagnostic Test Script: Booking Card Update Flow
 *
 * Purpose: Test the complete flow from booking creation to card display update
 *
 * This script will:
 * 1. Create a test booking
 * 2. Check if HubSpot associations are created
 * 3. Query the list API at different intervals
 * 4. Identify when the booking appears and why it might not appear
 */

require('dotenv').config();
const { HubSpotService, HUBSPOT_OBJECTS } = require('../../api/_shared/hubspot');

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(emoji, message, data = null) {
  console.log(`${emoji} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function success(message, data = null) {
  log('✅', `${colors.green}${message}${colors.reset}`, data);
}

function error(message, data = null) {
  log('❌', `${colors.red}${message}${colors.reset}`, data);
}

function info(message, data = null) {
  log('ℹ️', `${colors.blue}${message}${colors.reset}`, data);
}

function warning(message, data = null) {
  log('⚠️', `${colors.yellow}${message}${colors.reset}`, data);
}

async function wait(ms, message = null) {
  if (message) {
    info(`${message} (${ms / 1000}s)...`);
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBookingCreationAndRetrieval() {
  const hubspot = new HubSpotService();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.cyan}BOOKING CARD UPDATE DIAGNOSTIC TEST${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);

  // Test data - Use a test contact
  const TEST_CONTACT_ID = process.env.TEST_CONTACT_ID || '36619964451'; // Replace with actual test contact
  const TEST_MOCK_EXAM_ID = process.env.TEST_MOCK_EXAM_ID; // Will be selected from available exams
  const TEST_STUDENT_ID = process.env.TEST_STUDENT_ID || 'TEST-STUDENT-001';
  const TEST_EMAIL = process.env.TEST_EMAIL || 'test@prepdoctors.com';

  try {
    // Step 1: Get test contact details
    info('STEP 1: Fetching test contact details...');
    const contact = await hubspot.apiCall('GET',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${TEST_CONTACT_ID}?properties=firstname,lastname,student_id,email,sj_credits,cs_credits,sjmini_credits,shared_mock_credits`
    );

    success('Contact fetched:', {
      id: contact.id,
      name: `${contact.properties.firstname} ${contact.properties.lastname}`,
      email: contact.properties.email,
      student_id: contact.properties.student_id,
      credits: {
        sj: contact.properties.sj_credits || 0,
        cs: contact.properties.cs_credits || 0,
        sjmini: contact.properties.sjmini_credits || 0,
        shared: contact.properties.shared_mock_credits || 0
      }
    });

    // Step 2: Get available mock exams
    info('\nSTEP 2: Fetching available mock exams...');
    const mockExamsSearch = await hubspot.apiCall('POST',
      `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`,
      {
        filterGroups: [{
          filters: [{
            propertyName: 'is_active',
            operator: 'EQ',
            value: 'true'
          }]
        }],
        properties: ['mock_type', 'exam_date', 'location', 'capacity', 'total_bookings', 'is_active'],
        limit: 5
      }
    );

    if (!mockExamsSearch.results || mockExamsSearch.results.length === 0) {
      error('No active mock exams found. Please create a test mock exam first.');
      return;
    }

    const mockExam = mockExamsSearch.results[0];
    success('Using mock exam:', {
      id: mockExam.id,
      mock_type: mockExam.properties.mock_type,
      exam_date: mockExam.properties.exam_date,
      location: mockExam.properties.location,
      capacity: mockExam.properties.capacity,
      total_bookings: mockExam.properties.total_bookings
    });

    // Step 3: Create test booking
    info('\nSTEP 3: Creating test booking...');
    const bookingId = `${mockExam.properties.mock_type}-${contact.properties.firstname} ${contact.properties.lastname} - ${mockExam.properties.exam_date}`;

    const bookingData = {
      bookingId,
      name: `${contact.properties.firstname} ${contact.properties.lastname}`,
      email: contact.properties.email,
      tokenUsed: 'Shared Token',
      attendingLocation: mockExam.properties.location || 'Mississauga'
    };

    const createdBooking = await hubspot.createBooking(bookingData);
    success('Booking created:', {
      id: createdBooking.id,
      booking_id: createdBooking.properties.booking_id,
      is_active: createdBooking.properties.is_active,
      name: createdBooking.properties.name,
      email: createdBooking.properties.email
    });

    const bookingRecordId = createdBooking.id;

    // Step 4: Create associations
    info('\nSTEP 4: Creating associations...');

    // Associate with contact
    try {
      info('Creating booking → contact association...');
      const contactAssoc = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        bookingRecordId,
        HUBSPOT_OBJECTS.contacts,
        TEST_CONTACT_ID
      );
      success('Contact association created:', contactAssoc);
    } catch (err) {
      error('Contact association failed:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
    }

    // Associate with mock exam
    try {
      info('Creating booking → mock exam association...');
      const mockExamAssoc = await hubspot.createAssociation(
        HUBSPOT_OBJECTS.bookings,
        bookingRecordId,
        HUBSPOT_OBJECTS.mock_exams,
        mockExam.id
      );
      success('Mock exam association created:', mockExamAssoc);
    } catch (err) {
      error('Mock exam association failed:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
    }

    // Step 5: Verify associations
    info('\nSTEP 5: Verifying associations...');
    try {
      const associations = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingRecordId}/associations/${HUBSPOT_OBJECTS.contacts}`
      );

      if (associations.results && associations.results.length > 0) {
        success('Booking → Contact associations verified:', {
          count: associations.results.length,
          contactIds: associations.results.map(a => a.toObjectId)
        });
      } else {
        warning('No contact associations found for booking!');
      }
    } catch (err) {
      error('Failed to verify associations:', err.message);
    }

    // Step 6: Test list API at different intervals
    info('\nSTEP 6: Testing list API retrieval at different intervals...');
    const intervals = [
      { delay: 0, label: 'Immediately' },
      { delay: 1000, label: '1 second' },
      { delay: 3000, label: '3 seconds' },
      { delay: 5000, label: '5 seconds' },
      { delay: 10000, label: '10 seconds' }
    ];

    for (const interval of intervals) {
      await wait(interval.delay, `Waiting ${interval.label}`);

      info(`\nAttempt: ${interval.label} after creation`);

      try {
        // Call getBookingsForContact method
        const result = await hubspot.getBookingsForContact(TEST_CONTACT_ID, {
          filter: 'upcoming',
          page: 1,
          limit: 10
        });

        info('List API Response:', {
          total_bookings: result.total,
          returned_bookings: result.bookings.length,
          pagination: result.pagination
        });

        // Check if our booking is in the results
        const ourBooking = result.bookings.find(b => b.id === bookingRecordId || b.booking_id === bookingId);

        if (ourBooking) {
          success(`✓ BOOKING FOUND at ${interval.label}!`, {
            id: ourBooking.id,
            booking_id: ourBooking.booking_id,
            is_active: ourBooking.is_active,
            mock_type: ourBooking.mock_type || ourBooking.mock_exam?.mock_type,
            exam_date: ourBooking.exam_date || ourBooking.mock_exam?.exam_date
          });
          break; // Stop checking once found
        } else {
          warning(`✗ Booking NOT found at ${interval.label}`);

          // Show what we got instead
          if (result.bookings.length > 0) {
            info('Bookings returned:', result.bookings.map(b => ({
              id: b.id,
              booking_id: b.booking_id,
              is_active: b.is_active
            })));
          } else {
            warning('No bookings returned at all!');
          }
        }
      } catch (err) {
        error(`List API failed at ${interval.label}:`, {
          message: err.message,
          status: err.response?.status
        });
      }
    }

    // Step 7: Direct verification - fetch the booking directly
    info('\nSTEP 7: Direct verification - fetching booking by ID...');
    try {
      const directBooking = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingRecordId}?properties=booking_id,is_active,name,email,mock_type,exam_date,location,hs_createdate`
      );

      success('Direct booking fetch successful:', {
        id: directBooking.id,
        properties: directBooking.properties
      });
    } catch (err) {
      error('Direct booking fetch failed:', err.message);
    }

    // Step 8: Check contact's associations directly
    info('\nSTEP 8: Checking contact associations directly...');
    try {
      const contactBookings = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${TEST_CONTACT_ID}/associations/${HUBSPOT_OBJECTS.bookings}`
      );

      info('Contact → Booking associations:', {
        count: contactBookings.results?.length || 0,
        bookingIds: contactBookings.results?.map(a => a.toObjectId) || []
      });

      const hasOurBooking = contactBookings.results?.some(a => a.toObjectId === bookingRecordId);

      if (hasOurBooking) {
        success('✓ Our booking IS in contact associations');
      } else {
        error('✗ Our booking is NOT in contact associations');
      }
    } catch (err) {
      error('Failed to check contact associations:', err.message);
    }

    // Step 9: Cleanup (optional - comment out to keep test data)
    info('\nSTEP 9: Cleanup...');
    warning('Skipping cleanup - keeping test booking for manual verification');
    warning(`To delete manually, use booking ID: ${bookingRecordId}`);

    /* Uncomment to enable cleanup
    try {
      await hubspot.deleteBooking(bookingRecordId);
      success('Test booking deleted');
    } catch (err) {
      error('Cleanup failed:', err.message);
    }
    */

    console.log(`\n${'='.repeat(80)}`);
    success('DIAGNOSTIC TEST COMPLETE');
    console.log(`${'='.repeat(80)}\n`);

  } catch (err) {
    error('Test failed with error:', {
      message: err.message,
      stack: err.stack
    });
  }
}

// Run the test
testBookingCreationAndRetrieval();
