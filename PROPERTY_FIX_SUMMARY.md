# Token Property Name Fix Summary

## Issue
The refund service was using incorrect HubSpot property names that don't exist, causing 400 errors during credit restoration.

## Changes Made

### 1. Fixed TOKEN_PROPERTY_MAP in refund.js
**File**: `admin_root/api/_shared/refund.js`

**Old (INCORRECT)**:
```javascript
const TOKEN_PROPERTY_MAP = {
  'Mock Discussion Token': 'mock_discussion_token',
  'Clinical Skills Token': 'clinical_skills_token',  // WRONG
  'Situational Judgment Token': 'situational_judgment_token',  // WRONG
  'Mini-mock Token': 'mini_mock_token'  // WRONG
};
```

**New (CORRECT)**:
```javascript
const TOKEN_PROPERTY_MAP = {
  'Mock Discussion Token': 'mock_discussion_token',
  'Clinical Skills Token': 'cs_credits',
  'Situational Judgment Token': 'sj_credits',
  'Mini-mock Token': 'sjmini_credits'
};
```

### 2. Updated Contact Search API
**File**: `admin_root/api/admin/trainees/search.js`

- Updated property fetching to include correct property names:
  - `cs_credits` (instead of clinical_skills_token)
  - `sj_credits` (instead of situational_judgment_token)
  - `sjmini_credits` (instead of mini_mock_token)
  - Added `shared_mock_credits` for shared credits

- Updated response mapping to use correct property names when returning token values

### 3. Updated Unit Tests
**File**: `admin_root/tests/unit/refund.test.js`

- Fixed test expectations to match correct property names
- Added tests for all token types (Clinical Skills, Situational Judgment, Mini-mock)
- All 11 tests now passing

## Verification
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ No remaining references to old property names in codebase
- ✅ Refund process will now correctly update contact credit properties in HubSpot

## Impact
The refund process will now:
1. Successfully update contact credit properties in HubSpot
2. Not throw "Property does not exist" errors
3. Properly restore credits for Clinical Skills, SJ, and Mini-mock bookings