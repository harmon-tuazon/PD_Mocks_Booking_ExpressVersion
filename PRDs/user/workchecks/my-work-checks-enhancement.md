# PRD: My Work Checks Page Enhancement

## Overview

Enhance the `/my-work-checks` page to provide feature parity with `/my-bookings`, including calendar view, improved list view with sorting, rebook/reschedule functionality, and consistent UI patterns.

**PRD Version:** 1.0.0
**Created:** 2026-02-10
**Author:** Claude Opus 4.5
**Target Confidence:** 9/10
**Status:** Ready for Implementation

---

## 1. Problem Statement

The current `MyWorkChecks.jsx` page has basic functionality but lacks several features available in `MyBookings.jsx`:

### Current State (MyWorkChecks)
- Simple list view only
- Basic filter tabs (Upcoming, Pending, Completed, Cancelled)
- Stats cards
- Cancel modal
- Basic pagination
- No sorting capabilities
- No calendar view
- No rebook/reschedule after cancellation

### Target State (Feature Parity with MyBookings)
- **Dual view modes**: List view AND Calendar view toggle
- **Enhanced list view**: Sortable columns (date, instructor, group, status)
- **Desktop table view**: Full-width table with column headers
- **Mobile card view**: Compact cards optimized for mobile
- **Rebook functionality**: After cancellation, prompt to book a new work check
- **Enhanced filtering**: All, Upcoming, Pending, Completed, Cancelled
- **Improved UX**: Reschedule button for quick rebooking

---

## 2. Requirements

### 2.1 Functional Requirements

#### FR-1: View Mode Toggle
- **FR-1.1**: Add "List View" and "Calendar View" toggle buttons
- **FR-1.2**: Persist view mode preference in localStorage
- **FR-1.3**: Default to list view on first visit

#### FR-2: Calendar View
- **FR-2.1**: Display monthly calendar grid
- **FR-2.2**: Show dots/indicators on dates with work check bookings
- **FR-2.3**: Click on a date to see all bookings for that date
- **FR-2.4**: Navigate between months
- **FR-2.5**: Highlight current day
- **FR-2.6**: Show booking details in a side panel or modal when clicking a date

#### FR-3: Enhanced List View
- **FR-3.1**: Desktop table with sortable columns:
  - Date (ascending/descending)
  - Time
  - Instructor Name
  - Group
  - Location
  - Status
- **FR-3.2**: Mobile-responsive card view
- **FR-3.3**: Sort indicator arrows on column headers
- **FR-3.4**: Mobile dropdown for sort selection

#### FR-4: Rebook/Reschedule Functionality
- **FR-4.1**: "Reschedule" button on upcoming/pending bookings
- **FR-4.2**: After cancellation, show rebook prompt modal
- **FR-4.3**: Clicking "Book Another" navigates to `/book/work-check`
- **FR-4.4**: Option to dismiss the rebook prompt

#### FR-5: Enhanced Filters
- **FR-5.1**: Add "All" filter option
- **FR-5.2**: Show counts in filter buttons when available
- **FR-5.3**: Maintain filter state on page refresh (optional)

#### FR-6: Actions
- **FR-6.1**: Cancel booking (existing)
- **FR-6.2**: Reschedule booking (new - cancels and redirects to booking page)
- **FR-6.3**: Actions only available for upcoming/pending bookings

### 2.2 Non-Functional Requirements

#### NFR-1: Performance
- Calendar view should render within 200ms
- List sorting should be instant (client-side)

#### NFR-2: Accessibility
- Keyboard navigable calendar
- Screen reader compatible
- ARIA labels on interactive elements

#### NFR-3: Responsiveness
- Full functionality on mobile, tablet, and desktop
- Calendar adapts to screen size

---

## 3. Database Schema

### Existing Table: `work_check_bookings`

```sql
CREATE TABLE work_check_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES work_check_slots(id),
  student_id UUID NOT NULL,  -- References hubspot_contact_credits.id
  status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, cancelled, rejected, no_show
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT work_check_bookings_status_check CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'rejected', 'no_show')
  )
);
```

### Existing Table: `work_check_slots`

```sql
CREATE TABLE work_check_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES instructors(id),
  group_id VARCHAR(50)[],  -- Array of group IDs
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  total_slots INTEGER DEFAULT 1,
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  auto_approve BOOLEAN DEFAULT FALSE,
  available_from TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API Endpoints

### Existing Endpoints (No Changes Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/work-checks/list` | List user's work check bookings |
| DELETE | `/api/work-checks/[id]` | Cancel a work check booking |

### API Response Enhancement

The `/api/work-checks/list` endpoint already returns sufficient data. No backend changes required.

