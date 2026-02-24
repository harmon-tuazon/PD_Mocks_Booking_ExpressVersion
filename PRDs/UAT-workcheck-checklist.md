# Work Check - User Acceptance Testing (UAT)

## Overview
This document provides step-by-step testing instructions and checklists for the Work Check feature across all three portals: **User (Trainee)**, **Admin**, and **Instructor**. Each section is self-contained so it can be handed to the relevant tester independently.

> **Pre-requisites:** A test environment with at least 1 instructor, 2 groups (each with students assigned), several work check slots (some active, some scheduled), and a few existing bookings in various statuses.

---

## Part 1: Admin Portal

**Login:** Sign in with an admin account. You should land on the admin dashboard.

### 1.1 Groups Management (`/work-check/groups`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Work Check > Groups** in the sidebar | Groups list page loads with a table of groups | |
| 2 | Verify the table shows columns: Group Name, Group ID, Cycle, Status, Students, Created | All columns visible and populated | |
| 3 | Use the **search bar** to search for a group by name | Table filters to matching results | |
| 4 | Use the **status filter** dropdown (Active / Inactive / All) | Table updates to show only groups matching selected status | |
| 5 | Click **Create Group** button | Create Group modal/form opens | |
| 6 | Fill in group details (name, cycle, time period, dates) and submit | New group appears in the table, success toast shown | |
| 7 | Click a **group name** in the table | Navigates to Group Detail page (`/work-check/groups/:id`) | |
| 8 | On Group Detail page, verify group info header (name, cycle, dates, student count) | All info displays correctly | |
| 9 | Click **Assign Student** on the Group Detail page | Student assignment modal opens | |
| 10 | Search for and assign a student | Student appears in the group's student list, success toast shown | |
| 11 | Remove a student from the group | Student removed from list, success toast shown | |
| 12 | Go back to Groups list, click **Edit** on a group | Edit modal opens pre-filled with group data | |
| 13 | Change the group name and save | Updated name reflected in table, success toast shown | |
| 14 | Test **Clone Group** action | Clone modal opens; submitting creates a duplicate group | |
| 15 | Test **pagination** (if > 50 groups) | Page controls work, showing correct count | |

### 1.2 Instructors Management (`/work-check/instructors`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Work Check > Instructors** in the sidebar | Instructors list page loads with table | |
| 2 | Verify columns: Name, Email, Status, Created, Actions | All columns visible | |
| 3 | Click **Create Instructor** button | Create modal opens | |
| 4 | Fill in instructor name, email, and submit | New instructor appears in table, success toast | |
| 5 | Click **Edit** button on an instructor row | Edit modal opens pre-filled | |
| 6 | Change the instructor's name and save | Updated name reflected in table | |
| 7 | Toggle an instructor's status (Active/Inactive) | Status badge updates accordingly | |
| 8 | Click an **instructor name** (should be a blue link) | Navigates to Instructor Detail page (`/work-check/instructors/:id`) | |
| 9 | Verify Instructor Detail page shows: back button, instructor name, analytics content | All elements render correctly | |
| 10 | Verify analytics loads: KPI cards, charts, group performance table | Data populates (may show zeros for new instructors) | |
| 11 | Test **Cycle** and **Group** filter dropdowns on analytics | Dropdowns populate with instructor's assigned groups; data updates on change | |
| 12 | Test **Date Range** presets (All Time, This Week, This Month) | KPIs and charts update accordingly | |
| 13 | Click **Reset** button (beside filters) | All filters reset to defaults | |
| 14 | Click **Refresh** button (right side, primary blue button) | Data re-fetches, spinner shows during loading | |
| 15 | Click **Back to Instructors** arrow | Returns to instructors list | |
| 16 | Test **search** by instructor name or email | Table filters correctly | |

