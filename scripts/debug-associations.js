/**
 * Debug Script: Check associations between Mock Exams and Bookings
 *
 * This script investigates why bookings aren't showing up in associations.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../admin_root/.env') });
const hubspot = require('../admin_root/api/_shared/hubspot');

const HUBSPOT_OBJECTS = {
  'bookings': '2-50158943',
  'mock_exams': '2-50158913'
};

async function debugAssociations() {
  console.log('\n🔍 DEBUGGING ASSOCIATIONS BETWEEN MOCK EXAMS AND BOOKINGS\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get a mock exam with non-zero bookings count
    console.log('\n📋 Step 1: Finding mock exams with bookings...');
    const mockExamsResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/search`, {
      limit: 20,
      properties: ['mock_type', 'exam_date', 'total_bookings', 'start_time'],
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'total_bookings',
              operator: 'GT',
              value: '0'
            }
          ]
        }
      ],
      sorts: [{ propertyName: 'exam_date', direction: 'DESCENDING' }]
    });

    console.log(`   Found ${mockExamsResponse.results?.length || 0} mock exams with bookings > 0`);

    if (!mockExamsResponse.results || mockExamsResponse.results.length === 0) {
      console.log('\n   ⚠️ No mock exams with bookings found. Trying without filter...');

      // Try to find ANY bookings directly
      const bookingsResponse = await hubspot.apiCall('POST', `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/search`, {
        limit: 5,
        properties: ['booking_id', 'student_id', 'is_active', 'exam_date', 'mock_type']
      });

      console.log(`\n   Found ${bookingsResponse.results?.length || 0} total bookings in system`);

      if (bookingsResponse.results && bookingsResponse.results.length > 0) {
        console.log('\n   📊 SAMPLE BOOKINGS FOUND:');
        console.log('   ' + '-'.repeat(80));

        for (const booking of bookingsResponse.results.slice(0, 5)) {
          console.log(`\n   Booking ID: ${booking.id}`);
          console.log(`   - booking_id: ${booking.properties.booking_id || 'N/A'}`);
          console.log(`   - student_id: ${booking.properties.student_id || 'N/A'}`);
          console.log(`   - is_active: "${booking.properties.is_active}"`);
          console.log(`   - exam_date: ${booking.properties.exam_date || 'N/A'}`);
          console.log(`   - mock_type: ${booking.properties.mock_type || 'N/A'}`);

          // Check associations from booking side
          console.log(`\n   🔗 Checking associations from Booking -> Mock Exam...`);
          const bookingWithAssoc = await hubspot.apiCall('GET',
            `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${booking.id}?associations=${HUBSPOT_OBJECTS.mock_exams}`
          );

          console.log(`   Raw associations response:`, JSON.stringify(bookingWithAssoc.associations, null, 2));

          if (bookingWithAssoc.associations) {
            const mockExamKey = Object.keys(bookingWithAssoc.associations).find(key =>
              key.includes('mock') || key === HUBSPOT_OBJECTS.mock_exams
            );

            if (mockExamKey) {
              const mockExamAssociations = bookingWithAssoc.associations[mockExamKey].results || [];
              console.log(`   ✅ Found ${mockExamAssociations.length} mock exam associations`);

              if (mockExamAssociations.length > 0) {
                const mockExamId = mockExamAssociations[0].id;
                console.log(`   Mock Exam ID from association: ${mockExamId}`);

                // Now check from the other direction
                console.log(`\n   🔄 Checking reverse: Mock Exam -> Booking...`);
                const mockExamWithAssoc = await hubspot.apiCall('GET',
                  `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${mockExamId}?associations=${HUBSPOT_OBJECTS.bookings}`
                );

                console.log(`   Raw associations response:`, JSON.stringify(mockExamWithAssoc.associations, null, 2));

                if (mockExamWithAssoc.associations) {
                  const bookingsKey = Object.keys(mockExamWithAssoc.associations).find(key =>
                    key.includes('booking') || key === HUBSPOT_OBJECTS.bookings
                  );

                  if (bookingsKey) {
                    const bookingAssociations = mockExamWithAssoc.associations[bookingsKey].results || [];
                    console.log(`   ✅ Found ${bookingAssociations.length} booking associations`);
                  } else {
                    console.log(`   ❌ No booking associations key found`);
                    console.log(`   Available keys:`, Object.keys(mockExamWithAssoc.associations));
                  }
                }
              }
            } else {
              console.log(`   ❌ No mock exam associations found`);
              console.log(`   Available association keys:`, Object.keys(bookingWithAssoc.associations));
            }
          } else {
            console.log(`   ❌ No associations object in response`);
          }

          console.log('   ' + '-'.repeat(80));
        }
      } else {
        console.log('\n   ❌ NO BOOKINGS FOUND IN THE SYSTEM!');
        console.log('   This means the database is empty or the object type ID is wrong.');
      }
    } else {
      // We found mock exams with bookings, check their associations
      const exam = mockExamsResponse.results[0];
      console.log(`\n   Using: ${exam.properties.mock_type} on ${exam.properties.exam_date} (${exam.properties.total_bookings} bookings)`);

      // Get with associations
      console.log(`\n   🔗 Fetching with associations...`);
      const examWithAssoc = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.mock_exams}/${exam.id}?associations=${HUBSPOT_OBJECTS.bookings}`
      );

      console.log(`   Raw associations response:`, JSON.stringify(examWithAssoc.associations, null, 2));
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEBUG COMPLETE\n');

  } catch (error) {
    console.error('\n❌ Error during debugging:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('   Stack:', error.stack);
  }
}

// Run the debug script
debugAssociations();
