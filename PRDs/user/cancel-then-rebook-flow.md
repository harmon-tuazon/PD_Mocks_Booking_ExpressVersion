# PRD: Cancel-Then-Rebook Modal Flow

**Feature Type**: User Experience Enhancement
**Priority**: Medium
**Estimated Effort**: 2-3 hours
**Confidence Score**: 9/10

---

## 1. Executive Summary

After a user successfully cancels a booking from the "My Bookings" page, present them with an optional secondary modal asking if they'd like to rebook for a new timeslot. If they choose to rebook, navigate them directly to the exam selection page with the exam type pre-filled (where possible) to minimize backend calls and streamline the rebooking experience.

---

## 2. Problem Statement

### Current State
- Users cancel bookings via the My Bookings page
- After cancellation, users see only a confirmation message
- If users want to rebook, they must:
  1. Navigate back to the booking flow manually
  2. Re-select their exam type
  3. Browse available sessions again

### Pain Points
- Extra navigation friction for users who want to immediately rebook
- Lost opportunity to retain user engagement after cancellation
- No guidance on next steps after cancellation

### Desired State
- Seamless transition from cancellation to rebooking
- Reduce user friction by pre-filling exam type information
- Increase rebooking conversion rates

---

## 3. Success Criteria

### Functional Requirements
✅ **MUST HAVE**:
1. Secondary modal appears AFTER the cancellation confirmation modal closes
2. Modal asks: "Would you like to book a new timeslot?"
3. "Yes" button navigates to `/book/exams?type=[type]` with exam type pre-filled
4. "No" or close button simply dismisses the modal
5. Exam type is extracted from the cancelled booking without additional backend calls
6. Modal is accessible (keyboard navigation, ARIA labels)

✅ **SHOULD HAVE**:
1. Modal animation/transition matches existing DeleteBookingModal style
2. Proper focus management (trap focus in modal)
3. ESC key closes the modal
4. Backdrop click closes the modal

❌ **WON'T HAVE** (Out of Scope):
- Backend API changes (all data should come from existing booking object)
- Credit balance validation in the modal (handled by booking flow)
- Direct navigation to specific exam sessions (only to exam list with filter)

### Performance Requirements
- Modal appears within 200ms of cancellation modal closing
- Navigation to booking page is immediate
- Zero additional backend API calls required

### User Experience Requirements
- Modal is visually consistent with existing modal design patterns
- Clear call-to-action buttons
- Non-intrusive (users can easily decline)
- Mobile-responsive design

---

## 4. Technical Architecture

### Component Structure

```
MyBookings.jsx (existing)
├── DeleteBookingModal (existing)
│   └── Triggers onConfirm after successful cancellation
│
└── RebookPromptModal (NEW)
    ├── Opens after DeleteBookingModal closes
    ├── Receives booking data (mock_type)
    └── Navigates to /book/exams?type=[type]
```

### Data Flow

```
1. User clicks "Cancel Booking"
   → DeleteBookingModal opens with booking data

2. User confirms cancellation
   → handleConfirmDelete() called
   → API DELETE /api/bookings/[id] succeeds
   → DeleteBookingModal closes

3. TRIGGER: After DeleteBookingModal closes (NEW)
   → RebookPromptModal opens with booking.mock_type
   → User sees "Would you like to book a new timeslot?"

4a. User clicks "Yes, Rebook"
   → Extract mock_type from cancelled booking
   → Navigate to `/book/exams?type=${encodeURIComponent(mockType)}`

4b. User clicks "No, Thanks" or closes modal
   → RebookPromptModal closes
   → User remains on My Bookings page
```

### Mock Type Mapping

**Exam Types** (from existing codebase):
- `"Situational Judgment"` → `/book/exams?type=Situational%20Judgment`
- `"Clinical Skills"` → `/book/exams?type=Clinical%20Skills`
- `"Mini-mock"` → `/book/exams?type=Mini-mock`
- `"Mock Discussion"` → `/book/discussions` (special case - different route)

**Fallback Handling**:
- If `booking.mock_type` is missing or invalid → navigate to `/book/exam-types` (start from beginning)

### State Management

```javascript
// Add to MyBookings.jsx state
const [rebookModalOpen, setRebookModalOpen] = useState(false);
const [cancelledBooking, setCancelledBooking] = useState(null);
```

