/**
 * Diagnostic Test Script: Token Display Issue
 *
 * Purpose: Identify why tokens are showing as zero after booking
 *
 * Context:
 * - User ID: 1589999 (Test Harmon)
 * - Email: htuazon@prepdoctors.com
 * - HubSpot should have 5 shared_mock_credits
 * - After booking SJ exam, confirmation page shows all tokens as 0
 *
 * This script will:
 * 1. Fetch the contact record directly from HubSpot
 * 2. Log ALL credit-related properties with their raw values
 * 3. Verify property names are correct and exist
 * 4. Test the credit calculation logic used in the API
 * 5. Simulate what the API response would contain
 * 6. Identify any property name mismatches or data type issues
 *
 * USAGE:
 * ------
 * # Default: Search by email (htuazon@prepdoctors.com) for SJ exam
 * node tests/manual/diagnose-token-display.js
 *
 * # Specify contact ID directly
 * node tests/manual/diagnose-token-display.js <CONTACT_ID>
 *
 * # Specify contact ID and email
 * node tests/manual/diagnose-token-display.js <CONTACT_ID> <EMAIL>
 *
 * # Specify contact ID, email, and mock type
 * node tests/manual/diagnose-token-display.js <CONTACT_ID> <EMAIL> "Clinical Skills"
 *
 * # Use environment variables
 * TEST_CONTACT_ID=123 TEST_EMAIL=test@example.com MOCK_TYPE="Mini-mock" node tests/manual/diagnose-token-display.js
 *
 * EXAMPLES:
 * ---------
 * node tests/manual/diagnose-token-display.js
 * node tests/manual/diagnose-token-display.js 36619964451
 * node tests/manual/diagnose-token-display.js 36619964451 htuazon@prepdoctors.com
 * node tests/manual/diagnose-token-display.js 36619964451 htuazon@prepdoctors.com "Clinical Skills"
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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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

function section(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);
}

/**
 * Replicate the credit calculation logic from create.js
 */
function calculateCredits(contact, mockType) {
  let specificCredits = 0;
  let sharedCredits = parseInt(contact.properties.shared_mock_credits) || 0;

  switch (mockType) {
    case 'Situational Judgment':
      specificCredits = parseInt(contact.properties.sj_credits) || 0;
      break;
    case 'Clinical Skills':
      specificCredits = parseInt(contact.properties.cs_credits) || 0;
      break;
    case 'Mini-mock':
      specificCredits = parseInt(contact.properties.sjmini_credits) || 0;
      sharedCredits = 0; // Don't use shared credits for mini-mock
      break;
  }

  const totalCredits = specificCredits + sharedCredits;

  return {
    specificCredits,
    sharedCredits,
    totalCredits
  };
}

/**
 * Determine which credit field would be deducted
 */
function getCreditFieldToDeduct(mockType, creditBreakdown) {
  if (!creditBreakdown) {
    throw new Error('Credit breakdown not provided');
  }

  // For Mini-mock, only use specific credits
  if (mockType === 'Mini-mock') {
    return 'sjmini_credits';
  }

  // For other types, prefer specific credits, then shared
  if (mockType === 'Situational Judgment') {
    return creditBreakdown.specificCredits > 0 ? 'sj_credits' : 'shared_mock_credits';
  }

  if (mockType === 'Clinical Skills') {
    return creditBreakdown.specificCredits > 0 ? 'cs_credits' : 'shared_mock_credits';
  }

  throw new Error('Invalid mock type for credit deduction');
}

/**
 * Simulate the API response credit_breakdown structure
 */
function simulateApiResponse(contact, mockType, deductCredit = true) {
  const before = calculateCredits(contact, mockType);

  // Determine which credit field would be deducted
  const creditField = getCreditFieldToDeduct(mockType, before);

  // Simulate deduction
  let specificCreditsAfter = before.specificCredits;
  let sharedCreditsAfter = before.sharedCredits;

  if (deductCredit) {
    if (creditField === 'shared_mock_credits') {
      sharedCreditsAfter = Math.max(0, sharedCreditsAfter - 1);
    } else {
      specificCreditsAfter = Math.max(0, specificCreditsAfter - 1);
    }
  }

  return {
    credit_details: {
      credit_field_deducted: creditField,
      remaining_credits: deductCredit ? (
        creditField === 'shared_mock_credits' ? sharedCreditsAfter : specificCreditsAfter
      ) : before.totalCredits,
      credit_breakdown: {
        specific_credits: specificCreditsAfter,
        shared_credits: sharedCreditsAfter
      },
      deduction_details: {
        specific_credits_before: before.specificCredits,
        shared_credits_before: before.sharedCredits,
        field_used: creditField,
        amount_deducted: deductCredit ? 1 : 0
      }
    }
  };
}

