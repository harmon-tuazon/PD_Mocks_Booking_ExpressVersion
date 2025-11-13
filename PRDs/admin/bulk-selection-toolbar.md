# PRD: Mock Exams Dashboard Bulk Selection & Toolbar

**Feature Name:** Mock Exams Bulk Selection Toolbar
**Version:** 1.0
**Date:** November 13, 2025
**Status:** Draft
**Confidence Score:** 8/10

---

## 1. Executive Summary

### Problem Statement
Admins need to perform bulk operations on mock exam sessions (e.g., bulk delete, bulk edit status, bulk reschedule) but currently must interact with sessions one at a time. This is inefficient when managing large numbers of mock exam sessions.

### Proposed Solution
Implement a selection mode for mock exam sessions in the dashboard where:
- Clicking anywhere on a session card (except the "View" button) enters selection mode
- The filter bar is replaced with a toolbar when in selection mode
- Selected sessions are visually highlighted
- The toolbar displays selection count and will contain bulk action buttons (initially empty, to be populated in future phases)

### Success Metrics
- Users can select/deselect mock exam sessions with a single click
- Visual feedback clearly indicates selection state
- Filter bar smoothly transitions to toolbar when entering selection mode
- No performance degradation with large numbers of sessions selected

---

## 2. User Stories

### US-1: Basic Selection
**As an** admin user
**I want to** click on a mock exam session card to select it
**So that** I can prepare to perform bulk operations on multiple sessions

**Acceptance Criteria:**
- Clicking anywhere on a session card (excluding View button) selects the session
- Selected sessions display a visual indicator (border highlight, background color)
- Clicking a selected session deselects it
- Selection works in both List View and Aggregate/Group View

### US-2: Toolbar Display
**As an** admin user
**I want to** see a toolbar replace the filter bar when I select sessions
**So that** I can access bulk operation controls

**Acceptance Criteria:**
- Filter bar is hidden when at least one session is selected
- Toolbar appears in place of filter bar, showing:
  - Selection count (e.g., "3 sessions selected")
  - "Clear Selection" button
  - "Exit Selection Mode" button
- Toolbar uses appropriate styling consistent with the app theme

### US-3: Exit Selection Mode
**As an** admin user
**I want to** exit selection mode and return to normal browsing
**So that** I can continue filtering and viewing sessions normally

**Acceptance Criteria:**
- "Exit Selection Mode" button clears all selections and returns to filter bar
- Clicking ESC key exits selection mode
- Clearing all selections automatically exits selection mode
- Filter state is preserved when exiting selection mode

---

## 3. Technical Requirements

### 3.1 State Management

**New Hook: `useBulkSelection`**
```javascript
// Pattern similar to useBatchCancellation
const useBulkSelection = (sessions = []) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState(new Set());

  return {
    isSelectionMode,
    selectedCount,
    selectedSessions,
    toggleMode,
    toggleSelection,
    selectAll,
    clearAll,
    isSelected,
    exitToView
  };
};
```

**Location:** `admin_root/admin_frontend/src/hooks/useBulkSelection.js`

### 3.2 Component Architecture

#### New Component: `MockExamsSelectionToolbar`
**Purpose:** Replace filter bar when in selection mode
**Location:** `admin_root/admin_frontend/src/components/admin/MockExamsSelectionToolbar.jsx`

**Props:**
```javascript
{
  selectedCount: number,
  totalCount: number,
  onClearAll: () => void,
  onExitMode: () => void,
  isSubmitting: boolean // For future bulk operations
}
```

**UI Elements:**
- Selection count badge (e.g., "3 of 24 sessions selected")
- Clear Selection button (secondary styling)
- Exit Selection Mode button (secondary styling)
- Placeholder area for future bulk action buttons (initially empty)

#### Modified Component: `MockExamsDashboard`
**Changes:**
- Import and initialize `useBulkSelection` hook
- Conditionally render `FilterBar` or `MockExamsSelectionToolbar`
- Pass selection state to `MockExamsTable`

#### Modified Component: `SessionRow` & `AggregateRow`
**Changes:**
- Accept `isSelectionMode` and `isSelected` props
- Apply visual styling when selected
- Handle click events to toggle selection (excluding View button)
- Add click prevention for View button when in selection mode