**Current Response Structure:**
```json
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_records": 5,
    "records_per_page": 10
  },
  "data": [
    {
      "booking_id": "uuid",
      "slot_id": "uuid",
      "status": "confirmed",
      "slot_date": "2026-02-15",
      "slot_time": "09:00",
      "end_time": "09:30",
      "duration_minutes": 30,
      "instructor_name": "Dr. Smith",
      "group_id": "GROUP-001",
      "group_name": "January 2026 Cohort",
      "location": "Room 101",
      "created_at": "2026-02-10T10:00:00Z",
      "confirmed_at": "2026-02-10T10:00:00Z",
      "cancelled_at": null
    }
  ]
}
```

---

## 5. Frontend Components

### 5.1 Component Structure

```
user_root/frontend/src/
├── pages/
│   └── MyWorkChecks.jsx  (ENHANCED - main page)
├── components/
│   └── work-checks/
│       ├── WorkCheckCalendarView.jsx  (NEW)
│       ├── WorkCheckBookingCard.jsx   (NEW - mobile card)
│       └── WorkCheckRebookModal.jsx   (NEW)
```

### 5.2 Component Specifications

#### MyWorkChecks.jsx (Enhanced)

**New State Variables:**
```javascript
const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
const [sortField, setSortField] = useState(null);
const [sortDirection, setSortDirection] = useState('asc');
const [rebookModalOpen, setRebookModalOpen] = useState(false);
const [cancelledBooking, setCancelledBooking] = useState(null);
```

**New Features:**
1. View mode toggle (List/Calendar)
2. Sorting controls
3. Desktop table view
4. Rebook modal after cancellation

#### WorkCheckCalendarView.jsx (New)

**Props:**
```typescript
interface WorkCheckCalendarViewProps {
  bookings: WorkCheckBooking[];
  onCancelBooking: (booking: WorkCheckBooking) => void;
  onRescheduleBooking: (booking: WorkCheckBooking) => void;
  isLoading: boolean;
  error: string | null;
}
```

**Features:**
- Monthly calendar grid
- Date indicators for bookings
- Date selection to view bookings
- Month navigation
- Booking details panel

#### WorkCheckRebookModal.jsx (New)

**Props:**
```typescript
interface WorkCheckRebookModalProps {
  isOpen: boolean;
  booking: WorkCheckBooking | null;
  onClose: () => void;
  onRebook: () => void;
}
```

---

## 6. UI/UX Specifications

### 6.1 View Toggle Design

```
+------------------------------------------+
|  [List View]  [Calendar View]            |
+------------------------------------------+
```

- Active view has primary background color
- Inactive view has light gray background
- Icons: List icon, Calendar icon

### 6.2 Desktop Table Layout

```
+----------+----------+------------+--------+----------+--------+---------+
| Date     | Time     | Instructor | Group  | Location | Status | Actions |
+----------+----------+------------+--------+----------+--------+---------+
| Mon,     | 9:00 AM  | Dr. Smith  | Jan    | Room 101 | [Conf] | [Rsch]  |
| Feb 15   | - 9:30   |            | 2026   |          |        | [Canc]  |
+----------+----------+------------+--------+----------+--------+---------+
```

### 6.3 Calendar View Layout

```
+------------------------------------------+
|     <  February 2026  >                   |
+------------------------------------------+
| Sun | Mon | Tue | Wed | Thu | Fri | Sat  |
+-----+-----+-----+-----+-----+-----+------+
|     |     |     |     |     |     |   1  |
|     |     |     |     |     |     |      |
+-----+-----+-----+-----+-----+-----+------+
|  2  |  3  |  4  |  5  |  6  |  7  |   8  |
|     |     |     | [*] |     |     |      |
+-----+-----+-----+-----+-----+-----+------+
```

`[*]` = Date has booking(s)

### 6.4 Rebook Modal

```
+------------------------------------------+
|  Work Check Cancelled                    |
|                                          |
|  Your work check for Feb 15, 2026        |
|  has been cancelled.                     |
|                                          |
|  Would you like to book another          |
|  work check session?                     |
|                                          |
|  [Book Another]      [Maybe Later]       |
+------------------------------------------+
```

### 6.5 Status Badge Colors

| Status | Light Mode | Dark Mode |
|--------|------------|-----------|
| Confirmed | `bg-green-100 text-green-800` | `bg-green-900/30 text-green-300` |
| Pending | `bg-amber-100 text-amber-800` | `bg-amber-900/30 text-amber-300` |
| Cancelled | `bg-gray-100 text-gray-800` | `bg-gray-700 text-gray-300` |
| Completed | `bg-blue-100 text-blue-800` | `bg-blue-900/30 text-blue-300` |
| No Show | `bg-red-100 text-red-800` | `bg-red-900/30 text-red-300` |

---

## 7. Implementation Plan

### Phase 1: Enhanced List View (2-3 hours)

1. **Add view toggle UI** (30 min)
   - Add List/Calendar toggle buttons
   - Wire up state management

2. **Desktop table view** (1 hour)
   - Create sortable table headers
   - Implement sorting logic
   - Add Reschedule button