### 1.3 Work Check Slots (`/work-check/slots`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Work Check > Slots** in the sidebar | Slots page loads with stats cards and table | |
| 2 | Verify **stats cards**: Total, Active, Scheduled, Inactive | Counts are accurate | |
| 3 | Click **Create Slot** | Create modal opens with fields: date, time, duration, instructor, group(s), location, status, available_from | |
| 4 | Create a slot with status **Active** and no scheduled activation | Slot appears in table as Active | |
| 5 | Create a slot with **Scheduled** activation (set available_from to a future date) | Slot appears with Scheduled badge | |
| 6 | Click **Edit** on an existing slot | Edit modal opens pre-filled | |
| 7 | Change the instructor assignment and save | Updated instructor reflected in table | |
| 8 | Test **filter by Instructor** dropdown | Table shows only slots for that instructor | |
| 9 | Test **filter by Group** dropdown | Table shows only slots assigned to that group | |
| 10 | Test **filter by Location** dropdown | Table filters by location | |
| 11 | Test **filter by Status** (Active / Inactive / Scheduled) | Table filters correctly | |
| 12 | Test **date range** filter | Only slots within range shown | |
| 13 | **Select multiple slots** using checkboxes | Selection toolbar appears showing count | |
| 14 | Use **Bulk Toggle Status** from toolbar | Selected slots' statuses toggle, success toast | |
| 15 | Use **Bulk Delete** from toolbar | Confirmation dialog appears; typing confirmation deletes slots | |
| 16 | Test **Clone Slots** | Clone modal opens; submitting duplicates slots to new dates | |
| 17 | Test **Bulk Edit** (change instructor/location for multiple slots) | All selected slots updated | |
| 18 | Verify a slot with active bookings **cannot be deleted** | Error message / prevention shown | |
| 19 | Test **sorting** by clicking column headers (Date, Time, Instructor, Location) | Table re-sorts correctly | |
| 20 | Test **pagination** | Page controls work correctly | |

### 1.4 Work Check Bookings (`/work-check/bookings`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Work Check > Bookings** in the sidebar | Bookings page loads with stats cards and table | |
| 2 | Verify **stats cards**: Total, Pending, Confirmed, Rejected, Cancelled | Counts accurate | |
| 3 | Test **Aggregate view** toggle (default) | Bookings grouped by date + time + location; each row shows booking count and status breakdown | |
| 4 | Expand an aggregate row | Nested bookings displayed with individual details | |
| 5 | Test **List view** toggle | Flat list of all individual bookings | |
| 6 | Click **Create Booking** | Create modal opens with student search, slot selection, type dropdown | |
| 7 | Search for a student in the create modal | Student results appear | |
| 8 | Complete booking creation (select student, slot, type) | Booking created, success toast, table updates | |
| 9 | Click **Edit** on a booking | Edit modal opens; can change status and type | |
| 10 | Change booking status (e.g., Pending -> Confirmed) | Status badge updates | |
| 11 | Change booking type (Work Check / Demo / Supervised Session) | Type updates in table | |
| 12 | **Delete** a single booking | Confirmation shown; booking removed | |
| 13 | Test **filter by Location** | Table filters correctly | |
| 14 | Test **filter by Instructor** | Table filters correctly | |
| 15 | Test **filter by Status** (Pending / Confirmed / Rejected / Cancelled) | Table filters correctly | |
| 16 | Test **filter by Type** (Work Check / Demo / Supervised Session) | Table filters correctly | |
| 17 | Test **date range** filter | Only bookings in range shown | |
| 18 | **Select multiple bookings** using checkboxes | Selection toolbar appears | |
| 19 | Use **Bulk Toggle Status** | Selected bookings' statuses toggle | |
| 20 | Use **Bulk Delete** | Confirmation required; bookings deleted | |
| 21 | Test **sorting** by column headers | Table re-sorts | |
| 22 | Test **pagination** | Page controls work | |

---

## Part 2: Instructor Portal

**Login:** Sign in with an instructor account. You should be redirected to `/instructor`.

