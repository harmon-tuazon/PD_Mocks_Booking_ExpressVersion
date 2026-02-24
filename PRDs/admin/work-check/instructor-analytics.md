# PRD: Instructor Analytics Dashboard

**Version:** 1.0.0
**Created:** February 11, 2026
**Status:** Draft
**Confidence Score:** 8/10
**Estimated Effort:** 2-3 days

---

## 1. Overview

### 1.1 Purpose
Provide instructors with an analytics page within their portal that surfaces key performance indicators and metrics related to their work check bookings. The page gives instructors visibility into attendance patterns, booking trends, group participation, and session utilization — all scoped to the logged-in instructor's data.

### 1.2 Scope
- New "Analytics" page in the instructor portal
- New API endpoint for instructor-specific analytics data
- KPI stat cards, charts/visualizations, and detail tables
- Date range filtering
- Sidebar navigation update to include Analytics link

### 1.3 Out of Scope
- Admin-level cross-instructor analytics (admin dashboard concern)
- Export/download functionality (future enhancement)
- Real-time live updates or auto-polling (uses manual refresh with staleTime rate limiting)
- Student-facing analytics

### 1.4 Dependencies
- Existing `work_check_bookings` table (with `marked_at`, `confirmed_at`, `cancelled_at` timestamps)
- Existing `work_check_slots` table
- Existing `groups`, `groups_students`, `groups_instructors` tables
- Existing `booking_details_view` Supabase view
- Existing `requireRole` middleware for instructor auth
- Existing instructor portal layout (SidebarNavigation, MainLayout)

---

## 2. KPIs & Metrics

### 2.1 Primary KPI Cards (Top Row)

These are the headline numbers displayed as stat cards at the top of the page.

| KPI | Definition | Data Source | Calculation |
|-----|-----------|-------------|-------------|
| **Total Sessions** | Number of slots assigned to instructor in selected period | `work_check_slots` | `COUNT(*) WHERE instructor_id = :id AND slot_date BETWEEN :from AND :to` |
| **Total Bookings** | Number of bookings across instructor's slots in selected period | `work_check_bookings` JOIN `work_check_slots` | `COUNT(*) WHERE slots.instructor_id = :id AND slots.slot_date BETWEEN :from AND :to` |
| **Attendance Rate** | % of confirmed bookings that were marked as attended | `work_check_bookings` | `COUNT(marked) / COUNT(confirmed + marked) * 100` |
| **Cancellation Rate** | % of all bookings that were cancelled | `work_check_bookings` | `COUNT(cancelled) / COUNT(all) * 100` |
| **No-Show Rate** | % of confirmed bookings on past dates not marked | `work_check_bookings` JOIN `work_check_slots` | `COUNT(confirmed WHERE slot_date < today) / COUNT(confirmed + marked WHERE slot_date < today) * 100` |

### 2.2 Booking Status Breakdown

Visual breakdown of booking statuses across the selected period.

| Metric | Visualization | Definition |
|--------|--------------|------------|
| **Status Distribution** | Horizontal stacked bar or donut chart | Count of bookings grouped by status: pending, confirmed, marked, completed, rejected, cancelled |
| **Type Distribution** | Donut chart or pill badges | Count of bookings grouped by type: Work Check, Demo, Supervised Session |

### 2.3 Trends Over Time

| Metric | Visualization | Definition |
|--------|--------------|------------|
| **Bookings Over Time** | Line/area chart (weekly buckets) | Count of bookings created per week, grouped by status |
| **Attendance Over Time** | Line chart | Weekly attendance rate (marked / (confirmed + marked)) |

### 2.4 Group Performance Table

Table showing per-group metrics for the instructor's assigned groups.

| Column | Definition |
|--------|-----------|
| **Group Name** | Group display name |
| **Enrolled Students** | Count of active students in group |
| **Total Bookings** | Bookings from students in this group |
| **Attended** | Bookings with status = marked or completed |
| **Cancelled** | Bookings with status = cancelled |
| **Participation Rate** | Unique students with at least 1 booking / enrolled students * 100 |
| **Attendance Rate** | Marked / (confirmed + marked) * 100 |

### 2.5 Session Utilization

| Metric | Visualization | Definition |
|--------|--------------|------------|
| **Slot Fill Rate** | Progress bars or table | Bookings (pending + confirmed + marked) / total_slots capacity per slot |
| **Busiest Days** | Simple ranked list | Days of week ranked by average booking count |
| **Busiest Times** | Simple ranked list | Time slots ranked by average booking count |

