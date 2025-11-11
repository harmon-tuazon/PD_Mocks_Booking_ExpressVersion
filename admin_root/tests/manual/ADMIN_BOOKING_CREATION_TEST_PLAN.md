# Admin Booking Creation - Manual Test Plan

## Overview
This document describes the manual testing procedures for the admin booking creation feature. The feature allows administrators to create bookings on behalf of trainees from the mock exam details page.

## Test Environment Setup

### Prerequisites
1. Admin authentication credentials (Supabase account)
2. Access to HubSpot CRM (for verification)
3. Test contact data with valid student_id and email
4. Active mock exam sessions in HubSpot

### Environment Variables
Ensure the following are configured:
- `VITE_SUPABASE_URL` - Frontend Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Frontend Supabase anonymous key
- `SUPABASE_URL` - Backend Supabase URL
- `SUPABASE_SERVICE_KEY` - Backend Supabase service role key
- `HS_PRIVATE_APP_TOKEN` - HubSpot private app token
- `REDIS_URL` - Redis connection string (for cache invalidation)

## Test Scenarios

### Scenario 1: Create Booking for Mock Discussion (No Conditional Fields)

**Objective**: Verify basic booking creation without conditional fields

**Test Data**:
- Mock Exam: Mock Discussion (active)
- Student ID: TEST001
- Email: test001@example.com
- Expected: Booking created with no additional fields

**Steps**:
1. Login to admin frontend
2. Navigate to Mock Exams dashboard
3. Click on an active Mock Discussion exam
4. Click "Create Booking" button in bookings section header
5. Enter student_id: `TEST001`
6. Enter email: `test001@example.com`
7. Verify warning message appears about bypassing token constraints
8. Click "Create Booking"
9. Wait for success toast notification
10. Verify booking appears in the bookings table
11. Refresh the page and verify booking persists

**Expected Results**:
- ✅ Modal opens with correct fields
- ✅ Warning message is displayed
- ✅ Form validation works (required fields)
- ✅ Success toast appears after creation
- ✅ Booking appears in table immediately
- ✅ Total bookings count increments
- ✅ Booking persists after page refresh

**Verification in HubSpot**:
1. Open booking record in HubSpot
2. Verify `booking_id` format: `Mock Discussion-TEST001-[Date]`
3. Verify `token_used` = "Admin Override"
4. Verify associations: Contact + Mock Exam
5. Verify audit note with 3 associations (Contact, Mock Exam, Booking)
6. Verify mock exam `total_bookings` incremented

---

### Scenario 2: Create Booking for Clinical Skills (Dominant Hand Required)

**Objective**: Verify conditional field requirement for Clinical Skills

**Test Data**:
- Mock Exam: Clinical Skills (active)
- Student ID: TEST002
- Email: test002@example.com
- Dominant Hand: Right

**Steps**:
1. Navigate to an active Clinical Skills exam
2. Click "Create Booking" button
3. Enter student_id: `TEST002`
4. Enter email: `test002@example.com`
5. Verify "Dominant Hand" field appears
6. Select "Right-handed" button
7. Verify button highlights
8. Click "Create Booking"
9. Verify success toast
10. Check booking in table

**Expected Results**:
- ✅ Dominant hand field is visible
- ✅ Both Right/Left buttons work
- ✅ Form validation requires dominant hand selection
- ✅ Booking created with correct dominant_hand value
- ✅ Booking appears in table

**Verification in HubSpot**:
1. Verify `dominant_hand` property is set correctly
2. Verify all other fields as in Scenario 1

---

### Scenario 3: Create Booking for Situational Judgment (Location Required)

**Objective**: Verify conditional field requirement for Situational Judgment

**Test Data**:
- Mock Exam: Situational Judgment (active)
- Student ID: TEST003
- Email: test003@example.com
- Location: Mississauga

**Steps**:
1. Navigate to an active Situational Judgment exam
2. Click "Create Booking" button
3. Enter student_id: `TEST003`
4. Enter email: `test003@example.com`
5. Verify "Attending Location" dropdown appears
6. Select "Mississauga" from dropdown
7. Click "Create Booking"
8. Verify success toast
9. Check booking in table

**Expected Results**:
- ✅ Location dropdown is visible
- ✅ All location options are available
- ✅ Form validation requires location selection
- ✅ Booking created with correct location
- ✅ Booking appears in table

**Verification in HubSpot**:
1. Verify `attending_location` property is set correctly
2. Verify all other fields as in Scenario 1

---