### Integration Points

**Modified File**: `user_root/frontend/src/components/MyBookings.jsx`
- **Line ~239**: After `fetchBookings()` completes in `handleConfirmDelete()`
- Add logic to store cancelled booking data and open rebook modal

**New File**: `user_root/frontend/src/components/shared/RebookPromptModal.jsx`
- Reusable modal component
- Accepts booking data as prop
- Handles navigation with query parameters

**Modified File**: `user_root/frontend/src/components/ExamSessionsList.jsx`
- Already supports `?type=` query parameter (VERIFY)
- Should pre-filter exam sessions by type if query param exists

---

## 5. Implementation Plan

### Phase 1: Create RebookPromptModal Component (45 min)

**File**: `user_root/frontend/src/components/shared/RebookPromptModal.jsx`

**Component Specifications**:
```javascript
RebookPromptModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  booking: PropTypes.shape({
    mock_type: PropTypes.string,
    booking_id: PropTypes.string,
    exam_date: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onRebook: PropTypes.func.isRequired  // Called with mockType
};
```

**Features**:
- Modal backdrop with blur effect (matching DeleteBookingModal style)
- Centered modal panel with rounded corners
- Header: "Rebook for a New Time?"
- Body: Display cancelled exam type and offer to rebook
- Footer: Two buttons
  - Primary (green): "Yes, Find New Time" → calls onRebook
  - Secondary (gray): "No, Thanks" → calls onClose
- Keyboard accessibility: ESC closes, Tab/Shift+Tab navigation
- Focus trap when open
- Prevent body scroll when modal is open

**Design Mockup** (matches existing modal pattern):
```
┌─────────────────────────────────────────────┐
│  🔄  Rebook for a New Time?                 │
├─────────────────────────────────────────────┤
│                                             │
│  You've cancelled your [Exam Type] booking  │
│  for [Date].                                │
│                                             │
│  Would you like to book a new timeslot?     │
│                                             │
├─────────────────────────────────────────────┤
│           [No, Thanks]  [Yes, Find New Time]│
└─────────────────────────────────────────────┘
```

### Phase 2: Integrate with MyBookings.jsx (30 min)

**Changes to MyBookings.jsx** (lines 49-52, 236-248):

1. **Add new state variables** (after line 52):
```javascript
const [rebookModalOpen, setRebookModalOpen] = useState(false);
const [cancelledBooking, setCancelledBooking] = useState(null);
```

2. **Update handleConfirmDelete** (line 191-249):
```javascript
// After successful cancellation and modal close (line 235)
// Store cancelled booking data for rebook prompt
setCancelledBooking(bookingToDelete);

// Close delete modal
setDeleteModalOpen(false);
setBookingToDelete(null);

// Force refresh bookings
await fetchBookings(userSession.studentId, userSession.email, currentPage, true);

// OPEN REBOOK MODAL (NEW)
setRebookModalOpen(true);
```

3. **Add handleRebook function** (new):
```javascript
const handleRebook = (mockType) => {
  // Close rebook modal
  setRebookModalOpen(false);
  setCancelledBooking(null);

  // Navigate to booking flow with type pre-filled
  if (mockType === 'Mock Discussion') {
    navigate('/book/discussions');
  } else if (mockType) {
    navigate(`/book/exams?type=${encodeURIComponent(mockType)}`);
  } else {
    // Fallback: start from exam type selection
    navigate('/book/exam-types');
  }
};
```

4. **Add handleCloseRebookModal function** (new):
```javascript
const handleCloseRebookModal = () => {
  setRebookModalOpen(false);
  setCancelledBooking(null);
};
```

5. **Render RebookPromptModal** (after DeleteBookingModal at line 1206):
```javascript
<RebookPromptModal
  isOpen={rebookModalOpen}
  booking={cancelledBooking}
  onClose={handleCloseRebookModal}
  onRebook={handleRebook}
/>
```

### Phase 3: Verify ExamSessionsList Query Parameter Handling (15 min)

**File**: `user_root/frontend/src/components/ExamSessionsList.jsx`