### 2.6 Recent Activity Feed (Optional)

A compact list of recent booking events (last 10-20):
- "Student X booked Work Check for Feb 15"
- "Student Y cancelled booking for Feb 12"
- "You marked 3 bookings on Feb 10"

---

## 3. API Design

### 3.1 New Endpoint: Instructor Analytics

**Endpoint:** `GET /api/admin/instructor/analytics`
**Auth:** `requireRole(req, 'instructor')`
**File:** `admin_root/api/admin/instructor/analytics.js`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date_from` | string (YYYY-MM-DD) | 30 days ago | Start of date range |
| `date_to` | string (YYYY-MM-DD) | today | End of date range |
| `group_id` | string | none | Filter by a specific group (group_id from `groups` table) |
| `cycle` | string | none | Filter by cycle (e.g., "Cycle 1"). Filters to only groups matching this cycle value |

**Response:**

```json
{
  "success": true,
  "data": {
    "period": {
      "date_from": "2026-01-12",
      "date_to": "2026-02-11"
    },
    "kpis": {
      "total_sessions": 42,
      "total_bookings": 38,
      "attendance_rate": 85.7,
      "cancellation_rate": 10.5,
      "no_show_rate": 4.8
    },
    "status_breakdown": {
      "pending": 3,
      "confirmed": 8,
      "marked": 20,
      "completed": 2,
      "rejected": 1,
      "cancelled": 4
    },
    "type_breakdown": {
      "Work Check": 28,
      "Demo": 7,
      "Supervised Session": 3
    },
    "weekly_trends": [
      {
        "week_start": "2026-01-13",
        "bookings": 8,
        "marked": 6,
        "cancelled": 1,
        "attendance_rate": 85.7
      }
    ],
    "group_performance": [
      {
        "group_id": "260128AMGR1",
        "group_name": "AM Group 1",
        "enrolled_students": 12,
        "total_bookings": 15,
        "attended": 12,
        "cancelled": 2,
        "participation_rate": 83.3,
        "attendance_rate": 92.3
      }
    ],
    "busiest_days": [
      { "day": "Monday", "avg_bookings": 3.2 },
      { "day": "Wednesday", "avg_bookings": 2.8 }
    ],
    "busiest_times": [
      { "time": "09:00", "avg_bookings": 2.5 },
      { "time": "14:00", "avg_bookings": 1.8 }
    ]
  }
}
```

### 3.2 Validation Schema

Add to `admin_root/api/_shared/validation.js`:

```javascript
instructorAnalytics: Joi.object({
  date_from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().messages({
    'string.pattern.base': 'date_from must be in YYYY-MM-DD format'
  }),
  date_to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().messages({
    'string.pattern.base': 'date_to must be in YYYY-MM-DD format'
  }),
  group_id: Joi.string().max(50).optional(),
  cycle: Joi.string().max(50).optional()
})
```

### 3.3 Query Strategy

All queries filter by the instructor's slots using:
```sql
work_check_slots.instructor_id = :instructor_id
AND work_check_slots.slot_date BETWEEN :date_from AND :date_to
```

**Group/Cycle filtering:**
When `group_id` is provided, additionally filter slots where `group_id @> ARRAY[:group_id]` (the slot's group_id array contains the selected group).

When `cycle` is provided:
1. First query `groups` table: `SELECT group_id FROM groups WHERE cycle = :cycle`
2. Then filter slots where `group_id && ARRAY[...matching_group_ids]` (the slot's group_id array overlaps with the cycle's groups)

Both filters can be combined (group within a cycle).

Use `booking_details_view` where possible to avoid repeated JOINs. For group performance, join through `work_check_slots.group_id` (array) using `ANY()` or unnest.

---

## 4. Frontend Design

### 4.1 Page Structure

**File:** `admin_root/admin_frontend/src/pages/instructor/InstructorAnalytics.jsx`

```
┌─────────────────────────────────────────────────────┐
│ Analytics                                              │
│ Your work check performance overview                   │
├─────────────────────────────────────────────────────┤
│ [Date Range Presets]  [Cycle ▼]  [Group ▼]  [⟳]  [Reset] │
├─────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │Total ││Total ││Attend││Cancel││No-Sho│      │
│ │Sessns││Bookngs│ │ Rate ││ Rate ││w Rate│      │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ Status Breakdown    │ │ Type Breakdown      │    │
│ │ (stacked bar/donut) │ │ (donut/pills)       │    │
│ └─────────────────────┘ └─────────────────────┘    │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐  │
│ │ Bookings Over Time (line chart, weekly)       │  │
│ └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌─────────────────────┐  │
│ │ Busiest Days          │ │ Busiest Times       │  │
│ │ (ranked list)         │ │ (ranked list)       │  │
│ └───────────────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐  │
│ │ Group Performance (table)                     │  │
│ │ Group | Students | Bookings | Attended | Rate │  │
│ └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 4.2 Components

