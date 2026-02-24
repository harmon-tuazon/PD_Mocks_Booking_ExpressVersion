# PRD: Mobile-First Dashboard Redesign

**Version:** 2.0.0
**Created:** February 10, 2026
**Status:** Completed
**Completed:** February 10, 2026
**Confidence Score:** 9/10
**Estimated Effort:** 1-2 days

---

## 1. Overview

### 1.1 Purpose
Redesign the user dashboard with a mobile-first approach inspired by modern mobile app patterns (similar to Uber Eats). The goal is to reduce scrolling, provide quick access to booking actions, and present key information in a compact, scannable format.

### 1.2 Background
The current dashboard (v1.5.0) follows a desktop-first design with:
- Large stat cards row (4 cards)
- Activities section with detailed cards
- Booking wizard with two large cards (Mock Exams, Work Checks)

This layout requires excessive scrolling on mobile and doesn't prioritize the primary user actions (booking exams/work checks).

### 1.3 Design Inspiration
Reference: `screenshots/mobile_peg.jpg` (Uber Eats mobile app pattern)
- Horizontal scrollable action buttons at top
- Clean, compact content cards below
- Minimal visual noise, clear hierarchy

### 1.4 Scope
- Redesign dashboard layout to be mobile-first
- Replace stat cards with horizontal quick-action buttons
- Consolidate activities and tokens into compact tables
- Remove large booking wizard cards
- Responsive scaling for tablet/desktop

### 1.5 Out of Scope
- API changes (reuse existing `/api/dashboard` endpoint)
- New features or data requirements
- Navigation changes (sidebar remains unchanged)

---

## 2. New Layout Design

### 2.1 Mobile Layout (Primary)

```
┌─────────────────────────────────────┐
│  Welcome back, John!                │
│  Here's what's happening.           │
├─────────────────────────────────────┤
│                                     │
│  QUICK ACTIONS (Horizontal Scroll)  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ SJ  │ │ CS  │ │Mini │ │Work │   │
│  │     │ │     │ │mock │ │Check│   │
│  │ 📝  │ │ 🩺  │ │ ⚡  │ │ 🔧  │   │
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│                                     │
├─────────────────────────────────────┤
│  THIS WEEK                          │
│  ┌─────────────────────────────────┐│
│  │ Today - Feb 10                  ││
│  │ • CS Mock 9:00 AM   [Confirmed] ││
│  ├─────────────────────────────────┤│
│  │ Wed - Feb 12                    ││
│  │ • Work Check 10:00  [Pending]   ││
│  ├─────────────────────────────────┤│
│  │ Fri - Feb 14                    ││
│  │ • SJ Mock 1:00 PM   [Confirmed] ││
│  └─────────────────────────────────┘│
│                                     │
├─────────────────────────────────────┤
│  YOUR TOKENS                        │
│  ┌─────────────────────────────────┐│
│  │ SJ Credits          │    3     ││
│  │ CS Credits          │    2     ││
│  │ Mini-mock           │    5     ││
│  │ Shared              │    1     ││
│  │ Discussion          │    1     ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### 2.2 Desktop Layout (Responsive)

On larger screens (md: 768px+), the layout expands:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Welcome back, John!                                                  │
│  Here's what's happening this week.                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  QUICK ACTIONS (Full width, evenly spaced)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Situational │ │  Clinical  │ │  Mini-   │ │   Work   │             │
│  │  Judgment   │ │  Skills    │ │   mock   │ │  Check   │             │
│  │     📝      │ │     🩺     │ │    ⚡    │ │    🔧    │             │
│  │  3 tokens   │ │  2 tokens  │ │ 5 tokens │ │ 2 groups │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────┐ │
│  │  THIS WEEK'S ACTIVITIES         │ │  YOUR TOKENS                │ │
│  │                                 │ │                             │ │
│  │  Today - Feb 10                 │ │  SJ Credits        3        │ │
│  │  • CS Mock 9:00 AM  [Confirmed] │ │  CS Credits        2        │ │
│  │                                 │ │  Mini-mock         5        │ │
│  │  Wed - Feb 12                   │ │  Shared            1        │ │
│  │  • Work Check 10:00 [Pending]   │ │  Discussion        1        │ │
│  │                                 │ │                             │ │
│  │  Fri - Feb 14                   │ │  ─────────────────────      │ │
│  │  • SJ Mock 1:00 PM  [Confirmed] │ │  Total Available   12       │ │
│  │                                 │ │                             │ │
│  │           [View All →]          │ │                             │ │
│  └─────────────────────────────────┘ └─────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 QuickActionButtons Component

Horizontal scrollable row of action buttons linking to booking flows.

**Props:**
```typescript
interface QuickActionButtonsProps {
  tokens: {
    sj_credits: number;
    cs_credits: number;
    sjmini_credits: number;
    shared_mock_credits: number;
  };
  groupCount: number;
}
```

**Button Configuration:**
```javascript
const quickActions = [
  {
    id: 'sj',
    label: 'SJ',
    fullLabel: 'Situational Judgment',
    icon: '📝', // Or SVG icon
    href: '/book/exams?type=Situational%20Judgment',
    color: 'bg-primary-100 text-primary-700',
    tokenKey: 'sj_credits'
  },
  {
    id: 'cs',
    label: 'CS',
    fullLabel: 'Clinical Skills',
    icon: '🩺',
    href: '/book/exams?type=Clinical%20Skills',
    color: 'bg-teal-100 text-teal-700',
    tokenKey: 'cs_credits'
  },
  {
    id: 'mini',
    label: 'Mini',
    fullLabel: 'Mini-mock',
    icon: '⚡',
    href: '/book/exams?type=Mini-mock',
    color: 'bg-amber-100 text-amber-700',
    tokenKey: 'sjmini_credits'
  },
  {
    id: 'workcheck',
    label: 'Work Check',
    fullLabel: 'Work Check',
    icon: '🔧',
    href: '/book/work-check',
    color: 'bg-green-100 text-green-700',
    showGroupCount: true
  }
];
```

**Mobile Styling:**
```jsx
<div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
  <div className="flex gap-3 pb-2">
    {quickActions.map(action => (
      <button
        key={action.id}
        onClick={() => navigate(action.href)}
        className={`
          flex-shrink-0
          w-20 h-20
          ${action.color}
          rounded-xl
          flex flex-col items-center justify-center
          gap-1.5
          shadow-sm
          active:scale-95
          transition-transform
        `}
      >
        <span className="text-2xl">{action.icon}</span>
        <span className="text-xs font-medium">{action.label}</span>
      </button>
    ))}
  </div>