**Verify/Add**:
1. Check if component already reads `?type=` query parameter from URL
2. If missing, add:
```javascript
import { useSearchParams } from 'react-router-dom';

const [searchParams] = useSearchParams();
const typeFilter = searchParams.get('type');

// Use typeFilter to pre-select exam type filter
useEffect(() => {
  if (typeFilter) {
    setSelectedType(typeFilter);
  }
}, [typeFilter]);
```

### Phase 4: Testing & Edge Cases (30 min)

**Test Cases**:

1. **Happy Path**:
   - Cancel SJ booking → See rebook modal → Click "Yes" → Navigate to `/book/exams?type=Situational Judgment`
   - Cancel CS booking → See rebook modal → Click "Yes" → Navigate to `/book/exams?type=Clinical Skills`
   - Cancel Mini-mock booking → See rebook modal → Click "Yes" → Navigate to `/book/exams?type=Mini-mock`
   - Cancel Mock Discussion → See rebook modal → Click "Yes" → Navigate to `/book/discussions`

2. **Decline Path**:
   - Cancel booking → See rebook modal → Click "No, Thanks" → Stay on My Bookings page
   - Cancel booking → See rebook modal → Press ESC → Stay on My Bookings page
   - Cancel booking → See rebook modal → Click backdrop → Stay on My Bookings page

3. **Edge Cases**:
   - Cancel booking with missing `mock_type` → Navigate to `/book/exam-types`
   - Cancel booking while offline → Cancellation fails, no rebook modal appears
   - Cancel booking → Open rebook modal → Navigation should work even with special characters in exam type

4. **Accessibility**:
   - Tab navigation cycles through modal buttons
   - ESC key closes modal
   - Screen reader announces modal content
   - Focus returns to My Bookings page after modal closes

5. **Mobile**:
   - Modal is responsive on small screens
   - Buttons are touch-friendly
   - No layout overflow issues

---

## 6. API & Backend Requirements

### ZERO Backend Changes Required ✅

**Rationale**:
- All required data (`mock_type`) is already available in the booking object
- No additional validation needed (booking flow handles credit checks)
- Navigation only requires client-side routing
- ExamSessionsList already filters by type (or will with minor frontend change)

---

## 7. UI/UX Specifications

### Modal Styling (matches DeleteBookingModal pattern)

```css
Modal Container:
- z-index: 50
- Backdrop: bg-gray-500 bg-opacity-20 backdrop-blur-sm
- Centered: flex items-center justify-center min-h-screen

Modal Panel:
- max-width: 28rem (sm:max-w-sm)
- background: white (dark:bg-dark-card)
- border-radius: 0.5rem (rounded-lg)
- box-shadow: shadow-xl

Header Icon:
- bg-primary-100 (light blue background)
- FiRefreshCw icon (recycle/rebook icon)
- Size: h-12 w-12

Buttons:
- Primary (Yes): bg-primary-600 hover:bg-primary-700 text-white
- Secondary (No): bg-white hover:bg-gray-50 border-gray-300 text-gray-700
```

### Accessibility Features

```html
<div role="dialog" aria-modal="true" aria-labelledby="rebook-modal-title">
  <h3 id="rebook-modal-title">Rebook for a New Time?</h3>
  <!-- Content -->
  <button aria-label="Close rebook modal">No, Thanks</button>
  <button aria-label="Find new timeslot">Yes, Find New Time</button>
</div>
```

### Animation/Transitions

- Modal fade-in: 200ms ease-out
- Backdrop fade-in: 200ms ease-out
- Button hover: 150ms ease-in-out
- Focus ring: 2px offset, primary-500 color

---

## 8. Error Handling

### Potential Issues & Mitigations

| Issue | Mitigation |
|-------|-----------|
| Missing `mock_type` in booking | Fallback to `/book/exam-types` route |
| Navigation fails | Log error, close modal gracefully |
| Modal state conflict | Ensure only one modal open at a time |
| Memory leak from unclosed modal | useEffect cleanup on unmount |

---

## 9. Security & Validation

### Security Considerations

✅ **Safe Operations**:
- Client-side navigation only (no data submission)
- URL encoding prevents injection attacks
- No additional API calls = no additional security surface

✅ **Input Validation**:
- `mock_type` is already sanitized from HubSpot response
- URL encoding handles special characters
- Navigation uses React Router (XSS-safe)