### 3.3 Visual Design

#### Selection State Styling
```css
/* Selected session card */
.session-selected {
  border: 2px solid rgb(var(--color-primary-600));
  background-color: rgb(var(--color-primary-50));
  dark:border-color: rgb(var(--color-primary-400));
  dark:background-color: rgba(var(--color-primary-900), 0.2);
}

/* Hover state in selection mode */
.session-hoverable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.session-hoverable:hover {
  border-color: rgb(var(--color-primary-400));
  dark:border-color: rgb(var(--color-primary-500));
}
```

#### Toolbar Design
- Height: 64px (same as FilterBar for smooth transition)
- Background: White (dark mode: dark-card)
- Shadow: Same as FilterBar
- Padding: Same as FilterBar for visual consistency
- Border radius: 8px

### 3.4 Interaction Patterns

#### Click Behavior
```
Normal Mode:
- Click anywhere on card → Navigate to detail view (existing behavior)

Selection Mode Active:
- Click anywhere on card (except View button) → Toggle selection
- Click View button → Prevent default, do nothing
- Click outside cards → No effect (stay in selection mode)
```

#### Keyboard Shortcuts
```
ESC → Exit selection mode (clear all selections)
Ctrl/Cmd + A → Select all visible sessions (future enhancement)
```

#### State Transitions
```
Normal Mode (showing FilterBar)
  ↓ Click on any session card
Selection Mode (showing Toolbar)
  ↓ Click "Exit Selection Mode" OR press ESC OR clear last selection
Normal Mode (showing FilterBar)
```

---

## 4. Implementation Plan

### Phase 1: Foundation (This PRD)
**Goal:** Basic selection and toolbar infrastructure

**Tasks:**
1. Create `useBulkSelection` hook following `useBatchCancellation` pattern
2. Create `MockExamsSelectionToolbar` component
3. Modify `MockExamsDashboard` to conditionally render FilterBar/Toolbar
4. Update `SessionRow` to handle selection clicks
5. Update `AggregateRow` to handle selection clicks on nested sessions
6. Add visual styling for selected state
7. Implement keyboard shortcuts (ESC)

**Files to Modify:**
- `admin_root/admin_frontend/src/hooks/useBulkSelection.js` (new)
- `admin_root/admin_frontend/src/components/admin/MockExamsSelectionToolbar.jsx` (new)
- `admin_root/admin_frontend/src/pages/MockExamsDashboard.jsx` (modify)
- `admin_root/admin_frontend/src/components/admin/SessionRow.jsx` (modify)
- `admin_root/admin_frontend/src/components/admin/AggregateRow.jsx` (modify)

### Phase 2: Bulk Operations (Future)
**Potential bulk actions to add to toolbar:**
- Bulk delete sessions
- Bulk activate/deactivate sessions
- Bulk reschedule (change date/time)
- Bulk location change
- Bulk export to CSV

---

## 5. Edge Cases & Considerations

### 5.1 View Modes
- Selection should work independently in both List View and Aggregate View
- Switching between views should maintain selections if session IDs match
- Selections should be cleared when changing filters (debatable - could preserve)

### 5.2 Pagination
- Selections persist across pages (use Set of session IDs)
- Toolbar shows total selected across all pages
- "Select All" (future) should select only current page or have confirmation for all pages

### 5.3 Real-time Updates
- If a selected session is deleted by another admin, remove from selection
- If data refreshes (e.g., after cache clear), preserve selections by ID

### 5.4 Performance
- Use React.memo for SessionRow/AggregateRow to prevent unnecessary re-renders
- Use Set for selectedSessionIds for O(1) lookup performance
- Debounce rapid clicks to prevent state thrashing

---

## 6. API Requirements

**None required for Phase 1** - This is purely frontend state management.

**Phase 2 (Future):** Bulk operation endpoints will be needed:
```
POST /api/admin/mock-exams/bulk-delete
POST /api/admin/mock-exams/bulk-update
POST /api/admin/mock-exams/bulk-reschedule
```

---

## 7. Testing Requirements

### Unit Tests
- `useBulkSelection` hook:
  - `toggleMode()` enters/exits selection mode
  - `toggleSelection()` adds/removes session IDs
  - `selectAll()` selects all sessions
  - `clearAll()` clears all selections
  - `isSelected()` returns correct boolean

