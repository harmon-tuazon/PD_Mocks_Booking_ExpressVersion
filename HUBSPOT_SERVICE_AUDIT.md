# HubSpot Service Audit - admin_root
## Audit Date: October 23, 2025

This audit identifies unused methods in `admin_root/api/_shared/hubspot.js` that can potentially be removed or marked for cleanup.

---

## ✅ ACTIVELY USED METHODS (7 methods)

These methods are currently being used by admin mock-exams endpoints and should **NOT** be removed:

| Method | Usage Location | Purpose |
|--------|---------------|---------|
| `createMockExam()` | `api/admin/mock-exams/create.js` | Create single mock exam |
| `batchCreateMockExams()` | `api/admin/mock-exams/bulk-create.js` | Create multiple mock exams |
| `listMockExams()` | `api/admin/mock-exams/list.js` | List/search mock exams with pagination |
| `updateMockExam()` | `api/admin/mock-exams/update.js` | Update mock exam properties |
| `deleteMockExam()` | `api/admin/mock-exams/delete.js` | Delete a mock exam |
| `getMockExamWithBookings()` | `api/admin/mock-exams/get.js` | Get mock exam with associated bookings |
| `calculateMetrics()` | `api/admin/mock-exams/metrics.js` | Calculate dashboard metrics |

---

## ❌ UNUSED METHODS IN ADMIN_ROOT

### Contact Management (5 methods) - **UNUSED**
These are only used in user_root for student authentication and credit management:

1. **`searchContacts(studentId, email, mockType)`** (line 114-169)
   - Searches contacts by student_id and email
   - Used for: Student login validation in user_root
   - **Recommendation:** Remove from admin_root, keep in user_root only

2. **`updateContactCredits(contactId, creditType, newValue)`** (line 374-382)
   - Updates contact credit properties
   - Used for: Deducting credits when booking in user_root
   - **Recommendation:** Remove from admin_root

3. **`restoreCredits(contactId, tokenUsed, currentCredits)`** (line 1379-1424)
   - Restores credits when booking is cancelled
   - Used for: Cancellation refunds in user_root
   - **Recommendation:** Remove from admin_root

4. **`getContactBookingAssociations(contactId)`** (line 697-734)
   - Gets all booking IDs associated with a contact
   - Used for: My Bookings page in user_root
   - **Recommendation:** Remove from admin_root

5. **`getContactBookingAssociationsPaginated(contactId, options)`** (line 745-786)
   - Paginated version of booking associations
   - Used for: My Bookings pagination in user_root
   - **Recommendation:** Remove from admin_root

---

### Enrollment Management (1 method) - **UNUSED**
Only used in user_root for student validation:

6. **`searchEnrollments(contactId, status)`** (line 485-512)
   - Searches for student enrollments
   - Used for: Validating active enrollment in user_root
   - **Recommendation:** Remove from admin_root, keep in user_root only

---

### Booking Management (10 methods) - **UNUSED IN ADMIN**
These are used in user_root for the booking flow but not needed in admin:

7. **`searchMockExams(mockType, isActive)`** (line 174-208)
   - Searches available mock exams by type
   - Used for: Student booking selection in user_root
   - **Recommendation:** Remove from admin (use `listMockExams` instead)

8. **`checkExistingBooking(bookingId)`** (line 216-240)
   - Checks if an active booking already exists
   - Used for: Duplicate booking prevention in user_root
   - **Recommendation:** Remove from admin_root

9. **`findBookingByIdempotencyKey(idempotencyKey)`** (line 247-299)
   - Finds booking by idempotency key for duplicate prevention
   - Used for: Preventing duplicate submissions in user_root
   - **Recommendation:** Remove from admin_root