### Scenario 4: Admin Override - Exceed Capacity

**Objective**: Verify admin can create booking beyond capacity

**Test Data**:
- Mock Exam: Any type with total_bookings >= capacity
- Student ID: OVERCAP001
- Email: overcap@example.com

**Steps**:
1. Find or create a mock exam at capacity
2. Navigate to that exam's details page
3. Click "Create Booking" button
4. Enter valid student_id and email
5. Complete conditional fields if required
6. Click "Create Booking"
7. Verify success (should not be blocked by capacity)

**Expected Results**:
- ✅ Booking creation succeeds despite capacity limit
- ✅ Warning is logged in backend (check logs)
- ✅ Success toast appears
- ✅ total_bookings exceeds capacity
- ✅ Audit note indicates admin override

---

### Scenario 5: Error Handling - Contact Not Found

**Objective**: Verify proper error handling for non-existent contact

**Test Data**:
- Student ID: NOTFOUND999
- Email: notfound@example.com

**Steps**:
1. Navigate to any active mock exam
2. Click "Create Booking" button
3. Enter non-existent student_id: `NOTFOUND999`
4. Enter email: `notfound@example.com`
5. Complete other fields
6. Click "Create Booking"
7. Wait for response

**Expected Results**:
- ❌ Error toast appears: "No contact found with student_id..."
- ✅ Modal remains open
- ✅ Form data is retained
- ✅ User can correct and retry
- ✅ No booking is created in HubSpot

---

### Scenario 6: Error Handling - Duplicate Booking

**Objective**: Verify duplicate detection works

**Test Data**:
- Use same student_id and exam_date as an existing booking

**Steps**:
1. Note an existing booking's student_id
2. Navigate to the same exam
3. Click "Create Booking" button
4. Enter the same student_id and email
5. Complete other fields
6. Click "Create Booking"
7. Wait for response

**Expected Results**:
- ❌ Error toast appears: "This trainee already has a booking..."
- ✅ Modal remains open
- ✅ No duplicate booking created
- ✅ User can change student_id and retry

---

### Scenario 7: Error Handling - Inactive Mock Exam

**Objective**: Verify button is disabled for inactive exams

**Test Data**:
- Mock Exam: Any exam with is_active = 'false'

**Steps**:
1. Navigate to an inactive mock exam
2. Observe "Create Booking" button

**Expected Results**:
- ✅ Button is disabled (grayed out)
- ✅ Tooltip shows: "Cannot create booking for inactive mock exam"
- ✅ Button cannot be clicked

---

### Scenario 8: Form Validation

**Objective**: Verify all form validation works correctly

**Test Cases**:

#### 8A: Empty Fields
1. Open modal
2. Click "Create Booking" without filling fields
3. Verify validation errors appear

**Expected**: Required field errors for student_id and email

#### 8B: Invalid Email
1. Enter student_id: `TEST004`
2. Enter invalid email: `not-an-email`
3. Click "Create Booking"

**Expected**: Email validation error

#### 8C: Invalid Student ID Format
1. Enter student_id with lowercase: `test005`
2. Enter valid email
3. Click "Create Booking"

**Expected**: Student ID format error (uppercase alphanumeric only)

#### 8D: Missing Conditional Fields
1. For Clinical Skills: Don't select dominant hand
2. Or for SJ/Mini-mock: Don't select location
3. Click "Create Booking"

**Expected**: Conditional field validation error

---

### Scenario 9: UI/UX Verification

**Objective**: Verify user interface behaves correctly

**Test Points**:

#### Modal Behavior
- ✅ Modal opens when button clicked
- ✅ Modal closes on "X" button
- ✅ Modal closes on "Cancel" button
- ✅ Modal closes on successful creation
- ✅ Modal doesn't close on error
- ✅ Form resets when modal reopens

#### Loading States
- ✅ Button shows "Creating..." during submission
- ✅ Button is disabled during submission
- ✅ Spinner appears during loading
- ✅ Form inputs are disabled during submission

#### Toast Notifications
- ✅ Success toast appears after creation
- ✅ Error toast appears on failure
- ✅ Toast auto-dismisses after 3-5 seconds
- ✅ Toast messages are clear and actionable

#### Table Refresh
- ✅ New booking appears in table immediately
- ✅ Total bookings count updates
- ✅ Booking is at the top of the list (if sorted by date)
- ✅ No page refresh needed

---

### Scenario 10: Cache Invalidation

**Objective**: Verify caches are properly invalidated

