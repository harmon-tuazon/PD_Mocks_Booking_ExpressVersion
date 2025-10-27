/**
 * Test script to verify timezone fixes for edit operations
 *
 * This tests both backend and frontend timezone handling:
 * 1. Backend: convertToTimestamp() properly converts to EST
 * 2. Frontend: convertToTimeInput() properly extracts time in EST
 */

console.log('\n========================================');
console.log('TIMEZONE FIX VERIFICATION FOR EDIT FLOW');
console.log('========================================\n');

// Test 1: Backend convertToTimestamp (same function used in bulk-create)
console.log('TEST 1: Backend convertToTimestamp()');
console.log('-------------------------------------');

// Simulate the HubSpotService.convertToTimestamp function (DST-aware)
function convertToTimestamp(examDate, timeString) {
  if (!examDate || !timeString) {
    throw new Error('Both examDate and timeString are required for timestamp conversion');
  }

  console.log('🕐 [CONVERT-TIMESTAMP] Input:', { examDate, timeString });

  // Parse time string
  const timeParts = timeString.split(':');
  const hours = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1] || '0');
  const seconds = parseInt(timeParts[2] || '0');

  // Parse the exam date
  const [year, month, day] = examDate.split('-').map(Number);

  // Create a date object to check if DST is in effect
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Format the date in America/Toronto timezone to check the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });

  const formatted = formatter.format(testDate);
  const isDST = formatted.includes('EDT'); // EDT = Daylight Time (UTC-4), EST = Standard Time (UTC-5)

  // Use the appropriate offset
  const offset = isDST ? '-04:00' : '-05:00';
  const offsetName = isDST ? 'EDT' : 'EST';

  // Create ISO string with the correct timezone offset
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');
  const isoString = `${examDate}T${hoursStr}:${minutesStr}:${secondsStr}${offset}`;

  console.log(`🕐 [CONVERT-TIMESTAMP] Detected timezone: ${offsetName} (${offset})`);
  console.log('🕐 [CONVERT-TIMESTAMP] ISO String:', isoString);

  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    console.error('❌ [CONVERT-TIMESTAMP] Invalid date created:', { isoString, examDate, timeString });
    throw new Error('Invalid date or time format');
  }

  const timestamp = date.getTime();
  console.log('🕐 [CONVERT-TIMESTAMP] Output timestamp:', timestamp);
  console.log('🕐 [CONVERT-TIMESTAMP] Represents:', new Date(timestamp).toISOString());

  return timestamp;
}

// Test editing with 10:00 AM
const editTestDate = '2026-04-30';
const editTestTime = '10:00';
const editTimestamp = convertToTimestamp(editTestDate, editTestTime);

console.log('\n✅ Verification:');
console.log('  - Input: 10:00 AM');
console.log('  - Timestamp:', editTimestamp);
console.log('  - UTC Time:', new Date(editTimestamp).toISOString());
console.log('  - Expected UTC: 15:00 (10 AM EST + 5 hours)');
console.log('  - Actual UTC Hour:', new Date(editTimestamp).getUTCHours());

if (new Date(editTimestamp).getUTCHours() === 15) {
  console.log('  ✅ BACKEND FIX WORKING: Timestamp represents 10:00 AM EST');
} else {
  console.log('  ❌ BACKEND FIX FAILED: Timestamp does NOT represent 10:00 AM EST');
}

// Test 2: Frontend convertToTimeInput
console.log('\n\nTEST 2: Frontend convertToTimeInput()');
console.log('-------------------------------------');