3. **Mobile card enhancement** (30 min)
   - Add Reschedule button to cards
   - Add sort dropdown for mobile

4. **Add "All" filter** (15 min)

### Phase 2: Rebook Functionality (1-2 hours)

1. **Create WorkCheckRebookModal** (45 min)
   - Modal UI
   - Navigation to booking page

2. **Integrate with cancel flow** (30 min)
   - Show modal after successful cancellation
   - Store cancelled booking for reference

3. **Reschedule button logic** (30 min)
   - Cancel + redirect to booking page

### Phase 3: Calendar View (3-4 hours)

1. **Create WorkCheckCalendarView component** (2 hours)
   - Monthly grid layout
   - Date navigation
   - Booking indicators

2. **Date selection panel** (1 hour)
   - Show bookings for selected date
   - Action buttons

3. **Integration with main page** (30 min)
   - Wire up calendar view
   - Pass props correctly

### Phase 4: Testing & Polish (1 hour)

1. **Test all interactions**
2. **Responsive testing**
3. **Dark mode verification**
4. **Edge cases (no bookings, errors)**

---

## 8. File Changes Summary

### New Files
| File | Description |
|------|-------------|
| `components/work-checks/WorkCheckCalendarView.jsx` | Calendar view component |
| `components/work-checks/WorkCheckRebookModal.jsx` | Rebook prompt modal |

### Modified Files
| File | Changes |
|------|---------|
| `pages/MyWorkChecks.jsx` | Add view toggle, sorting, table view, rebook modal integration |

### No Changes Required
| File | Reason |
|------|--------|
| `api/work-checks/list.js` | Already returns all needed data |
| `api/work-checks/[id].js` | Cancel endpoint already complete |
| `services/api.js` | Work check methods already exist |

---

## 9. Testing Checklist

### Functional Tests
- [ ] View toggle switches between List and Calendar
- [ ] List view displays all bookings correctly
- [ ] Calendar view shows booking indicators on correct dates
- [ ] Clicking calendar date shows bookings for that date
- [ ] Sorting works on all columns
- [ ] Mobile sort dropdown works
- [ ] Cancel booking shows rebook modal
- [ ] Rebook button navigates to booking page
- [ ] Reschedule cancels and redirects
- [ ] All filters work correctly
- [ ] Pagination works in both views
- [ ] Stats cards show correct counts

### Edge Cases
- [ ] No bookings state
- [ ] API error handling
- [ ] Loading states
- [ ] Single booking
- [ ] Many bookings (pagination)

### Responsive Tests
- [ ] Mobile (320px - 480px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (1024px+)

### Dark Mode
- [ ] All components render correctly in dark mode
- [ ] Status badges have proper contrast

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Feature Parity | 100% of MyBookings features (excluding tokens) |
| Page Load Time | < 1 second |
| Calendar Render | < 200ms |
| User Adoption | Track calendar vs list view usage |

---

## 11. Dependencies

### External Dependencies
- None (all features use existing patterns from MyBookings)

### Internal Dependencies
- Existing `work_check_bookings` table
- Existing `work_check_slots` table
- Existing `/api/work-checks/*` endpoints
- Existing `apiService.workChecks` methods

---

## 12. Rollback Plan

Since this is a frontend-only enhancement:
1. Revert MyWorkChecks.jsx to previous version
2. Remove new component files
3. Deploy previous version

No database migrations required.

---

## 13. Future Enhancements (Out of Scope)

- Email notifications for work check reminders
- Export bookings to calendar (ICS file)
- Instructor feedback/notes view
- Group-based filtering
- Date range picker filter

---

## Appendix A: Existing Code Reference

### MyBookings Features to Replicate

1. **View Toggle** - Lines 904-936 in MyBookings.jsx
2. **Filters** - Lines 939-980
3. **Desktop Table** - Lines 1111-1243
4. **Mobile Cards** - Lines 1246-1257
5. **Calendar View** - BookingsCalendarView component
6. **Rebook Modal** - RebookPromptModal component
7. **Sorting** - Lines 496-567

### Current MyWorkChecks Structure

```javascript
// State
const [viewMode, setViewMode] = useState('list'); // TO ADD
const [sortField, setSortField] = useState(null); // TO ADD
const [sortDirection, setSortDirection] = useState('asc'); // TO ADD
const [rebookModalOpen, setRebookModalOpen] = useState(false); // TO ADD

// Functions to add
const handleSort = (field) => {...}
const handleReschedule = (booking) => {...}
const handleRebook = () => {...}
```

---

## Appendix B: API Service Reference

**Existing methods in `services/api.js`:**

```javascript
workChecks: {
  getGroups: (studentId, email) => {...},
  getAvailable: (studentId, email, options) => {...},
  create: (studentId, email, slotId) => {...},
  list: (studentId, email, options) => {...},
  cancel: (bookingId, studentId, email, reason) => {...}
}
```

All required API methods already exist. No changes needed.