</div>
```

**Desktop Styling (md+):**
```jsx
<div className="grid grid-cols-4 gap-4">
  {quickActions.map(action => (
    <button
      key={action.id}
      onClick={() => navigate(action.href)}
      className={`
        ${action.color}
        rounded-xl p-4
        flex flex-col items-center justify-center
        gap-2
        shadow-sm hover:shadow-md
        transition-all
      `}
    >
      <span className="text-3xl">{action.icon}</span>
      <span className="text-sm font-semibold">{action.fullLabel}</span>
      <span className="text-xs opacity-75">
        {action.showGroupCount
          ? `${groupCount} groups`
          : `${tokens[action.tokenKey]} tokens`}
      </span>
    </button>
  ))}
</div>
```

### 3.2 ActivitiesTable Component

Compact table/list view of this week's activities.

**Mobile Design:**
- Grouped by date with subtle date headers
- Single line per activity with essential info
- Status badge inline

**Structure:**
```jsx
const ActivitiesTable = ({ activities }) => {
  const groupedByDate = groupActivitiesByDate(activities);

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            This Week
          </h3>
          <button
            onClick={() => navigate('/my-bookings')}
            className="text-xs text-primary-600 hover:underline"
          >
            View All
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyActivitiesState />
      ) : (
        <div className="divide-y dark:divide-dark-border">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className={`
                px-4 py-2 text-xs font-medium uppercase tracking-wide
                ${isToday(date)
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-gray-400'}
              `}>
                {isToday(date) ? 'Today' : formatShortDate(date)}
              </div>

              {/* Activity rows */}
              {items.map(activity => (
                <div
                  key={activity.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Type indicator */}
                    <div className={`
                      w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                      ${activity.type === 'mock_exam'
                        ? 'bg-primary-100 dark:bg-primary-900/30'
                        : 'bg-green-100 dark:bg-green-900/30'}
                    `}>
                      {activity.type === 'mock_exam' ? '📝' : '🔧'}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {activity.type === 'mock_exam'
                          ? activity.mock_type
                          : 'Work Check'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(activity.start_time)}
                        {activity.location && ` • ${activity.location}`}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full flex-shrink-0
                    ${activity.status === 'confirmed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}
                  `}>
                    {activity.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### 3.3 TokensTable Component

Compact table showing token balances.

**Structure:**
```jsx
const TokensTable = ({ tokens }) => {
  const tokenRows = [
    { label: 'SJ Credits', value: tokens.sj_credits, color: 'text-primary-600' },
    { label: 'CS Credits', value: tokens.cs_credits, color: 'text-teal-600' },
    { label: 'Mini-mock', value: tokens.sjmini_credits, color: 'text-amber-600' },
    { label: 'Shared', value: tokens.shared_mock_credits, color: 'text-purple-600' },
    { label: 'Discussion', value: tokens.mock_discussion_token, color: 'text-orange-600' },
  ];

  const total = tokens.sj_credits + tokens.cs_credits +
                tokens.sjmini_credits + tokens.shared_mock_credits;

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b dark:border-dark-border">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Your Tokens
        </h3>
      </div>

      <div className="divide-y dark:divide-dark-border">
        {tokenRows.map(row => (
          <div
            key={row.label}
            className="px-4 py-2.5 flex items-center justify-between"
          >
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {row.label}
            </span>
            <span className={`text-sm font-semibold ${row.color} dark:text-gray-100`}>
              {row.value}
            </span>
          </div>
        ))}

        {/* Total row */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-dark-bg">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Available
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {total}
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Updated Dashboard Component

### 4.1 New Dashboard.jsx

```jsx
/**
 * Dashboard.jsx (Mobile-First Redesign v2.0)
 * Main dashboard page with quick actions and compact tables
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../../utils/auth';
import { useDashboard } from '../../hooks/useDashboard';
import QuickActionButtons from './QuickActionButtons';
import ActivitiesTable from './ActivitiesTable';
import TokensTable from './TokensTable';

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboard();

  // Redirect if not authenticated
  useEffect(() => {
    const session = getUserSession();
    if (!session) {
      navigate('/login');
    }
  }, [navigate]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refresh} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {/* Compact Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, {data.user.firstname}!
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Here's what's happening this week.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="mb-6">
          <QuickActionButtons
            tokens={data.tokens}
            groupCount={data.groups.length}
          />
        </div>

        {/* Main Content: Activities & Tokens */}
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
          {/* Activities Table (First on mobile) */}
          <ActivitiesTable
            activities={data.activities.this_week}
          />

          {/* Tokens Table (Second on mobile) */}
          <TokensTable
            tokens={data.tokens}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

### 4.2 Mobile-First Skeleton

```jsx
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
      {/* Header skeleton */}
      <div className="mb-4 md:mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
      </div>

      {/* Quick actions skeleton */}
      <div className="mb-6 flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-xl flex-shrink-0 animate-pulse"
          />
        ))}
      </div>

      {/* Tables skeleton */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        {[1, 2].map(i => (
          <div key={i} className="bg-white dark:bg-dark-card rounded-lg shadow-sm animate-pulse">
            <div className="px-4 py-3 border-b dark:border-dark-border">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            </div>
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-10 bg-gray-100 dark:bg-gray-800 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
```

---

## 5. File Structure Changes

### 5.1 New/Modified Files

```
user_root/frontend/src/components/dashboard/
├── Dashboard.jsx           # MODIFY - New mobile-first layout
├── QuickActionButtons.jsx  # NEW - Horizontal action buttons
├── ActivitiesTable.jsx     # NEW - Compact activities table
├── TokensTable.jsx         # NEW - Compact tokens table
├── ThisWeekActivities.jsx  # REMOVE - Replaced by ActivitiesTable
├── ActivityCard.jsx        # REMOVE - No longer needed
├── BookingWizard.jsx       # REMOVE - Replaced by QuickActionButtons
├── MockExamCard.jsx        # REMOVE - Replaced by QuickActionButtons
└── WorkCheckCard.jsx       # REMOVE - Replaced by QuickActionButtons
```

### 5.2 Files to Delete

The following files will be removed as they're replaced by the new compact components:
- `ThisWeekActivities.jsx`
- `ActivityCard.jsx`
- `BookingWizard.jsx`
- `MockExamCard.jsx`
- `WorkCheckCard.jsx`

---

## 6. Responsive Breakpoints

### 6.1 Breakpoint Strategy

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile (default) | < 768px | Single column, horizontal scroll for actions |
| Tablet (md) | 768px+ | Two-column grid for tables, larger action buttons |
| Desktop (lg) | 1024px+ | Max-width container, more spacing |

### 6.2 Key Responsive Classes

```css
/* Quick actions */
.quick-actions {
  /* Mobile: horizontal scroll */
  @apply flex gap-3 overflow-x-auto;

  /* Tablet+: grid layout */
  @screen md {
    @apply grid grid-cols-4 gap-4 overflow-visible;
  }
}

/* Main content */
.main-content {
  /* Mobile: stacked */
  @apply space-y-4;

  /* Tablet+: side by side */
  @screen md {
    @apply grid grid-cols-2 gap-6 space-y-0;
  }
}

/* Container */
.dashboard-container {
  @apply px-4 py-4;

  @screen md {
    @apply py-8;
  }
}
```

---

## 7. Implementation Checklist

### Phase 1: Create New Components (0.5 day)
- [x] Create `QuickActionButtons.jsx`
- [x] Create `ActivitiesTable.jsx`
- [x] Create `TokensTable.jsx`
- [x] Test components in isolation

### Phase 2: Update Dashboard (0.5 day)
- [x] Update `Dashboard.jsx` with new layout
- [x] Update skeleton loader for mobile-first
- [x] Ensure dark mode support
- [x] Test responsive behavior

### Phase 3: Cleanup & Polish (0.5 day)
- [x] Remove old components (ThisWeekActivities, ActivityCard, etc.)
- [x] Remove unused imports
- [x] Test on multiple screen sizes
- [x] Verify touch targets are adequate (min 44px)
- [x] Test horizontal scroll behavior on iOS/Android

### Phase 4: Testing (0.5 day)
- [x] Mobile Safari testing
- [x] Mobile Chrome testing
- [x] Tablet testing
- [x] Desktop testing
- [x] Dark mode testing
- [x] Empty states testing
- [x] Loading states testing

---

## 8. Success Criteria

1. **Mobile Experience**
   - Dashboard fits on mobile viewport without excessive scrolling
   - Quick action buttons are easily tappable (min 44px touch target)
   - Horizontal scroll is smooth and natural
   - Activities are scannable at a glance

2. **Performance**
   - No layout shift on load
   - Smooth animations/transitions
   - Fast initial paint

3. **Accessibility**
   - Adequate color contrast
   - Screen reader compatible
   - Keyboard navigable

4. **Responsiveness**
   - Graceful scaling from mobile to desktop
   - No horizontal overflow on any viewport
   - Tables remain readable on all sizes

---

## 9. Visual Reference

### Mobile Peg Inspiration
![Mobile Peg](../../../screenshots/mobile_peg.jpg)

**Key patterns to adopt:**
1. Horizontal scrollable action chips at top
2. Clean white cards with subtle shadows
3. Compact list items with essential info only
4. Clear visual hierarchy with section headers

---

## 10. Migration Notes

### Breaking Changes
- Removes `StatCard` component usage from Dashboard
- Removes `BookingWizard` section entirely
- Removes individual `MockExamCard` and `WorkCheckCard`

### Backward Compatibility
- API remains unchanged (`/api/dashboard`)
- Data structure remains unchanged
- Routes remain unchanged

### Rollback Plan
If issues arise, revert to v1.5.0 Dashboard by:
1. Restore deleted component files from git
2. Revert Dashboard.jsx changes
3. No backend changes needed

---

## Sign-off

- [x] Technical Review: Frontend Lead
- [x] UX Review: Product Designer
- [x] Mobile Testing: QA Team
- [x] Stakeholder Approval: Product Owner

**Status**: Implemented
**Risk Level**: Low (UI only, no API changes)
**Priority**: Medium

---

## Implementation Summary

**Completed:** February 10, 2026

### Components Created
1. **QuickActionButtons.jsx** - Horizontal scrollable action buttons for quick booking access with "Tap to book", "Swipe to see more", and "Click to book" copywriting
2. **ActivitiesTable.jsx** - Compact table/list view of this week's activities with date grouping
3. **TokensTable.jsx** - Compact tokens table showing all credit types

### Components Updated
- **Dashboard.jsx** - Complete rewrite with mobile-first layout

### Components Deleted
- `ThisWeekActivities.jsx`
- `ActivityCard.jsx`
- `BookingWizard.jsx`
- `MockExamCard.jsx`
- `WorkCheckCard.jsx`