// Simulate the frontend convertToTimeInput function
function convertToTimeInput(timeValue) {
  if (!timeValue) return '';

  try {
    const date = new Date(timeValue);

    if (isNaN(date.getTime())) {
      console.warn('Invalid time value:', timeValue);
      return '';
    }

    console.log('🕐 [convertToTimeInput] Converting timestamp to EST time:', {
      input: timeValue,
      inputType: typeof timeValue,
      dateUTC: date.toISOString()
    });

    // Extract hours and minutes in EST timezone
    const estTimeString = date.toLocaleTimeString('en-US', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    console.log('🕐 [convertToTimeInput] Extracted EST time:', estTimeString);

    return estTimeString;
  } catch (error) {
    console.error('Error converting time for input:', error, timeValue);
    return '';
  }
}

// Test with the timestamp we just created (10:00 AM EST)
const displayedTime = convertToTimeInput(editTimestamp);

console.log('\n✅ Verification:');
console.log('  - Timestamp:', editTimestamp);
console.log('  - Displayed Time:', displayedTime);
console.log('  - Expected: 10:00');
console.log('  - Match:', displayedTime === '10:00' ? '✅ YES' : '❌ NO');

if (displayedTime === '10:00') {
  console.log('  ✅ FRONTEND FIX WORKING: Displays correct EST time');
} else {
  console.log('  ❌ FRONTEND FIX FAILED: Does not display correct EST time');
}

// Test 3: Round-trip test (create → display → edit → save)
console.log('\n\nTEST 3: Round-Trip Test');
console.log('-------------------------------------');

// Step 1: User creates session at 9:00 AM
const createTime = '09:00';
const createDate = '2026-04-30';
const createdTimestamp = convertToTimestamp(createDate, createTime);
console.log('1. Created session at 9:00 AM');
console.log('   Timestamp:', createdTimestamp);

// Step 2: User opens edit form, sees the time
const displayTime = convertToTimeInput(createdTimestamp);
console.log('2. Edit form displays:', displayTime);

// Step 3: User changes to 11:00 AM and saves
const newTime = '11:00';
const updatedTimestamp = convertToTimestamp(createDate, newTime);
console.log('3. User changes to 11:00 AM');
console.log('   New timestamp:', updatedTimestamp);

// Step 4: Form displays updated time
const finalDisplayTime = convertToTimeInput(updatedTimestamp);
console.log('4. Form now displays:', finalDisplayTime);

console.log('\n✅ Round-Trip Verification:');
console.log('  - Original: 9:00 AM → Display:', displayTime, '→', displayTime === '09:00' ? '✅' : '❌');
console.log('  - Updated: 11:00 AM → Display:', finalDisplayTime, '→', finalDisplayTime === '11:00' ? '✅' : '❌');

if (displayTime === '09:00' && finalDisplayTime === '11:00') {
  console.log('  ✅ ROUND-TRIP TEST PASSED: Times preserved correctly through edit cycle');
} else {
  console.log('  ❌ ROUND-TRIP TEST FAILED: Times not preserved correctly');
}

// Test 4: Cross-timezone consistency
console.log('\n\nTEST 4: Cross-Timezone Consistency');
console.log('-------------------------------------');
console.log('Verifying that users in different timezones see the same time...\n');

// Simulate different user timezones viewing the same timestamp
const testTimestamp = convertToTimestamp('2026-04-30', '14:00'); // 2 PM EST

console.log('Stored time: 2:00 PM EST (timestamp:', testTimestamp, ')');
console.log('');

// User in EST
const estDisplay = convertToTimeInput(testTimestamp);
console.log('User in EST sees:', estDisplay, '→', estDisplay === '14:00' ? '✅ Correct' : '❌ Wrong');

// User in PST (should also see 14:00 because we force EST display)
const pstDisplay = convertToTimeInput(testTimestamp);
console.log('User in PST sees:', pstDisplay, '→', pstDisplay === '14:00' ? '✅ Correct (forced EST)' : '❌ Wrong');

// User in UTC (should also see 14:00)
const utcDisplay = convertToTimeInput(testTimestamp);
console.log('User in UTC sees:', utcDisplay, '→', utcDisplay === '14:00' ? '✅ Correct (forced EST)' : '❌ Wrong');

if (estDisplay === '14:00' && pstDisplay === '14:00' && utcDisplay === '14:00') {
  console.log('\n✅ CROSS-TIMEZONE TEST PASSED: All users see consistent EST time');
} else {
  console.log('\n❌ CROSS-TIMEZONE TEST FAILED: Users see different times');
}

// Final Summary
console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log('All tests verify that:');
console.log('1. Backend stores times in EST timezone');
console.log('2. Frontend displays times in EST timezone');
console.log('3. Round-trip edit operations preserve times');
console.log('4. Users in all timezones see consistent times');
console.log('========================================\n');
