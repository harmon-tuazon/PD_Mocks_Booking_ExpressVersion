/**
 * Test script for transformLoginCreditsToCache function
 *
 * This validates that the transformation includes all required fields
 * for the booking flow to work correctly.
 */

const loginResponse = {
  contact_id: '123456',
  name: 'John Doe',
  credits: {
    sj_credits: 5,
    cs_credits: 3,
    sjmini_credits: 2,
    mock_discussion_token: 1,
    shared_mock_credits: 2
  }
};

function transformLoginCreditsToCache(loginResponse) {
  if (!loginResponse?.credits) {
    return {};
  }

  const {
    sj_credits = 0,
    cs_credits = 0,
    sjmini_credits = 0,
    mock_discussion_token = 0,
    shared_mock_credits = 0
  } = loginResponse.credits;

  const commonFields = {
    student_name: loginResponse.name || '',
    contact_id: loginResponse.contact_id || null,
    enrollment_id: null,
    error_message: null
  };

  return {
    'Situational Judgment': {
      eligible: (sj_credits + shared_mock_credits) > 0,
      available_credits: sj_credits + shared_mock_credits,
      credit_breakdown: {
        specific_credits: sj_credits,
        shared_credits: shared_mock_credits,
        total_credits: sj_credits + shared_mock_credits
      },
      ...commonFields,
      error_message: (sj_credits + shared_mock_credits) > 0
        ? null
        : 'You have 0 credits available for Situational Judgment exams.'
    },
    'Clinical Skills': {
      eligible: (cs_credits + shared_mock_credits) > 0,
      available_credits: cs_credits + shared_mock_credits,
      credit_breakdown: {
        specific_credits: cs_credits,
        shared_credits: shared_mock_credits,
        total_credits: cs_credits + shared_mock_credits
      },
      ...commonFields,
      error_message: (cs_credits + shared_mock_credits) > 0
        ? null
        : 'You have 0 credits available for Clinical Skills exams.'
    }
  };
}

console.log('🧪 Testing transformLoginCreditsToCache...\n');

const result = transformLoginCreditsToCache(loginResponse);

console.log('✅ Transformation Result for Situational Judgment:');
console.log(JSON.stringify(result['Situational Judgment'], null, 2));

console.log('\n📋 Required Fields Check:');
const requiredFields = [
  'eligible',
  'available_credits',
  'credit_breakdown',
  'student_name',
  'contact_id',
  'enrollment_id',
  'error_message'
];

const sjData = result['Situational Judgment'];
let allFieldsPresent = true;

requiredFields.forEach(field => {
  const present = field in sjData;
  const value = sjData[field];
  const status = present ? '✅' : '❌';
  console.log(`${status} ${field}: ${JSON.stringify(value)}`);
  if (!present) allFieldsPresent = false;
});

if (allFieldsPresent) {
  console.log('\n✅ All required fields present! Booking flow should work.');
} else {
  console.log('\n❌ Missing required fields! Booking flow will fail.');
  process.exit(1);
}