| Component | Purpose |
|-----------|---------|
| `InstructorAnalytics.jsx` | Main page, layout, date range state |
| `AnalyticsKPICards` | Top row of 5 stat cards (inline, not separate file) |
| `AnalyticsStatusBreakdown` | Status/type breakdown visualizations (inline) |
| `AnalyticsTrendChart` | Weekly bookings line chart (inline or simple div-based bars) |
| `AnalyticsGroupTable` | Group performance table (inline) |
| `AnalyticsBusiestList` | Ranked lists for days/times (inline) |

### 4.3 Charting Approach

**Keep it simple** — use CSS-based visualizations (div bars, percentage widths) rather than importing a charting library. This avoids bundle size bloat and matches the existing codebase pattern of no chart dependencies.

- **Status breakdown:** Horizontal stacked bar using `div` elements with percentage widths and Tailwind colors
- **Trend chart:** Simple bar chart using `div` columns with `height` percentages
- **Donut chart:** CSS-only donut using `conic-gradient` or simple pill badges with counts
- **Progress bars:** Standard Tailwind progress bar pattern for utilization rates

### 4.4 Filters Bar

A horizontal filter bar matching the `WorkCheckBookingFilters` pattern:

| Filter | Component | Behavior |
|--------|-----------|----------|
| **Date Range Presets** | Buttons: "7d", "30d", "90d", "All" | Sets `date_from` and `date_to`, default "30d" |
| **Cycle** | `<Select>` dropdown | Populated from instructor's assigned groups' distinct `cycle` values. "All Cycles" default. When selected, filters all metrics to only groups/slots in that cycle |
| **Group** | `<Select>` dropdown | Populated from instructor's assigned groups (filtered by selected cycle if active). "All Groups" default. When selected, filters all metrics to that specific group's slots |
| **Refresh** | Icon button (`ArrowPathIcon`) | Calls `refetch()`. Disabled while `isFetching`. Spins icon during fetch. Rate-limited by `staleTime: 5 min` |
| **Reset** | Button | Clears all filters back to defaults |

**Cascade behavior:** Selecting a cycle narrows the Group dropdown to only groups in that cycle. Selecting a group within a cycle is additive (both filters apply). Clearing cycle also clears group if the selected group is no longer in the available set.

The cycle and group options are fetched from the existing `instructorPortalApi.listGroups()` endpoint (already returns `cycle` and `group_name`). No new endpoint needed for populating these dropdowns.

### 4.5 Styling

Match existing admin dashboard patterns:
- `bg-white dark:bg-dark-card` card backgrounds
- `shadow dark:shadow-gray-900/50 rounded-lg` card styling
- `font-headline` for headings, `font-body` for content
- `text-navy-900 dark:text-gray-100` for primary text
- Stat cards matching the existing `StatCard` pattern from `WorkCheckBookings.jsx`

---

## 5. Routing & Navigation

### 5.1 Route

Add to `App.jsx` inside the instructor route block:

```jsx
<Route path="analytics" element={<InstructorAnalytics />} />
```

Full route: `/instructor/analytics`

### 5.2 Sidebar Navigation

Update `SidebarNavigation.jsx` to add "Analytics" nav item for instructors:

```javascript
// Instructor nav items
if (user.user_role === 'instructor') {
  return [
    { name: 'Dashboard', href: '/instructor', icon: HomeIcon },
    { name: 'Analytics', href: '/instructor/analytics', icon: ChartBarIcon }
  ];
}
```

---

## 6. Data Hook

### 6.1 TanStack Query Hook

**File:** `admin_root/admin_frontend/src/hooks/useInstructorPortalData.js`

```javascript
export function useInstructorAnalytics(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'analytics', JSON.stringify(params)],
    queryFn: () => instructorPortalApi.getAnalytics(params),
    staleTime: 5 * 60 * 1000, // 5 minutes — also acts as natural rate limiter for manual refresh
    refetchOnWindowFocus: false,
    // No refetchInterval — analytics data is not time-critical and should be
    // refreshed on demand via the manual refresh button
    ...options
  });
}
```