async function diagnoseTokenDisplay() {
  section('TOKEN DISPLAY DIAGNOSTIC TEST');

  // Test Configuration - Override via command line arguments or environment
  const TEST_CONTACT_ID = process.env.TEST_CONTACT_ID || process.argv[2] || null;
  const TEST_EMAIL = process.env.TEST_EMAIL || process.argv[3] || 'htuazon@prepdoctors.com';
  const MOCK_TYPE = process.env.MOCK_TYPE || process.argv[4] || 'Situational Judgment';

  info('Test Configuration:', {
    contact_id: TEST_CONTACT_ID || 'Will search by email',
    email: TEST_EMAIL,
    mock_type: MOCK_TYPE
  });

  try {
    const hubspot = new HubSpotService();

    let contact;
    let contactId = TEST_CONTACT_ID;

    // If no contact ID provided, search by email
    if (!contactId) {
      info('No contact ID provided, searching by email...');

      const searchResponse = await hubspot.apiCall('POST',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/search`,
        {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: TEST_EMAIL
            }]
          }],
          properties: [
            'firstname',
            'lastname',
            'email',
            'student_id',
            'sj_credits',
            'cs_credits',
            'sjmini_credits',
            'shared_mock_credits'
          ],
          limit: 1
        }
      );

      if (!searchResponse.results || searchResponse.results.length === 0) {
        error(`No contact found with email: ${TEST_EMAIL}`);
        process.exit(1);
      }

      contact = searchResponse.results[0];
      contactId = contact.id;

      success(`Found contact by email: ${contact.properties.firstname} ${contact.properties.lastname} (ID: ${contactId})`);
    }

    // ============================================================================
    // STEP 1: Fetch Contact Record with ALL Properties
    // ============================================================================
    section('STEP 1: Fetching Contact Record from HubSpot');

    const allCreditProperties = [
      'firstname',
      'lastname',
      'email',
      'student_id',
      'sj_credits',
      'cs_credits',
      'sjmini_credits',
      'shared_mock_credits'
    ];

    // Only fetch if we don't already have the contact from search
    if (!contact) {
      info(`Requesting properties: ${allCreditProperties.join(', ')}`);

      contact = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}?properties=${allCreditProperties.join(',')}`
      );

      success('Contact record fetched successfully');
    } else {
      info('Using contact from email search');
    }

    // ============================================================================
    // STEP 2: Display Raw HubSpot Data
    // ============================================================================
    section('STEP 2: Raw HubSpot Contact Properties');

    console.log(`${colors.bright}Contact ID:${colors.reset} ${contact.id}`);
    console.log(`${colors.bright}Name:${colors.reset} ${contact.properties.firstname} ${contact.properties.lastname}`);
    console.log(`${colors.bright}Email:${colors.reset} ${contact.properties.email}`);
    console.log(`${colors.bright}Student ID:${colors.reset} ${contact.properties.student_id || 'N/A'}`);
    console.log('');

    // Display all credit properties with type information
    const creditProps = {
      'sj_credits': contact.properties.sj_credits,
      'cs_credits': contact.properties.cs_credits,
      'sjmini_credits': contact.properties.sjmini_credits,
      'shared_mock_credits': contact.properties.shared_mock_credits
    };

    console.log(`${colors.bright}${colors.magenta}Credit Properties (Raw Values):${colors.reset}`);
    console.log('┌────────────────────────┬──────────────┬──────────┬────────────┐');
    console.log('│ Property Name          │ Raw Value    │ Type     │ Parsed Int │');
    console.log('├────────────────────────┼──────────────┼──────────┼────────────┤');

    for (const [propName, rawValue] of Object.entries(creditProps)) {
      const valueType = typeof rawValue;
      const parsedInt = parseInt(rawValue);
      const parsedDisplay = isNaN(parsedInt) ? 'NaN' : parsedInt.toString();

      console.log(`│ ${propName.padEnd(22)} │ ${String(rawValue).padEnd(12)} │ ${valueType.padEnd(8)} │ ${parsedDisplay.padEnd(10)} │`);
    }
    console.log('└────────────────────────┴──────────────┴──────────┴────────────┘');

    // ============================================================================
    // STEP 3: Property Validation
    // ============================================================================
    section('STEP 3: Property Validation');

    const validationResults = {
      allPropertiesExist: true,
      missingProperties: [],
      unexpectedTypes: [],
      nullOrUndefined: []
    };

    for (const propName of ['sj_credits', 'cs_credits', 'sjmini_credits', 'shared_mock_credits']) {
      const value = contact.properties[propName];

      // Check if property exists
      if (value === undefined) {
        validationResults.allPropertiesExist = false;
        validationResults.missingProperties.push(propName);
        error(`Property '${propName}' is UNDEFINED (does not exist on contact)`);
      } else if (value === null) {
        validationResults.nullOrUndefined.push(propName);
        warning(`Property '${propName}' is NULL (exists but has no value)`);
      } else {
        // Check type
        const valueType = typeof value;
        if (valueType !== 'string' && valueType !== 'number') {
          validationResults.unexpectedTypes.push({ property: propName, type: valueType, value });
          warning(`Property '${propName}' has unexpected type: ${valueType} (expected string or number)`);
        } else {
          // Check if parseable
          const parsed = parseInt(value);
          if (isNaN(parsed)) {
            error(`Property '${propName}' value '${value}' cannot be parsed to integer`);
          } else {
            success(`Property '${propName}' is valid: ${parsed}`);
          }
        }
      }
    }

    console.log('');
    if (validationResults.allPropertiesExist &&
        validationResults.nullOrUndefined.length === 0 &&
        validationResults.unexpectedTypes.length === 0) {
      success('✓ All credit properties are valid and well-formed');
    } else {
      error('✗ Issues found with credit properties:', validationResults);
    }

    // ============================================================================
    // STEP 4: Credit Calculation Logic Test
    // ============================================================================
    section('STEP 4: Testing Credit Calculation Logic');

    const mockTypes = ['Situational Judgment', 'Clinical Skills', 'Mini-mock'];

    for (const mockType of mockTypes) {
      console.log(`\n${colors.bright}Mock Type: ${mockType}${colors.reset}`);

      const credits = calculateCredits(contact, mockType);

      console.log('  Calculation Results:');
      console.log(`    • Specific Credits: ${credits.specificCredits}`);
      console.log(`    • Shared Credits: ${credits.sharedCredits}`);
      console.log(`    • Total Credits: ${credits.totalCredits}`);

      const creditField = credits.totalCredits > 0
        ? getCreditFieldToDeduct(mockType, credits)
        : 'N/A (no credits)';

      console.log(`    • Credit Field to Deduct: ${creditField}`);

      if (credits.totalCredits > 0) {
        success(`  ✓ User has ${credits.totalCredits} total credits for ${mockType}`);
      } else {
        error(`  ✗ User has 0 credits for ${mockType}`);
      }
    }

    // ============================================================================
    // STEP 5: Simulate API Response (BEFORE Booking)
    // ============================================================================
    section('STEP 5: Simulated API Response BEFORE Booking');

    console.log(`${colors.bright}Simulating what the API would return for ${MOCK_TYPE}${colors.reset}\n`);

    const beforeBookingResponse = simulateApiResponse(contact, MOCK_TYPE, false);

    console.log('API Response Structure (BEFORE deduction):');
    console.log(JSON.stringify(beforeBookingResponse, null, 2));

    // ============================================================================
    // STEP 6: Simulate API Response (AFTER Booking)
    // ============================================================================
    section('STEP 6: Simulated API Response AFTER Booking');

    console.log(`${colors.bright}Simulating what the API would return after booking ${MOCK_TYPE}${colors.reset}\n`);

    const afterBookingResponse = simulateApiResponse(contact, MOCK_TYPE, true);

    console.log('API Response Structure (AFTER deduction):');
    console.log(JSON.stringify(afterBookingResponse, null, 2));

    // Extract the credit_breakdown that would be sent to frontend
    const creditBreakdown = afterBookingResponse.credit_details.credit_breakdown;

    console.log(`\n${colors.bright}Credit Breakdown sent to TokenCard:${colors.reset}`);
    console.log(JSON.stringify(creditBreakdown, null, 2));

    // ============================================================================
    // STEP 7: Frontend TokenCard Display Simulation
    // ============================================================================
    section('STEP 7: Frontend TokenCard Display Simulation');

    console.log(`${colors.bright}Mock Type: ${MOCK_TYPE}${colors.reset}`);
    console.log(`${colors.bright}Credit Breakdown:${colors.reset}`);
    console.log(`  • specific_credits: ${creditBreakdown.specific_credits}`);
    console.log(`  • shared_credits: ${creditBreakdown.shared_credits}`);

    // Simulate TokenCard component logic
    const specificCreditsDisplay = creditBreakdown.specific_credits || 0;
    const sharedCreditsDisplay = creditBreakdown.shared_credits || 0;
    const totalDisplay = specificCreditsDisplay + (MOCK_TYPE !== 'Mini-mock' ? sharedCreditsDisplay : 0);

    console.log(`\n${colors.bright}TokenCard Would Display:${colors.reset}`);
    console.log('  ┌─────────────────────────┬─────────┐');
    console.log('  │ Token Type              │ Amount  │');
    console.log('  ├─────────────────────────┼─────────┤');
    console.log(`  │ SJ Tokens               │ ${String(specificCreditsDisplay).padEnd(7)} │`);
    console.log(`  │ Shared Mock Tokens      │ ${String(sharedCreditsDisplay).padEnd(7)} │`);
    console.log('  ├─────────────────────────┼─────────┤');
    console.log(`  │ Total                   │ ${String(totalDisplay).padEnd(7)} │`);
    console.log('  └─────────────────────────┴─────────┘');

    if (totalDisplay === 0) {
      error('\n✗ ISSUE IDENTIFIED: TokenCard would show 0 tokens!');
      console.log(`\n${colors.red}${colors.bright}Root Cause Analysis:${colors.reset}`);

      if (creditBreakdown.specific_credits === 0 && creditBreakdown.shared_credits === 0) {
        console.log('  • Both specific_credits and shared_credits are 0 in the response');
        console.log('  • This means the API is returning zeros for the credit_breakdown');

        console.log(`\n${colors.yellow}Possible Causes:${colors.reset}`);
        console.log('  1. Credit was deducted but the AFTER values are not being calculated correctly');
        console.log('  2. API is using the wrong credit values in the response');
        console.log('  3. Contact properties have unexpected values in HubSpot');
      }
    } else {
      success(`\n✓ TokenCard would correctly display ${totalDisplay} total tokens`);
    }

    // ============================================================================
    // STEP 8: Data Flow Verification
    // ============================================================================
    section('STEP 8: Data Flow Verification');

    console.log(`${colors.bright}Tracing data flow from HubSpot to Frontend:${colors.reset}\n`);

    console.log('1️⃣ HubSpot Contact Properties:');
    console.log(`   sj_credits = ${contact.properties.sj_credits} (${typeof contact.properties.sj_credits})`);
    console.log(`   shared_mock_credits = ${contact.properties.shared_mock_credits} (${typeof contact.properties.shared_mock_credits})`);

    console.log('\n2️⃣ After Parsing in API:');
    const parsedSj = parseInt(contact.properties.sj_credits) || 0;
    const parsedShared = parseInt(contact.properties.shared_mock_credits) || 0;
    console.log(`   sj_credits = ${parsedSj} (number)`);
    console.log(`   shared_mock_credits = ${parsedShared} (number)`);

    console.log('\n3️⃣ Credit Calculation (for SJ exam):');
    const calc = calculateCredits(contact, MOCK_TYPE);
    console.log(`   specificCredits = ${calc.specificCredits}`);
    console.log(`   sharedCredits = ${calc.sharedCredits}`);
    console.log(`   totalCredits = ${calc.totalCredits}`);

    console.log('\n4️⃣ After Deduction Logic:');
    const deductResponse = simulateApiResponse(contact, MOCK_TYPE, true);
    console.log(`   specific_credits (AFTER) = ${deductResponse.credit_details.credit_breakdown.specific_credits}`);
    console.log(`   shared_credits (AFTER) = ${deductResponse.credit_details.credit_breakdown.shared_credits}`);

    console.log('\n5️⃣ Frontend Receives:');
    console.log(`   creditBreakdown.specific_credits = ${deductResponse.credit_details.credit_breakdown.specific_credits}`);
    console.log(`   creditBreakdown.shared_credits = ${deductResponse.credit_details.credit_breakdown.shared_credits}`);

    console.log('\n6️⃣ TokenCard Displays:');
    console.log(`   SJ Tokens: ${deductResponse.credit_details.credit_breakdown.specific_credits}`);
    console.log(`   Shared Mock Tokens: ${deductResponse.credit_details.credit_breakdown.shared_credits}`);
    console.log(`   Total: ${deductResponse.credit_details.credit_breakdown.specific_credits + deductResponse.credit_details.credit_breakdown.shared_credits}`);

    // ============================================================================
    // STEP 8.5: Check Recent Bookings
    // ============================================================================
    section('STEP 8.5: Checking Recent Bookings for This Contact');

    try {
      const bookings = await hubspot.apiCall('GET',
        `/crm/v3/objects/${HUBSPOT_OBJECTS.contacts}/${contactId}/associations/${HUBSPOT_OBJECTS.bookings}`
      );

      if (bookings.results && bookings.results.length > 0) {
        info(`Found ${bookings.results.length} booking(s) associated with this contact`);

        // Fetch details of recent bookings
        for (let i = 0; i < Math.min(bookings.results.length, 3); i++) {
          const association = bookings.results[i];
          const bookingId = association.toObjectId || association.id;

          if (!bookingId) {
            warning(`    Booking ${i + 1}: No valid ID found in association`);
            continue;
          }

          try {
            const booking = await hubspot.apiCall('GET',
              `/crm/v3/objects/${HUBSPOT_OBJECTS.bookings}/${bookingId}?properties=booking_id,token_used,is_active,hs_createdate`
            );

            const created = new Date(booking.properties.hs_createdate);
            console.log(`\n  Booking ${i + 1}:`);
            console.log(`    Record ID: ${bookingId}`);
            console.log(`    Booking ID: ${booking.properties.booking_id || 'N/A'}`);
            console.log(`    Token Used: ${booking.properties.token_used || 'N/A'}`);
            console.log(`    Status: ${booking.properties.is_active || 'N/A'}`);
            console.log(`    Created: ${created.toLocaleString()}`);
          } catch (err) {
            warning(`    Could not fetch details for booking ${bookingId}: ${err.message}`);
          }
        }
      } else {
        info('No bookings found for this contact');
      }
    } catch (err) {
      warning('Could not fetch bookings:', err.message);
    }

    // ============================================================================
    // STEP 9: Diagnostic Summary & Recommendations
    // ============================================================================
    section('STEP 9: Diagnostic Summary & Recommendations');

    console.log(`${colors.bright}${colors.cyan}Summary:${colors.reset}\n`);

    // Check if we can reproduce the zero-token issue
    const afterCredits = simulateApiResponse(contact, MOCK_TYPE, true).credit_details.credit_breakdown;
    const wouldShowZero = (afterCredits.specific_credits + afterCredits.shared_credits) === 0;

    if (wouldShowZero) {
      error('Issue Reproduced: Based on current HubSpot data, tokens WOULD show as zero');

      console.log(`\n${colors.yellow}${colors.bright}Recommended Actions:${colors.reset}`);
      console.log('  1. Verify the contact actually has credits in HubSpot:');
      console.log(`     • Check contact ${contactId} in HubSpot UI`);
      console.log('     • Confirm shared_mock_credits property has a value > 0');
      console.log('  2. Check if credits were already deducted:');
      console.log('     • Look for recent booking records for this contact (see Step 8.5 above)');
      console.log('     • Verify if a previous booking already consumed the credits');
      console.log('  3. Review the API response from actual booking:');
      console.log('     • Check browser console for API response');
      console.log('     • Compare actual response to simulated response above');
    } else {
      success('Based on current data, tokens should display correctly');

      console.log(`\n${colors.yellow}${colors.bright}If tokens still show as zero:${colors.reset}`);
      console.log('  1. Check the actual API response in browser console');
      console.log('  2. Verify the credit_breakdown object structure matches:');
      console.log('     { specific_credits: N, shared_credits: M }');
      console.log('  3. Check if BookingConfirmation is receiving the data correctly');
      console.log('  4. Verify no frontend caching issues (hard refresh the page)');
    }

    // ============================================================================
    // Final Output
    // ============================================================================
    section('DIAGNOSTIC TEST COMPLETE');

    success('All diagnostics completed successfully');
    console.log('');
    info('Next Steps:');
    console.log('  • Review the data flow trace above');
    console.log('  • Compare simulated responses to actual API responses');
    console.log('  • Check HubSpot UI to verify property values');
    console.log('  • Run this script again after making any changes');
    console.log('');

  } catch (err) {
    error('Diagnostic test failed with error:', {
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

// Run the diagnostic
diagnoseTokenDisplay();