### Integration Tests
- Click on session card enters selection mode
- Click on View button does NOT enter selection mode
- Toolbar appears when first session is selected
- Toolbar disappears when last selection is cleared
- ESC key exits selection mode
- Visual styling applies correctly to selected sessions

### Manual Testing Checklist
- [ ] Selection works in List View
- [ ] Selection works in Aggregate View (nested sessions)
- [ ] Visual feedback is clear and accessible
- [ ] Toolbar replaces filter bar smoothly
- [ ] No console errors or warnings
- [ ] Dark mode styling looks correct
- [ ] Mobile/tablet responsiveness (if applicable)

---

## 8. Success Criteria

### Must Have (Phase 1)
- ✅ Users can click session cards to select them
- ✅ Selected sessions are visually highlighted
- ✅ Toolbar replaces filter bar when sessions are selected
- ✅ Users can exit selection mode via button or ESC key
- ✅ Selection count displays correctly in toolbar
- ✅ No performance degradation with 50+ selected sessions

### Nice to Have (Phase 1)
- Smooth transition animation between filter bar and toolbar
- Tooltip explaining selection mode on first use
- Persistent selection across view mode changes

### Future (Phase 2+)
- Bulk delete functionality
- Bulk status change functionality
- Bulk reschedule functionality
- Select all (current page / all pages)

---

## 9. Design References

### Existing Patterns to Follow
- **useBatchCancellation** hook from BookingsSection
- **CancellationControls** component styling
- **BookingRow** selection behavior (but without checkboxes)

### Inspiration
- User-provided screen recording: `screenshots\Screen Recording 2025-11-13 094722.mp4`
- Google Drive file selection pattern (click to select, no checkboxes)
- Trello card selection pattern

---

## 10. Open Questions

1. **Q:** Should selections persist across page refreshes?
   **A:** No, clear on refresh to avoid stale selections.

2. **Q:** Should switching from List to Aggregate view preserve selections?
   **A:** Yes, preserve by session ID if possible.

3. **Q:** Should there be a visual limit on number of selections?
   **A:** No hard limit, but show warning if selecting 100+ sessions.

4. **Q:** What happens if user applies filters while in selection mode?
   **A:** Exit selection mode and clear selections (filter state takes precedence).

---

## 11. Dependencies

### External Libraries
- None required (using existing React patterns)

### Internal Dependencies
- FilterBar component (existing)
- SessionRow component (existing)
- AggregateRow component (existing)
- MockExamsDashboard page (existing)

---

## 12. Rollout Plan

### Development
1. Create feature branch: `feat/mock-exams-bulk-selection`
2. Implement Phase 1 components and hooks
3. Add unit tests
4. Manual QA testing
5. Code review with focus on accessibility and performance

### Deployment
1. Deploy to staging environment
2. Internal team testing (1-2 days)
3. Gather feedback on UX/UI
4. Deploy to production
5. Monitor for errors or user confusion

### Rollback Plan
- Feature can be disabled by commenting out selection mode logic
- No backend changes, so rollback is frontend-only
- No data migration required

---

## Appendix A: Component Hierarchy

```
MockExamsDashboard
├─ MockExamsMetrics
├─ FilterBar (shown when !isSelectionMode)
├─ MockExamsSelectionToolbar (shown when isSelectionMode) [NEW]
└─ MockExamsTable
   ├─ List View
   │  └─ SessionRow (modified for selection)
   └─ Aggregate View
      └─ AggregateRow
         └─ SessionRow (nested, modified for selection)
```

---

## Appendix B: State Flow Diagram

```
┌─────────────────┐
│  Normal Mode    │
│  (FilterBar)    │
└────────┬────────┘
         │ Click session card
         ↓
┌─────────────────┐
│ Selection Mode  │
│   (Toolbar)     │
└────────┬────────┘
         │ Click "Exit" OR ESC OR clear last
         ↓
┌─────────────────┐
│  Normal Mode    │
│  (FilterBar)    │
└─────────────────┘
```

---

**END OF PRD**

---

**Approval Signatures:**

- **Product Owner:** _______________________
- **Tech Lead:** _______________________
- **UX Designer:** _______________________

**Change Log:**
- 2025-11-13: Initial PRD creation (v1.0)