---

## 10. Testing Strategy

### Unit Tests (Optional but Recommended)

**File**: `user_root/frontend/src/components/shared/__tests__/RebookPromptModal.test.jsx`

```javascript
describe('RebookPromptModal', () => {
  test('renders when isOpen is true', () => { /* ... */ });
  test('calls onClose when "No, Thanks" clicked', () => { /* ... */ });
  test('calls onRebook with mock_type when "Yes" clicked', () => { /* ... */ });
  test('closes on ESC key press', () => { /* ... */ });
  test('closes on backdrop click', () => { /* ... */ });
  test('handles missing mock_type gracefully', () => { /* ... */ });
});
```

### Integration Tests

1. **Manual Testing Checklist** (required):
   - [ ] Cancel SJ booking → Rebook modal appears
   - [ ] Click "Yes" → Navigate to exam list with SJ filter
   - [ ] Cancel CS booking → Click "No" → Stay on My Bookings
   - [ ] Cancel Mock Discussion → Navigate to discussions page
   - [ ] Test on mobile viewport
   - [ ] Test with keyboard only (Tab/Shift+Tab/Enter/ESC)
   - [ ] Test with screen reader

---

## 11. Rollout Plan

### Deployment Strategy

**Phase 1: Development** (1 day)
- Implement RebookPromptModal component
- Integrate with MyBookings.jsx
- Local testing

**Phase 2: Staging** (0.5 day)
- Deploy to Vercel preview
- QA testing
- Mobile responsiveness check

**Phase 3: Production** (0.5 day)
- Deploy to production via Vercel
- Monitor error logs
- Gather user feedback

### Rollback Plan

If issues arise:
1. Remove RebookPromptModal from MyBookings.jsx
2. Revert to showing only DeleteBookingModal
3. No backend changes to rollback (frontend-only feature)

---

## 12. Metrics & Success Measurement

### Key Metrics to Track

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Rebook modal shown | 100% of cancellations | Log when modal opens |
| Rebook acceptance rate | >30% | Track "Yes" clicks vs "No" clicks |
| Time to rebook | <60 seconds | Track time from cancellation to new booking |
| Bounce rate after cancel | <50% | Track users who leave after cancellation |

### Analytics Events (Optional)

```javascript
// Track modal shown
analytics.track('Rebook Modal Shown', {
  booking_id: booking.booking_id,
  mock_type: booking.mock_type
});

// Track user choice
analytics.track('Rebook Decision', {
  decision: 'accepted', // or 'declined'
  mock_type: booking.mock_type
});
```

---

## 13. Documentation Requirements

### User-Facing Documentation

**None required** - Feature is self-explanatory through UI

### Developer Documentation

**Update Files**:
1. `user_root/frontend/README.md` - Add section on booking cancellation flow
2. `documentation/frontend/COMPONENTS.md` - Document RebookPromptModal component
3. Code comments in MyBookings.jsx explaining the two-modal flow

---

## 14. Dependencies & Prerequisites

### Dependencies
- ✅ React Router (already in use)
- ✅ react-icons (already in use for FiRefreshCw)
- ✅ PropTypes (already in use)
- ✅ Existing modal styling patterns

### Prerequisites
- ✅ MyBookings.jsx must successfully delete bookings (already working)
- ✅ ExamSessionsList.jsx should support `?type=` filtering (verify)
- ✅ Navigation flow must be tested (already working)

---

## 15. Open Questions & Risks

### Open Questions

1. **Q**: Should we track rebook conversion rates in analytics?
   - **A**: Optional - Add analytics events if product team wants tracking

2. **Q**: Should the modal show the specific date that was cancelled?
   - **A**: Yes - Helps provide context to the user (include in modal body)

3. **Q**: What happens if user has insufficient credits after cancellation?
   - **A**: Let booking flow handle credit validation (out of scope for this modal)

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users find modal annoying | Medium | Low | Non-intrusive design, easy to dismiss |
| Modal doesn't open reliably | High | Low | Thorough testing of modal state management |
| Navigation breaks existing flow | High | Very Low | Use existing navigation patterns |
| Mobile usability issues | Medium | Low | Responsive design testing |

---

## 16. Future Enhancements (Out of Scope)

These features are explicitly **NOT** included in this PRD:

- ❌ Direct rebooking to a specific date (requires complex state management)
- ❌ Showing available slots within the modal (requires API calls)
- ❌ "Rebook same timeslot" option (may not be available)
- ❌ Email notifications about rebooking options
- ❌ Analytics dashboard for rebook conversion rates
- ❌ A/B testing different modal copy

---

## 17. Approval & Sign-off

### Stakeholders

- **Product Owner**: [Name]
- **Engineering Lead**: [Name]
- **UX Designer**: [Name]

### Approval Checklist

- [ ] PRD reviewed by product team
- [ ] Technical feasibility confirmed
- [ ] UX/UI mockups approved
- [ ] Security review passed (N/A - frontend only)
- [ ] Accessibility requirements validated

---

## 18. Implementation Code Examples

### RebookPromptModal.jsx (Complete Component)

```javascript
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiRefreshCw, FiX } from 'react-icons/fi';

const RebookPromptModal = ({ isOpen, booking, onClose, onRebook }) => {
  const modalRef = useRef(null);
  const yesButtonRef = useRef(null);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Set focus to primary button when modal opens
      setTimeout(() => {
        yesButtonRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen || !booking) return null;

  const examType = booking.mock_type || 'Mock Exam';
  const examDate = booking.exam_date || booking.examDate;

  const handleYesClick = () => {
    onRebook(booking.mock_type);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="rebook-modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay with backdrop blur */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-20 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        {/* Center alignment trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div
          ref={modalRef}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full"
        >
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                <FiRefreshCw className="h-6 w-6 text-primary-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="rebook-modal-title">
                  Rebook for a New Time?
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    You've cancelled your <span className="font-semibold">{examType}</span> booking
                    {examDate && <> for <span className="font-semibold">{formatDate(examDate)}</span></>}.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Would you like to book a new timeslot?
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                type="button"
                className="hidden sm:block absolute top-3 right-3 bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={onClose}
                aria-label="Close rebook modal"
              >
                <span className="sr-only">Close</span>
                <FiX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
            <button
              type="button"
              ref={yesButtonRef}
              onClick={handleYesClick}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:text-sm transition-colors duration-200"
            >
              Yes, Find New Time
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full sm:mt-0 sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:text-sm transition-colors duration-200"
            >
              No, Thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

RebookPromptModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  booking: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    booking_id: PropTypes.string,
    mock_type: PropTypes.string,
    exam_date: PropTypes.string,
    examDate: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onRebook: PropTypes.func.isRequired
};

RebookPromptModal.defaultProps = {
  booking: null
};

export default RebookPromptModal;
```

---

## 19. Confidence Score Breakdown

**Overall Confidence: 9/10**

### Score Justification

| Aspect | Score | Reasoning |
|--------|-------|-----------|
| Technical Feasibility | 10/10 | Simple frontend-only change, no backend required |
| UX Design | 9/10 | Clear user benefit, non-intrusive, follows existing patterns |
| Implementation Complexity | 10/10 | Low complexity - reuse existing modal patterns |
| Testing Requirements | 8/10 | Straightforward testing, well-defined test cases |
| Risk Assessment | 9/10 | Very low risk - isolated frontend feature |
| Dependencies | 10/10 | Zero external dependencies needed |
| Time Estimate | 9/10 | Realistic 2-3 hour estimate with buffer |

### Why Not 10/10?

- Minor uncertainty about ExamSessionsList's current query parameter handling (needs verification)
- User acceptance unknown (may prefer direct approach vs modal)

---

## 20. Next Steps After Approval

1. **Create Git branch**: `feature/cancel-then-rebook-modal`
2. **Implement RebookPromptModal component** (45 min)
3. **Update MyBookings.jsx** (30 min)
4. **Verify/Update ExamSessionsList.jsx** (15 min)
5. **Test on local dev** (30 min)
6. **Deploy to Vercel preview** (5 min)
7. **QA testing** (20 min)
8. **Create pull request** with screenshots
9. **Deploy to production** after approval

**Total Estimated Time**: 2-3 hours (including testing)

---

**PRD Version**: 1.0
**Created**: 2025-11-27
**Author**: Claude Code (AI Assistant)
**Status**: Draft - Awaiting Review