10. **`createBooking(bookingData)`** (line 336-369)
    - Creates a new booking
    - Used for: Student booking creation in user_root
    - **Recommendation:** Remove from admin (admins don't create bookings)

11. **`updateBooking(bookingId, properties)`** (line 634-640)
    - Updates booking properties
    - Used for: Booking modifications in user_root
    - **Recommendation:** Remove from admin_root

12. **`softDeleteBooking(bookingId)`** (line 645-649)
    - Soft deletes booking (sets is_active to 'Cancelled')
    - Used for: User booking cancellations in user_root
    - **Recommendation:** Remove from admin_root

13. **`deleteBooking(bookingId)`** (line 1281-1283)
    - Hard deletes a booking
    - Used for: User cancellations in user_root
    - **Recommendation:** Remove from admin (admins shouldn't delete bookings directly)

14. **`getBookingWithAssociations(bookingId)`** (line 1290-1370)
    - Gets single booking with all associations
    - Used for: Booking details in user_root
    - **Recommendation:** Remove from admin_root

15. **`getBookingsForContact(contactId, options)`** (line 797-1279)
    - Gets all bookings for a contact with filtering/pagination
    - **LARGEST METHOD** (482 lines!)
    - Used for: "My Bookings" page in user_root
    - **Recommendation:** Remove from admin_root (admin doesn't view student bookings)

16. **`getBasicBooking(bookingId)`** (line 537-548)
    - Gets basic booking information
    - Used for: Quick booking lookups in user_root
    - **Recommendation:** Remove from admin_root

---

### Mock Exam Management (5 methods) - **UNUSED IN ADMIN**
These methods are for the user booking flow, not admin management:

17. **`getMockExam(mockExamId)`** (line 517-530)
    - Gets single mock exam details (simpler than getMockExamWithBookings)
    - **Note:** Admin uses `getMockExamWithBookings` instead
    - **Recommendation:** Consider removing, admin already has better method

18. **`getActiveBookingsCount(mockExamId)`** (line 554-610)
    - Counts active bookings for a mock exam
    - Used for: Capacity checking in user_root
    - **Recommendation:** Remove (admin uses `calculateMetrics` instead)

19. **`recalculateMockExamBookings(mockExamId)`** (line 616-629)
    - Recalculates total_bookings property
    - Used for: Syncing booking counts in user_root
    - **Recommendation:** Remove from admin_root

20. **`updateMockExamBookings(mockExamId, newTotal)`** (line 387-395)
    - Updates total_bookings counter
    - Used for: Incrementing/decrementing bookings in user_root
    - **Recommendation:** Remove from admin_root

21. **`decrementMockExamBookings(mockExamId)`** (line 1431-1458)
    - Decrements booking count
    - Used for: Cancellations in user_root
    - **Recommendation:** Remove from admin_root

---

### Association Management (3 methods) - **UNUSED IN ADMIN**
These are used in user_root for creating booking associations:

22. **`createAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId)`** (line 428-459)
    - Creates association between objects
    - Used for: Linking bookings to contacts/mock exams in user_root
    - **Recommendation:** Remove from admin_root

23. **`removeAssociation(fromObjectType, fromObjectId, toObjectType, toObjectId)`** (line 468-479)
    - Removes association between objects
    - Used for: Cancellations in user_root
    - **Recommendation:** Remove from admin_root

24. **`getDefaultAssociationTypeId(fromObjectType, toObjectType)`** (line 401-423)
    - Gets correct association type ID
    - Used for: Creating associations in user_root
    - **Recommendation:** Remove from admin_root

---

### Notes/Timeline Management (3 methods) - **UNUSED IN ADMIN**
These create timeline notes in user_root:

25. **`createCancellationNote(dealId, cancellationData)`** (line 1466-1501)
    - Creates cancellation note on deal timeline
    - Used for: User cancellation tracking in user_root
    - **Recommendation:** Remove from admin_root (no deals in admin)

26. **`createBookingNote(bookingData, contactId, mockExamData)`** (line 1510-1595)
    - Creates booking confirmation note on contact timeline
    - Used for: User booking confirmations in user_root
    - **Recommendation:** Remove from admin_root

27. **`createBookingCancellationNote(contactId, cancellationData)`** (line 1602-1666)
    - Creates cancellation note on contact timeline
    - Used for: User cancellation tracking in user_root
    - **Recommendation:** Remove from admin_root

---

### Helper Methods (2 methods) - **UNUSED IN ADMIN**

28. **`mapLocationToHubSpot(location)`** (line 304-331)
    - Maps frontend location values to HubSpot format
    - Used for: Location normalization in user_root bookings
    - **Recommendation:** Remove from admin_root

29. **`mapBookingStatus(booking, mockExamData, timeStatus)`** (line 669-690)
    - Maps booking status based on various properties
    - Used for: Status display in user_root My Bookings
    - **Recommendation:** Remove from admin_root

---

## 📊 SUMMARY

### Total Methods in HubSpot Service
- **Total Methods:** 36
- **Used in Admin:** 7 (19%)
- **Unused in Admin:** 29 (81%)

### Methods by Category

| Category | Total | Used | Unused |
|----------|-------|------|--------|
| Contact Management | 5 | 0 | 5 |
| Enrollment Management | 1 | 0 | 1 |
| Booking Management | 10 | 0 | 10 |
| Mock Exam Management | 12 | 7 | 5 |
| Association Management | 3 | 0 | 3 |
| Notes/Timeline | 3 | 0 | 3 |
| Helper Methods | 2 | 0 | 2 |

---

## 💡 RECOMMENDATIONS

### Option 1: Create Separate Service Files (RECOMMENDED)
Split into specialized services:

```
admin_root/api/_shared/
├── hubspot-mock-exams.js    # Only mock exam admin methods (7 methods)
├── hubspot-base.js           # Core HubSpot API wrapper
└── batch.js                  # Batch operations (already exists)
```

**Benefits:**
- Cleaner, more focused code
- Smaller file size (current: 2117 lines)
- Easier maintenance
- Clearer separation of concerns

### Option 2: Keep Current Structure but Comment Out
Add clear comments marking unused sections:

```javascript
/* ========================================
 * UNUSED IN ADMIN - ONLY FOR USER_ROOT
 * These methods can be safely removed if admin_root
 * is deployed independently from user_root
 * ======================================== */
```

### Option 3: Create Shared Base + Inheritance
```
_shared/
├── hubspot-base.js          # Core methods + API wrapper
├── hubspot-admin.js         # Extends base, admin-specific
└── hubspot-user.js          # Extends base, user-specific
```

---

## ⚠️ IMPORTANT NOTES

1. **Don't Remove from user_root:** All "unused" methods in admin ARE actively used in user_root for the student booking flow

2. **Shared File:** If admin_root and user_root share the same hubspot.js file, keep all methods

3. **Independent Deployment:** If admin_root is deployed separately, you can safely remove unused methods

4. **Code Size Impact:** Removing unused methods would reduce file from 2117 lines to approximately 800-900 lines (58% reduction)

5. **API Call Helper:** The `apiCall()` method (line 38-109) IS used by all methods and must be kept

---

## 🎯 QUICK WIN

**Immediate Action:** Remove the largest unused method:

**`getBookingsForContact()`** (lines 797-1279)
- Size: 482 lines (23% of file!)
- Complexity: Very high
- Used in: user_root only (My Bookings page)
- Impact: Would reduce file size by nearly 1/4

---

## 📝 NOTES

- This audit is specific to `admin_root/api/_shared/hubspot.js`
- Methods may still be needed in `user_root/api/_shared/hubspot.js`
- Core infrastructure (HubSpotService class, apiCall, proxy pattern) must be preserved
- All unused methods are actively used in user_root booking flow