### 2.1 Instructor Dashboard (`/instructor`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | After login, verify redirect to instructor dashboard | Dashboard loads (not admin portal) | |
| 2 | Verify **stats cards**: Active Groups, Total Trainees, Upcoming Sessions, Next Session | All cards show data or appropriate zeros | |
| 3 | Verify **Next Session** preview card shows date, time, group, location | Correct upcoming session displayed (or "No upcoming sessions") | |
| 4 | Verify **My Active Groups** summary table | Shows groups assigned to this instructor | |
| 5 | Confirm admin routes are **not accessible** (try navigating to `/mock-exams`) | Redirected back or access denied | |

### 2.2 Analytics (`/instructor/analytics`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Analytics** in the sidebar | Analytics page loads with header, filters, KPIs, and charts | |
| 2 | Verify **page header**: "My Analytics" with description | Header displayed | |
| 3 | Verify **KPI cards**: Total Sessions, Total Bookings, Attendance Rate, Cancellation Rate, No-Show Rate | All 5 cards render with values | |
| 4 | Verify **Date Range** presets: All Time, This Week, This Month | All three buttons present; All Time selected by default | |
| 5 | Click **This Week** | KPIs and all charts update to show only this week's data | |
| 6 | Click **This Month** | Data updates to current month | |
| 7 | Click **All Time** | Data reverts to full history | |
| 8 | Test **Cycle** dropdown | Populates with cycles from assigned groups; selecting filters data | |
| 9 | Test **Group** dropdown | Populates with groups for selected cycle; selecting filters data | |
| 10 | Click **Reset** button | All filters revert to defaults (All Time, no cycle/group selected) | |
| 11 | Click **Refresh** button | Data re-fetches; button shows "Refreshing..." with spinner | |
| 12 | Verify **Status Breakdown** section | Shows counts for each status (pending, confirmed, cancelled, etc.) | |
| 13 | Verify **Type Breakdown** section | Shows counts by type (Work Check, Demo, Supervised Session) | |
| 14 | Verify **Bookings Over Time** combo chart | Bars visible (blue), blue trend line with dots/labels, amber attendance line with dots/labels | |
| 15 | Verify combo chart has **grid lines**, **X-axis labels** (dates), **left Y-axis** (bookings count), **right Y-axis** (attendance %) | All axes and grid visible | |
| 16 | Verify **legend** below chart: bars, bookings trend, attendance rate | All three legend items shown | |
| 17 | Verify **Busiest Days** section | Days ranked by average bookings (bar chart) | |
| 18 | Verify **Busiest Times** section | Top 5 times shown (capped) | |
| 19 | Verify **Group Performance** table | Columns: Group, Enrolled, Bookings, Attended, Cancelled, Participation Rate, Attendance Rate | |
| 20 | Confirm data is **scoped to this instructor only** (cannot see other instructors' data) | Only this instructor's groups and bookings appear | |

---

## Part 3: User (Trainee) Portal

**Login:** Sign in with a trainee account that is assigned to at least one active group with available slots.

### 3.1 Book a Work Check (`/book/work-check`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **Book Work Check** | Booking page loads showing available slots | |
| 2 | Verify **Group filter** dropdown appears | Shows groups the trainee is enrolled in | |
| 3 | Select a specific group | Available slots filter to that group only | |
| 4 | Verify each slot card shows: **Date, Time, Instructor, Location, Group** | All details visible | |
| 5 | Verify slots that are **full** (capacity reached) are indicated or hidden | Cannot book full slots | |
| 6 | Click on an available slot to select it | Slot highlighted / selected | |
| 7 | Proceed to **confirmation step** | Confirmation screen shows booking details (date, time, instructor, group, location) | |
| 8 | Confirm the booking | Success message shown; booking created | |
| 9 | Try to **book the same slot again** (duplicate) | Error: duplicate booking prevented | |
| 10 | Try to book a slot that **conflicts with an existing mock exam booking** | Error: time conflict detected | |
| 11 | Verify the **"Book Another"** option works | Returns to slot selection | |
| 12 | Verify **"View My Bookings"** link navigates to `/my-work-checks` | Navigates correctly | |

### 3.2 My Work Checks (`/my-work-checks`)

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | Navigate to **My Work Checks** | Page loads with bookings and stats | |
| 2 | Verify **stats cards** at the top showing counts by status | Totals match actual bookings | |
| 3 | Verify **filter tabs**: All, Upcoming, Pending, Completed, Cancelled | All tabs present | |
| 4 | Click **Upcoming** tab | Only future bookings shown | |
| 5 | Click **Pending** tab | Only pending bookings shown | |
| 6 | Click **Cancelled** tab | Only cancelled bookings shown | |
| 7 | Click **All** tab | All bookings shown regardless of status | |
| 8 | Verify **table columns** (desktop): Date, Time, Instructor, Group, Location, Status | All columns visible with correct data | |
| 9 | Resize browser to mobile width | Table switches to **card view** (responsive) | |
| 10 | Cards show same info in mobile-friendly layout | All details readable | |
| 11 | Click **Cancel** on an upcoming booking | Cancellation confirmation appears | |
| 12 | Confirm cancellation with reason | Booking status changes to Cancelled, success toast | |
| 13 | Verify cancelled booking **cannot be cancelled again** | Cancel button hidden/disabled for cancelled bookings | |
| 14 | Test **Calendar view** toggle (if available) | Calendar shows dates with booking indicators | |
| 15 | Click a date with bookings on the calendar | Side panel shows booking details for that date | |
| 16 | Test **pagination** (if many bookings) | Page controls navigate correctly | |
| 17 | Verify bookings show correct **status badges**: Pending (yellow), Confirmed (green), Rejected (red), Cancelled (gray) | Colors and labels match status | |

---

## Cross-Portal Verification

These tests verify that actions in one portal reflect correctly in others.

| # | Test Step | Expected Result | Pass |
|---|-----------|-----------------|------|
| 1 | **Admin** creates a new slot and marks it Active | **User** portal shows the slot as available for booking | |
| 2 | **User** books a work check | **Admin** portal shows the new booking in Bookings page | |
| 3 | **Admin** changes booking status to Confirmed | **User** portal shows updated status on My Work Checks | |
| 4 | **Admin** changes booking status to Rejected | **User** portal shows Rejected status | |
| 5 | **User** cancels a booking | **Admin** portal shows booking as Cancelled | |
| 6 | **Admin** creates a booking on behalf of a student | **User** portal shows the booking in My Work Checks | |
| 7 | **Admin** assigns a new group to an instructor | **Instructor** portal shows the group in dashboard and analytics | |
| 8 | **Admin** creates bookings for an instructor's group | **Instructor** analytics KPIs and charts update accordingly | |
| 9 | **Admin** deactivates an instructor | Instructor cannot log in or is shown appropriate state | |
| 10 | **Admin** deletes a slot | Bookings for that slot are handled (cascade or prevention) | |
| 11 | **Admin** views instructor analytics (click instructor name) | Same data as the instructor sees in their own portal | |

---

## Notes for Testers

- **Dark Mode:** Toggle dark mode and verify all pages remain readable (text contrast, badge colors, chart colors, grid lines).
- **Empty States:** Test each page with no data (new instructor with no groups, group with no students, etc.) to verify empty state messages display correctly.
- **Loading States:** On slow connections, verify skeleton loaders appear while data is fetching.
- **Error States:** Test with invalid URLs (e.g., `/work-check/instructors/invalid-uuid`) to verify error handling and back navigation.
- **Browser Compatibility:** Test on Chrome, Firefox, and Safari.
- **Toast Notifications:** Verify success (green) and error (red) toasts appear for all create/update/delete actions.