**Steps**:
1. Create a booking using the UI
2. Open browser dev tools
3. Navigate away and back to the exam details
4. Verify updated data is shown (not cached)
5. Check Redis for invalidated keys (backend logs)

**Expected Results**:
- ✅ Contact bookings cache invalidated
- ✅ Mock exam details cache invalidated
- ✅ Mock exam bookings cache invalidated
- ✅ Aggregates cache invalidated
- ✅ Fresh data shown on page reload

---

## Backend API Testing

### Using Manual Test Script

```bash
# Run pre-flight checks
node tests/manual/test-admin-booking-creation.js [mock_exam_id] [student_id] [email]

# Example
node tests/manual/test-admin-booking-creation.js 12345678 TEST001 test@example.com
```

The script will:
1. Verify mock exam exists and is active
2. Search for contact
3. Check for duplicate bookings
4. Display booking payload
5. Provide next steps for manual testing

### Using curl/Postman

```bash
# Get admin auth token first (from Supabase)
AUTH_TOKEN="your_supabase_jwt_token"

# Create booking via API
curl -X POST http://localhost:3000/api/admin/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "mock_exam_id": "12345678",
    "student_id": "TEST001",
    "email": "test@example.com",
    "mock_type": "Mock Discussion",
    "exam_date": "2025-12-15"
  }'
```

---

## HubSpot Verification Checklist

After creating a booking, verify the following in HubSpot:

### Booking Record
- [ ] Booking object created with correct properties
- [ ] `booking_id` format: `{mock_type}-{student_id}-{formatted_date}`
- [ ] `token_used` = "Admin Override"
- [ ] `name` matches contact name
- [ ] `email` matches contact email
- [ ] Conditional fields set correctly (if applicable)

### Associations
- [ ] Booking associated with Contact (Assoc Type 1289)
- [ ] Booking associated with Mock Exam (Assoc Type 1291)

### Audit Note
- [ ] Note created with "Admin Booking Created" title
- [ ] Note body contains all booking details
- [ ] Note associated with Contact (Assoc Type 1250)
- [ ] Note associated with Mock Exam (Assoc Type 1250)
- [ ] Note associated with Booking (Assoc Type 1250)

### Mock Exam Update
- [ ] `total_bookings` property incremented by 1

---

## Automated Test Execution

### Unit Tests (Validation Schema)
```bash
npm test -- tests/unit/admin-booking-validation.test.js
```

**Expected**: 46 tests passing

### Integration Tests (Backend Endpoint)
```bash
npm test -- tests/integration/admin-booking-creation.test.js
```

**Expected**: 12 tests passing

### All Admin Booking Tests
```bash
npm test -- --testNamePattern="Admin Booking"
```

**Expected**: 58 tests passing

---

## Known Limitations

1. **No Email Notification**: The current implementation does not send email notifications to trainees. This needs to be implemented separately.

2. **No Undo Functionality**: Once a booking is created, it must be cancelled through the normal cancellation flow.

3. **No Batch Creation**: Currently only supports creating one booking at a time.

4. **No CSV Import**: Cannot import multiple bookings from a CSV file.

---

## Troubleshooting

### Issue: "Contact not found" error
**Cause**: Student ID or email doesn't match any contact in HubSpot
**Solution**: Verify the contact exists and the search criteria are correct

### Issue: "Duplicate booking" error
**Cause**: A booking already exists for this trainee and exam date
**Solution**: Use a different student_id or delete the existing booking first

### Issue: "Exam not active" error
**Cause**: The mock exam's `is_active` property is set to 'false'
**Solution**: Activate the exam in HubSpot first

### Issue: Button is disabled
**Cause**: Mock exam is inactive
**Solution**: Check exam's `is_active` property in HubSpot

### Issue: Modal doesn't open
**Cause**: JavaScript error or component not loaded
**Solution**: Check browser console for errors

### Issue: Booking created but not visible
**Cause**: Cache not invalidated or UI not refreshed
**Solution**: Refresh the page manually

---

## Test Sign-Off

### Tester Information
- Name: _______________
- Date: _______________
- Environment: _______________ (Dev/Staging/Production)

### Test Results Summary
- Total Scenarios: 10
- Passed: ___/10
- Failed: ___/10
- Blocked: ___/10

### Notes/Issues Found:
```
[Add any issues or observations here]
```

### Sign-Off
- [ ] All critical scenarios passed
- [ ] All bugs documented and reported
- [ ] Feature ready for deployment

Signature: _______________ Date: _______________