### 6.3 Refresh Strategy

**Approach:** No auto-refresh + manual refresh button with `staleTime` as natural rate limiter.

**Why no auto-refresh:**
- Analytics data is not time-critical — it summarizes historical trends
- Auto-polling would waste API calls when the instructor isn't actively viewing the page
- Instructors can manually refresh when they want up-to-date numbers

**Manual refresh button behavior:**
- A refresh icon button is placed in the filter bar (right side, next to Reset)
- Clicking it calls `refetch()` from the TanStack Query hook
- The button is **disabled** while `isFetching === true` to prevent rapid re-clicks
- `staleTime: 5 minutes` acts as a natural rate limiter — if data was fetched < 5 minutes ago, TanStack Query serves the cached result instantly without hitting the API
- After 5 minutes, clicking refresh triggers a real API call

**Implementation pattern:**
```jsx
const { data, isLoading, isFetching, refetch } = useInstructorAnalytics(params);

<button
  onClick={() => refetch()}
  disabled={isFetching}
  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
  title={isFetching ? 'Refreshing...' : 'Refresh analytics'}
>
  <ArrowPathIcon className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
</button>
```

### 6.2 API Service

**File:** `admin_root/admin_frontend/src/services/adminApi.js`

```javascript
getAnalytics: async (params = {}) => {
  const response = await api.get('/admin/instructor/analytics', { params });
  return response.data;
},
```

---

## 7. Implementation Checklist

### Backend
- [ ] Create `admin_root/api/admin/instructor/analytics.js` endpoint
- [ ] Add `instructorAnalytics` validation schema to `admin_root/api/_shared/validation.js`
- [ ] Query KPIs: total sessions, total bookings, attendance/cancellation/no-show rates
- [ ] Query status and type breakdowns
- [ ] Query weekly trends with date_trunc grouping
- [ ] Query group performance with participation and attendance rates
- [ ] Query busiest days/times
- [ ] Add route to `vercel.json` if needed

### Frontend
- [ ] Create `InstructorAnalytics.jsx` page component
- [ ] Add date range filter with presets (7d, 30d, 90d, all)
- [ ] Implement KPI stat cards (5 cards)
- [ ] Implement status breakdown visualization (stacked bar)
- [ ] Implement type breakdown (pill badges with counts)
- [ ] Implement weekly trend chart (CSS bar chart)
- [ ] Implement group performance table
- [ ] Implement busiest days/times ranked lists
- [ ] Add `useInstructorAnalytics` hook
- [ ] Add `getAnalytics` to `instructorPortalApi`
- [ ] Add Analytics route to `App.jsx`
- [ ] Add Analytics nav item to `SidebarNavigation.jsx`
- [ ] Add manual refresh button (disabled during fetch, spinning icon, staleTime rate-limited)
- [ ] Loading skeletons for all sections
- [ ] Empty state handling
- [ ] Error state handling

### Validation
- [ ] `npm run build` passes for admin_frontend
- [ ] Instructor login shows Analytics in sidebar
- [ ] Analytics page loads with correct data
- [ ] Date range filter updates all sections
- [ ] All KPI calculations are accurate
- [ ] Dark mode renders correctly

---

## 8. Existing Files to Modify

| File | Change |
|------|--------|
| `admin_root/api/_shared/validation.js` | Add `instructorAnalytics` schema |
| `admin_root/admin_frontend/src/hooks/useInstructorPortalData.js` | Add `useInstructorAnalytics` hook |
| `admin_root/admin_frontend/src/services/adminApi.js` | Add `getAnalytics` to `instructorPortalApi` |
| `admin_root/admin_frontend/src/components/shared/SidebarNavigation.jsx` | Add Analytics nav item for instructors |
| `admin_root/admin_frontend/src/App.jsx` | Add `/instructor/analytics` route |

## 9. New Files to Create

| File | Purpose |
|------|---------|
| `admin_root/api/admin/instructor/analytics.js` | Analytics API endpoint |
| `admin_root/admin_frontend/src/pages/instructor/InstructorAnalytics.jsx` | Analytics page component |

---

## 10. Technical Notes

- **No charting library** — use CSS-based visualizations to keep bundle small
- **Single API call** — the analytics endpoint computes all metrics server-side in one request to minimize round-trips
- **Reuse `booking_details_view`** — the pre-joined view avoids complex multi-table queries
- **Instructor scoping** — all queries are scoped via `work_check_slots.instructor_id` to ensure instructors only see their own data
- **Date defaults** — if no date range provided, default to last 30 days
