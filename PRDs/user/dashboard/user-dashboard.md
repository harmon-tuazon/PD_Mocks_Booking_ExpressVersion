# PRD: User Dashboard (Home Page)

**Version:** 1.0.0
**Created:** February 10, 2026
**Status:** Draft
**Confidence Score:** 9/10
**Estimated Effort:** 3-4 days

---

## 1. Overview

### 1.1 Purpose
Create a unified dashboard as the new home page for the user app. With the addition of Work Checks alongside Mock Exams, users need a central hub to:
1. View their upcoming activities for the current week
2. Quickly navigate to book either Mock Exams or Work Checks

### 1.2 Background
Currently, after login, users are redirected to `/book/exam-types` (ExamTypeSelector), which only shows mock exam booking options. With Work Checks now available, we need a proper home page that serves as an entry point to both booking flows.

### 1.3 Scope
- **Dashboard page** as the new home after login (`/dashboard`)
- **This Week's Activities** section showing upcoming bookings
- **Booking Wizard** with two paths: Mock Exams and Work Checks
- **Quick stats** showing user's tokens and active groups
- **Routing changes**: Dashboard becomes home page after login
- **Navigation restructure**: New sidebar with submenus (similar to admin pattern)

### 1.4 Out of Scope
- Admin dashboard (covered in Admin PRDs)
- Notification system for booking confirmations
- Calendar integration (future consideration)
- Mobile app version

### 1.5 Dependencies
- Existing mock booking flow (`ExamTypeSelector`, `ExamSessionsList`, etc.)
- Work Check booking flow (from Work Check Booking PRD)
- User authentication system (existing)
- Credits/tokens API (existing)
- Work Check groups API (new)

---

## 2. User Flow

### 2.1 Entry Point

```
Login → Dashboard (NEW) → Book Mock Exams OR Book Work Checks
                       → View All Activities
```

### 2.2 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                           [User: John Doe PREP001]│
│  Welcome back! Here's what's happening this week.                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  THIS WEEK'S ACTIVITIES                            [View All →]         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │ 📅 TODAY - Monday, Feb 10                                       │   ││
│  │  │  ┌──────────────────────────────────────────────────────────┐   │   ││
│  │  │  │ 🧪 Clinical Skills Mock │ 9:00 AM - 5:30 PM │ Toronto    │   │   ││
│  │  │  │ Status: Confirmed ✓                                      │   │   ││
│  │  │  └──────────────────────────────────────────────────────────┘   │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │ 📅 Wednesday, Feb 12                                            │   ││
│  │  │  ┌──────────────────────────────────────────────────────────┐   │   ││
│  │  │  │ 🔧 Work Check │ 10:00 AM │ Dr. Ahmad │ Room 301         │   │   ││
│  │  │  │ Status: Pending ⏳  │ Group: 260128AMGR1                 │   │   ││
│  │  │  └──────────────────────────────────────────────────────────┘   │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │ 📅 Friday, Feb 14                                               │   ││
│  │  │  ┌──────────────────────────────────────────────────────────┐   │   ││
│  │  │  │ 📝 Situational Judgment │ 1:00 PM - 3:30 PM │ Vancouver  │   │   ││
│  │  │  │ Status: Confirmed ✓                                      │   │   ││
│  │  │  └──────────────────────────────────────────────────────────┘   │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  [No more activities this week]                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  BOOK A SESSION                                                         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                         ││
│  │  ┌───────────────────────────┐   ┌───────────────────────────┐         ││
│  │  │                           │   │                           │         ││
│  │  │  📚 MOCK EXAMS            │   │  🔧 WORK CHECKS           │         ││
│  │  │                           │   │                           │         ││
│  │  │  Practice your clinical   │   │  Schedule time with your  │         ││
│  │  │  and situational skills   │   │  instructor for work      │         ││
│  │  │  with full mock exams.    │   │  check sessions.          │         ││
│  │  │                           │   │                           │         ││
│  │  │  Available Tokens:        │   │  Your Groups:             │         ││
│  │  │  • SJ: 3 tokens           │   │  • 260128AMGR1            │         ││
│  │  │  • CS: 2 tokens           │   │  • 260128PMGR2            │         ││
│  │  │  • Mini: 5 tokens         │   │                           │         ││
│  │  │  • Shared: 1 token        │   │                           │         ││
│  │  │                           │   │                           │         ││
│  │  │  [Book Mock Exam →]       │   │  [Book Work Check →]      │         ││
│  │  │                           │   │                           │         ││
│  │  └───────────────────────────┘   └───────────────────────────┘         ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Empty States

#### No Activities This Week
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THIS WEEK'S ACTIVITIES                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │           📭                                                            ││
│  │                                                                         ││
│  │           No activities scheduled this week                             ││
│  │                                                                         ││
│  │           Book a mock exam or work check to get started!                ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

#### No Groups (Work Check Card)
```
┌───────────────────────────┐
│  🔧 WORK CHECKS           │
│                           │
│  You are not currently    │
│  enrolled in any groups.  │
│                           │
│  Contact support if you   │
│  believe this is an error.│
│                           │
│  [Contact Support]        │
└───────────────────────────┘
```

#### No Tokens (Mock Exam Card)
```
┌───────────────────────────┐
│  📚 MOCK EXAMS            │
│                           │
│  You don't have any       │
│  tokens available.        │
│                           │
│  Purchase tokens to       │
│  book mock exams.         │
│                           │
│  [Purchase Tokens]        │
└───────────────────────────┘
```

---

## 3. Data Requirements

### 3.1 Dashboard Data Structure

```typescript
interface DashboardData {
  user: {
    student_id: string;       // e.g., "PREP001"
    student_uuid: string;     // Supabase UUID
    firstname: string;
    lastname: string;
    email: string;
  };

  activities: {
    this_week: Activity[];    // Sorted by date/time
  };

  tokens: {
    sj_credits: number;
    cs_credits: number;
    sjmini_credits: number;
    mock_discussion_token: number;
    shared_mock_credits: number;
  };

  groups: {
    group_id: string;
    group_name: string;
    status: 'active' | 'completed' | 'removed';
  }[];
}

interface Activity {
  id: string;
  type: 'mock_exam' | 'work_check';
  date: string;               // YYYY-MM-DD
  start_time: string;         // HH:MM
  end_time?: string;          // HH:MM (for mock exams)
  status: 'pending' | 'confirmed' | 'cancelled';

  // Mock exam specific
  mock_type?: 'Situational Judgment' | 'Clinical Skills' | 'Mini-mock';
  location?: string;

  // Work check specific
  instructor_name?: string;
  group_id?: string;
  room?: string;
}
```

### 3.2 Week Range Calculation

```javascript
// Get start of current week (Monday) and end of week (Sunday)
function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}
```

---

## 4. API Specification

### 4.1 Endpoints Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/dashboard` | Get unified dashboard data | Session (student_id + email) |

### 4.2 GET `/api/dashboard`

**Purpose:** Fetch all dashboard data in a single request to minimize API calls.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `student_id` | string | Yes | From session |
| `email` | string | Yes | From session |

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "student_id": "PREP001",
      "student_uuid": "uuid-...",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com"
    },
    "activities": {
      "this_week": [
        {
          "id": "uuid-...",
          "type": "mock_exam",
          "date": "2026-02-10",
          "start_time": "09:00",
          "end_time": "17:30",
          "status": "confirmed",
          "mock_type": "Clinical Skills",
          "location": "Toronto"
        },
        {
          "id": "uuid-...",
          "type": "work_check",
          "date": "2026-02-12",
          "start_time": "10:00",
          "status": "pending",
          "instructor_name": "Dr. Ahmad Judeh",
          "group_id": "260128AMGR1",
          "room": "Room 301"
        }
      ],
      "has_today": true,
      "total_this_week": 3
    },
    "tokens": {
      "sj_credits": 3,
      "cs_credits": 2,
      "sjmini_credits": 5,
      "mock_discussion_token": 1,
      "shared_mock_credits": 1,
      "total_available": 12
    },
    "groups": [
      {
        "group_id": "260128AMGR1",
        "group_name": "January 28 AM Group 1",
        "status": "active"
      },
      {
        "group_id": "260128PMGR2",
        "group_name": "January 28 PM Group 2",
        "status": "active"
      }
    ],
    "has_active_groups": true
  }
}
```

**Business Logic:**
1. Validate session credentials
2. Fetch user info from `hubspot_contact_credits`
3. Calculate week range (Monday to Sunday)
4. Fetch mock exam bookings for this week
5. Fetch work check bookings for this week
6. Merge and sort activities by date/time
7. Fetch token balances
8. Fetch active groups from `groups_students`
9. Return unified response

**Implementation Notes:**
- Use parallel queries for efficiency (Promise.all)
- Cache user data in Redis (5 min TTL) to reduce DB calls
- Activities sorted: earliest first, today highlighted

---

## 5. Frontend Architecture

### 5.1 File Structure

```
user_root/frontend/src/
├── components/
│   └── dashboard/
│       ├── Dashboard.jsx              # Main dashboard page
│       ├── ThisWeekActivities.jsx     # Activities section
│       ├── ActivityCard.jsx           # Individual activity display
│       ├── BookingWizard.jsx          # Two-card wizard section
│       ├── MockExamCard.jsx           # Mock exam booking card
│       └── WorkCheckCard.jsx          # Work check booking card
├── hooks/
│   └── useDashboard.js                # Dashboard data fetching hook
├── services/
│   └── (add to api.js)                # Dashboard API method
└── pages/
    └── Dashboard.jsx                  # Route component (if using pages dir)
```

### 5.2 Component Hierarchy

```
Dashboard.jsx
├── Header (Welcome message + user info)
├── ThisWeekActivities.jsx
│   ├── ActivityCard.jsx (repeated for each activity)
│   │   ├── MockExamActivity (if type === 'mock_exam')
│   │   └── WorkCheckActivity (if type === 'work_check')
│   └── EmptyState (if no activities)
└── BookingWizard.jsx
    ├── MockExamCard.jsx
    │   ├── Token display
    │   └── [Book Mock Exam] button
    └── WorkCheckCard.jsx
        ├── Groups display
        └── [Book Work Check] button
```

### 5.3 Dashboard Component

```jsx
/**
 * Dashboard.jsx
 * Main dashboard page - new home after login
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '../../utils/auth';
import { useDashboard } from '../../hooks/useDashboard';
import ThisWeekActivities from './ThisWeekActivities';
import BookingWizard from './BookingWizard';
import { ResponsiveLogo } from '../shared/Logo';

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

  return (
    <div className="bg-gray-50 dark:bg-dark-bg min-h-full">
      <div className="container-brand py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-headline text-h1 font-bold text-primary-900 dark:text-gray-100">
            Welcome back, {data.user.firstname}!
          </h1>
          <p className="font-body text-lg text-primary-700 dark:text-gray-300 mt-2">
            Here's what's happening this week.
          </p>
        </div>

        {/* This Week's Activities */}
        <ThisWeekActivities
          activities={data.activities.this_week}
          hasToday={data.activities.has_today}
        />

        {/* Booking Wizard */}
        <BookingWizard
          tokens={data.tokens}
          groups={data.groups}
          hasActiveGroups={data.has_active_groups}
        />
      </div>
    </div>
  );
};

export default Dashboard;
```

### 5.4 ThisWeekActivities Component

```jsx
/**
 * ThisWeekActivities.jsx
 * Shows upcoming activities for the current week
 */
import { useNavigate } from 'react-router-dom';
import ActivityCard from './ActivityCard';
import { CalendarIcon, ArrowRightIcon } from 'lucide-react';

const ThisWeekActivities = ({ activities, hasToday }) => {
  const navigate = useNavigate();

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = activity.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedActivities).sort();

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <div className="card dark:bg-dark-card dark:border-dark-border mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="font-headline text-h3 font-semibold text-primary-900 dark:text-gray-100">
            This Week's Activities
          </h2>
        </div>
        <button
          onClick={() => navigate('/my-bookings')}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          View All
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <EmptyActivities />
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date Header */}
              <div className={`flex items-center gap-2 mb-3 ${
                isToday(date) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                <span className="text-sm font-medium uppercase">
                  {isToday(date) ? '📅 TODAY - ' : '📅 '}
                  {formatDate(date)}
                </span>
                {isToday(date) && (
                  <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>

              {/* Activities for this date */}
              <div className="space-y-3">
                {groupedActivities[date].map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyActivities = () => (
  <div className="text-center py-12">
    <div className="text-4xl mb-4">📭</div>
    <p className="text-gray-600 dark:text-gray-400 mb-2">
      No activities scheduled this week
    </p>
    <p className="text-sm text-gray-500 dark:text-gray-500">
      Book a mock exam or work check to get started!
    </p>
  </div>
);

export default ThisWeekActivities;
```

### 5.5 BookingWizard Component

```jsx
/**
 * BookingWizard.jsx
 * Two-card wizard for booking Mock Exams or Work Checks
 */
import { useNavigate } from 'react-router-dom';
import MockExamCard from './MockExamCard';
import WorkCheckCard from './WorkCheckCard';

const BookingWizard = ({ tokens, groups, hasActiveGroups }) => {
  const navigate = useNavigate();

  const handleBookMockExam = () => {
    navigate('/book/exam-types');
  };

  const handleBookWorkCheck = () => {
    navigate('/book/work-check');
  };

  const totalTokens = tokens.sj_credits + tokens.cs_credits +
                      tokens.sjmini_credits + tokens.shared_mock_credits;

  return (
    <div className="mb-8">
      <h2 className="font-headline text-h3 font-semibold text-primary-900 dark:text-gray-100 mb-6">
        Book a Session
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MockExamCard
          tokens={tokens}
          totalTokens={totalTokens}
          onBook={handleBookMockExam}
        />
        <WorkCheckCard
          groups={groups}
          hasActiveGroups={hasActiveGroups}
          onBook={handleBookWorkCheck}
        />
      </div>
    </div>
  );
};

export default BookingWizard;
```

### 5.6 MockExamCard Component

```jsx
/**
 * MockExamCard.jsx
 * Card for booking mock exams with token display
 */
import { BookOpenIcon, ArrowRightIcon } from 'lucide-react';

const MockExamCard = ({ tokens, totalTokens, onBook }) => {
  const hasTokens = totalTokens > 0;

  return (
    <div className="card-hover dark:bg-dark-card dark:border-dark-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
          <BookOpenIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="font-headline text-lg font-semibold text-primary-900 dark:text-gray-100">
          Mock Exams
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Practice your clinical and situational skills with full mock exams.
      </p>

      {hasTokens ? (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
              Available Tokens
            </p>
            <div className="space-y-1 text-sm">
              {tokens.sj_credits > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Situational Judgment:</span>
                  <span className="font-medium text-primary-700 dark:text-primary-300">{tokens.sj_credits}</span>
                </div>
              )}
              {tokens.cs_credits > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Clinical Skills:</span>
                  <span className="font-medium text-primary-700 dark:text-primary-300">{tokens.cs_credits}</span>
                </div>
              )}
              {tokens.sjmini_credits > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Mini-mock:</span>
                  <span className="font-medium text-primary-700 dark:text-primary-300">{tokens.sjmini_credits}</span>
                </div>
              )}
              {tokens.shared_mock_credits > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Shared:</span>
                  <span className="font-medium text-primary-700 dark:text-primary-300">{tokens.shared_mock_credits}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onBook}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Book Mock Exam
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400 mb-3">
            You don't have any tokens available.
          </p>
          <button className="btn-outline w-full">
            Purchase Tokens
          </button>
        </div>
      )}
    </div>
  );
};

export default MockExamCard;
```

### 5.7 WorkCheckCard Component

```jsx
/**
 * WorkCheckCard.jsx
 * Card for booking work checks with group display
 */
import { WrenchIcon, ArrowRightIcon } from 'lucide-react';

const WorkCheckCard = ({ groups, hasActiveGroups, onBook }) => {
  const activeGroups = groups.filter(g => g.status === 'active');

  return (
    <div className="card-hover dark:bg-dark-card dark:border-dark-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center">
          <WrenchIcon className="h-6 w-6 text-success-600 dark:text-success-400" />
        </div>
        <h3 className="font-headline text-lg font-semibold text-primary-900 dark:text-gray-100">
          Work Checks
        </h3>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Schedule time with your instructor for work check sessions.
      </p>

      {hasActiveGroups ? (
        <>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
              Your Groups
            </p>
            <div className="flex flex-wrap gap-2">
              {activeGroups.slice(0, 3).map(group => (
                <span
                  key={group.group_id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300"
                >
                  {group.group_id}
                </span>
              ))}
              {activeGroups.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{activeGroups.length - 3} more
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onBook}
            className="btn-primary w-full flex items-center justify-center gap-2 bg-success-600 hover:bg-success-700"
          >
            Book Work Check
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400 mb-3">
            You are not currently enrolled in any groups.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Contact support if you believe this is an error.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkCheckCard;
```

### 5.8 useDashboard Hook

```javascript
/**
 * useDashboard.js
 * Hook for fetching and managing dashboard data
 */
import { useState, useEffect, useCallback } from 'react';
import { getUserSession } from '../utils/auth';
import apiService from '../services/api';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    const session = getUserSession();
    if (!session) {
      setError({ code: 'NOT_AUTHENTICATED', message: 'Please log in' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.dashboard.get(
        session.studentId,
        session.email
      );

      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError({
        code: err.code || 'FETCH_ERROR',
        message: err.message || 'Failed to load dashboard'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refresh: fetchDashboard
  };
}
```

---

## 6. API Implementation

### 6.1 Backend Endpoint

**File:** `user_root/api/dashboard.js`

```javascript
/**
 * GET /api/dashboard
 * Unified dashboard data endpoint
 */

const { schemas } = require('./_shared/validation');
const { supabaseAdmin } = require('./_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  try {
    // Validate query parameters
    const { error, value } = schemas.authCheck.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { student_id, email } = value;

    // 1. Validate user and get basic info
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('hubspot_contact_credits')
      .select('id, hubspot_id, student_id, email, firstname, lastname, sj_credits, cs_credits, sjmini_credits, mock_discussion_token, shared_mock_credits')
      .eq('student_id', student_id)
      .ilike('email', email)
      .single();

    if (contactError || !contact) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Invalid credentials' }
      });
    }

    // 2. Calculate week range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // 3. Fetch this week's activities in parallel
    const [mockBookingsResult, workCheckBookingsResult, groupsResult] = await Promise.all([
      // Mock exam bookings
      supabaseAdmin
        .from('hubspot_bookings')
        .select('id, exam_date, start_time, end_time, mock_type, attending_location, is_active')
        .eq('student_id', contact.student_id)
        .gte('exam_date', weekStart)
        .lte('exam_date', weekEnd)
        .in('is_active', ['Active', 'Completed']),

      // Work check bookings
      supabaseAdmin
        .from('work_check_bookings')
        .select(`
          id, status, created_at,
          work_check_slots!inner (
            slot_date, slot_time, duration_minutes, location,
            instructors ( instructor_name ),
            group_id
          )
        `)
        .eq('student_id', contact.student_id)
        .gte('work_check_slots.slot_date', weekStart)
        .lte('work_check_slots.slot_date', weekEnd)
        .in('status', ['pending', 'confirmed']),

      // User's groups
      supabaseAdmin
        .from('groups_students')
        .select(`
          group_id, status,
          groups ( group_id, group_name, status )
        `)
        .eq('student_id', contact.student_id)
        .eq('status', 'active')
    ]);

    // 4. Transform activities
    const mockActivities = (mockBookingsResult.data || []).map(b => ({
      id: b.id,
      type: 'mock_exam',
      date: b.exam_date,
      start_time: b.start_time?.substring(0, 5),
      end_time: b.end_time?.substring(0, 5),
      status: 'confirmed',
      mock_type: b.mock_type,
      location: b.attending_location
    }));

    const workCheckActivities = (workCheckBookingsResult.data || []).map(b => ({
      id: b.id,
      type: 'work_check',
      date: b.work_check_slots.slot_date,
      start_time: b.work_check_slots.slot_time?.substring(0, 5),
      status: b.status,
      instructor_name: b.work_check_slots.instructors?.instructor_name,
      group_id: b.work_check_slots.group_id?.[0], // First group
      room: b.work_check_slots.location
    }));

    // Merge and sort activities
    const allActivities = [...mockActivities, ...workCheckActivities]
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });

    // 5. Transform groups
    const groups = (groupsResult.data || [])
      .filter(g => g.groups?.status === 'active')
      .map(g => ({
        group_id: g.groups.group_id,
        group_name: g.groups.group_name,
        status: g.status
      }));

    // 6. Build response
    return res.status(200).json({
      success: true,
      data: {
        user: {
          student_id: contact.student_id,
          student_uuid: contact.id,
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email
        },
        activities: {
          this_week: allActivities,
          has_today: allActivities.some(a => a.date === today),
          total_this_week: allActivities.length
        },
        tokens: {
          sj_credits: contact.sj_credits || 0,
          cs_credits: contact.cs_credits || 0,
          sjmini_credits: contact.sjmini_credits || 0,
          mock_discussion_token: contact.mock_discussion_token || 0,
          shared_mock_credits: contact.shared_mock_credits || 0,
          total_available: (contact.sj_credits || 0) + (contact.cs_credits || 0) +
                          (contact.sjmini_credits || 0) + (contact.shared_mock_credits || 0)
        },
        groups: groups,
        has_active_groups: groups.length > 0
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to load dashboard' }
    });
  }
};
```

---

## 7. Routing Updates

### 7.1 App.jsx Changes

```jsx
// Add import
import Dashboard from './components/dashboard/Dashboard';

// Update routes
<Routes>
  {/* Root redirect to login */}
  <Route path="/" element={<Navigate to="/login" replace />} />

  {/* Login page */}
  <Route path="/login" element={<LoginForm />} />

  {/* NEW: Dashboard - new home after login */}
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />

  {/* Mock exam booking flow */}
  <Route path="/book/exam-types" element={
    <ProtectedRoute>
      <ExamTypeSelector />
    </ProtectedRoute>
  } />
  {/* ... rest of routes ... */}

  {/* NEW: Work check booking flow */}
  <Route path="/book/work-check" element={
    <ProtectedRoute>
      <WorkCheckBookingPage />
    </ProtectedRoute>
  } />
</Routes>
```

### 7.2 LoginForm.jsx Changes

Update the redirect after successful login:

```jsx
// Change from:
navigate('/book/exam-types');

// To:
navigate('/dashboard');
```

### 7.3 SidebarNavigation Restructure

**Major change**: Restructure navigation with submenus (following admin pattern).

#### New Navigation Structure

```
┌─────────────────────────────┐
│  📊 Home (Dashboard)        │  ← Main nav item
├─────────────────────────────┤
│  📚 Mocks          [▶]      │  ← Expandable submenu
│     ├─ NDECC Exams          │
│     ├─ Mock Discussions     │
│     └─ My Bookings          │
├─────────────────────────────┤
│  🔧 Work Checks    [▶]      │  ← Expandable submenu
│     ├─ Book Work Check      │
│     └─ My Work Checks       │
└─────────────────────────────┘
```

#### Navigation Items Configuration

```jsx
// Main navigation items
const navigationItems = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: HomeIcon,
    requiresAuth: true
  }
];

// Mocks submenu items
const mocksItems = [
  {
    name: 'NDECC Exams',
    href: '/book/exam-types',
    icon: CalendarIcon
  },
  {
    name: 'Mock Discussions',
    href: '/book/discussions',
    icon: ChatBubbleIcon
  },
  {
    name: 'My Bookings',
    href: '/my-bookings',
    icon: ClipboardIcon
  }
];

// Work Checks submenu items
const workCheckItems = [
  {
    name: 'Book Work Check',
    href: '/book/work-check',
    icon: CalendarPlusIcon
  },
  {
    name: 'My Work Checks',
    href: '/my-work-checks',
    icon: ClipboardCheckIcon
  }
];
```

#### SidebarNavigation.jsx Changes

```jsx
/**
 * SidebarNavigation.jsx (User App)
 * Updated with submenu pattern matching admin sidebar
 */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserSession, clearUserSession } from '../../utils/auth';
import { ResponsiveLogo } from './Logo';
import DarkModeToggle from '../DarkModeToggle';

const SidebarNavigation = ({ isOpen, setIsOpen, className = '' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState(null);

  // Submenu state
  const [mocksOpen, setMocksOpen] = useState(false);
  const [workCheckOpen, setWorkCheckOpen] = useState(false);
  const mocksRef = useRef(null);
  const workCheckRef = useRef(null);
  const mocksTimeoutRef = useRef(null);
  const workCheckTimeoutRef = useRef(null);

  // Handle delayed close for Mocks submenu
  const handleMocksMouseLeave = () => {
    mocksTimeoutRef.current = setTimeout(() => {
      setMocksOpen(false);
    }, 200);
  };

  const handleMocksMouseEnter = () => {
    if (mocksTimeoutRef.current) {
      clearTimeout(mocksTimeoutRef.current);
      mocksTimeoutRef.current = null;
    }
  };

  // Handle delayed close for Work Check submenu
  const handleWorkCheckMouseLeave = () => {
    workCheckTimeoutRef.current = setTimeout(() => {
      setWorkCheckOpen(false);
    }, 200);
  };

  const handleWorkCheckMouseEnter = () => {
    if (workCheckTimeoutRef.current) {
      clearTimeout(workCheckTimeoutRef.current);
      workCheckTimeoutRef.current = null;
    }
  };

  // Main navigation items
  const navigationItems = [
    {
      name: 'Home',
      href: '/dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      requiresAuth: true
    }
  ];

  // Mocks submenu items
  const mocksItems = [
    {
      name: 'NDECC Exams',
      href: '/book/exam-types',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Mock Discussions',
      href: '/book/discussions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      )
    },
    {
      name: 'My Bookings',
      href: '/my-bookings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    }
  ];

  // Work Check submenu items
  const workCheckItems = [
    {
      name: 'Book Work Check',
      href: '/book/work-check',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      name: 'My Work Checks',
      href: '/my-work-checks',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    }
  ];

  // Check if path is active (for main items)
  const isActivePath = (href) => {
    return location.pathname === href;
  };

  // Check if any submenu item is active
  const isMocksActive = () => {
    return mocksItems.some(item =>
      location.pathname === item.href ||
      location.pathname.startsWith(item.href.replace('/book/', '/book/'))
    ) || location.pathname.startsWith('/booking/confirmation');
  };

  const isWorkCheckActive = () => {
    return workCheckItems.some(item =>
      location.pathname === item.href ||
      location.pathname.startsWith(item.href)
    );
  };

  // Handle navigation
  const handleNavigation = (href) => {
    navigate(href);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  // ... rest of component with submenu rendering
  // (follows same pattern as admin SidebarNavigation.jsx)

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-screen w-64 bg-white dark:bg-dark-sidebar
        border-r border-gray-200 dark:border-dark-border shadow-lg
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:shadow-none
        ${className}
      `}>
        <div className="flex flex-col h-full">
          {/* Header with Logo */}
          <div className="flex items-center justify-between p-6 pb-4">
            <ResponsiveLogo
              size="medium"
              onClick={() => handleNavigation('/dashboard')}
            />
            {/* Mobile close button */}
          </div>

          {/* User Info Section */}
          {/* ... existing user info ... */}

          {/* Navigation */}
          <nav className="flex-1 px-6 py-6 overflow-y-auto">
            <ul className="space-y-3">
              {/* Home (Dashboard) */}
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <button
                    onClick={() => handleNavigation(item.href)}
                    className={`
                      w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                      transition-all duration-200 text-left
                      ${isActivePath(item.href)
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover'
                      }
                    `}
                  >
                    <span className="mr-3">{item.icon}</span>
                    <span className="flex-1">{item.name}</span>
                  </button>
                </li>
              ))}

              {/* Mocks Menu with Submenu */}
              <li
                ref={mocksRef}
                className="relative"
                onMouseEnter={handleMocksMouseEnter}
                onMouseLeave={handleMocksMouseLeave}
              >
                <button
                  onClick={() => setMocksOpen(!mocksOpen)}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${mocksOpen || isMocksActive()
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                  `}
                >
                  <span className="mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </span>
                  <span className="flex-1">Mocks</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${mocksOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Mocks Submenu Dropdown */}
                {mocksOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleMocksMouseEnter}
                    onMouseLeave={handleMocksMouseLeave}
                  >
                    <div className="py-2">
                      {mocksItems.map((subItem) => (
                        <button
                          key={subItem.name}
                          onClick={() => {
                            handleNavigation(subItem.href);
                            setMocksOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-4 py-2.5 text-sm font-medium
                            transition-all duration-200 text-left
                            ${isActivePath(subItem.href)
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover'
                            }
                          `}
                        >
                          <span className="mr-3">{subItem.icon}</span>
                          <span>{subItem.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>

              {/* Work Checks Menu with Submenu */}
              <li
                ref={workCheckRef}
                className="relative"
                onMouseEnter={handleWorkCheckMouseEnter}
                onMouseLeave={handleWorkCheckMouseLeave}
              >
                <button
                  onClick={() => setWorkCheckOpen(!workCheckOpen)}
                  className={`
                    w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg
                    transition-all duration-200 text-left
                    ${workCheckOpen || isWorkCheckActive()
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }
                  `}
                >
                  <span className="mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </span>
                  <span className="flex-1">Work Checks</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${workCheckOpen ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Work Checks Submenu Dropdown */}
                {workCheckOpen && (
                  <div
                    className="fixed left-64 w-48 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100]"
                    style={{ marginTop: '-44px' }}
                    onMouseEnter={handleWorkCheckMouseEnter}
                    onMouseLeave={handleWorkCheckMouseLeave}
                  >
                    <div className="py-2">
                      {workCheckItems.map((subItem) => (
                        <button
                          key={subItem.name}
                          onClick={() => {
                            handleNavigation(subItem.href);
                            setWorkCheckOpen(false);
                          }}
                          className={`
                            w-full flex items-center px-4 py-2.5 text-sm font-medium
                            transition-all duration-200 text-left
                            ${isActivePath(subItem.href)
                              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-hover'
                            }
                          `}
                        >
                          <span className="mr-3">{subItem.icon}</span>
                          <span>{subItem.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            </ul>
          </nav>

          {/* Footer with support and logout */}
          {/* ... existing footer ... */}
        </div>
      </div>
    </>
  );
};

export default SidebarNavigation;
```

### 7.4 New Routes Required

Add these new routes to `App.jsx`:

```jsx
// Work check routes
<Route path="/book/work-check" element={
  <ProtectedRoute>
    <WorkCheckBookingPage />
  </ProtectedRoute>
} />

<Route path="/my-work-checks" element={
  <ProtectedRoute>
    <MyWorkChecks />
  </ProtectedRoute>
} />
```

### 7.5 Route Summary

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `Dashboard.jsx` | **NEW** - Home page after login |
| `/book/exam-types` | `ExamTypeSelector.jsx` | Mock exam type selection |
| `/book/exams` | `ExamSessionsList.jsx` | Mock exam sessions list |
| `/book/:mockExamId` | `BookingForm.jsx` | Mock exam booking form |
| `/book/discussions` | `MockDiscussions.jsx` | Mock discussions booking |
| `/my-bookings` | `MyBookings.jsx` | User's mock exam bookings |
| `/book/work-check` | `WorkCheckBookingPage.jsx` | **NEW** - Work check booking |
| `/my-work-checks` | `MyWorkChecks.jsx` | **NEW** - User's work check bookings |

---

## 8. Validation Schema

Add to `user_root/api/_shared/validation.js`:

```javascript
// Dashboard uses existing authCheck schema
// No new schema needed since we're just validating student_id + email
```

---

## 9. Implementation Checklist

### Phase 1: Backend API (0.5 day)
- [ ] Create `/api/dashboard.js` endpoint
- [ ] Test with mock data
- [ ] Handle edge cases (no bookings, no groups)

### Phase 2: Dashboard Components (1 day)
- [ ] Create `Dashboard.jsx` main component
- [ ] Create `ThisWeekActivities.jsx`
- [ ] Create `ActivityCard.jsx`
- [ ] Create `BookingWizard.jsx`
- [ ] Create `MockExamCard.jsx`
- [ ] Create `WorkCheckCard.jsx`
- [ ] Create `useDashboard.js` hook
- [ ] Add dashboard API method to `api.js`
- [ ] Add loading skeleton

### Phase 3: Navigation Restructure (1 day)
- [ ] Update `SidebarNavigation.jsx` with submenu pattern
- [ ] Add Mocks submenu (NDECC Exams, Mock Discussions, My Bookings)
- [ ] Add Work Checks submenu (Book Work Check, My Work Checks)
- [ ] Implement hover-to-close behavior for submenus
- [ ] Add active state detection for submenu items
- [ ] Test submenu on mobile (responsive behavior)
- [ ] Update logo click to navigate to `/dashboard`

### Phase 4: Routing Integration (0.5 day)
- [ ] Add `/dashboard` route to `App.jsx`
- [ ] Add `/my-work-checks` route to `App.jsx`
- [ ] Update `LoginForm.jsx` to redirect to `/dashboard`
- [ ] Update any hardcoded redirects to `/book/exam-types`
- [ ] Test complete navigation flow

### Phase 5: Polish (0.5 day)
- [ ] Add animations (fade-in, slide-up)
- [ ] Test dark mode for all new components
- [ ] Test responsive layout (mobile/tablet/desktop)
- [ ] Test empty states
- [ ] Test error handling
- [ ] Verify submenu z-index works correctly

---

## 10. Success Criteria

### Dashboard
1. Users land on Dashboard after login (not ExamTypeSelector)
2. This Week's Activities shows both mock exams and work checks
3. Activities are grouped by date with today highlighted
4. Booking wizard shows correct token counts
5. Booking wizard shows user's active groups
6. Empty states display correctly
7. Dashboard refreshes every 60 seconds

### Navigation
8. Sidebar shows: Home, Mocks (submenu), Work Checks (submenu)
9. Mocks submenu contains: NDECC Exams, Mock Discussions, My Bookings
10. Work Checks submenu contains: Book Work Check, My Work Checks
11. Submenus open on click and close on hover-out (with delay)
12. Active submenu item is highlighted correctly
13. Logo click navigates to `/dashboard`

### General
14. Dark mode works correctly on all new components
15. Mobile responsive layout works (submenus adapt)
16. All routes navigate correctly

---

## 11. Future Considerations

1. **Notifications panel** - Show confirmed/rejected booking alerts
2. **Quick actions** - Cancel booking directly from dashboard
3. **Week navigation** - View previous/next weeks
4. **Calendar export** - Add activities to Google Calendar
5. **Activity details** - Click to expand full details
6. **Real-time updates** - WebSocket for instant status changes

---

## 12. Security Considerations

1. **Session validation** - All data requires valid session
2. **Data isolation** - Users only see their own data
3. **No sensitive data exposure** - Limited fields in response
4. **Rate limiting** - Dashboard endpoint rate limited

---

## Sign-off

- [ ] Technical Review: Backend Lead
- [ ] UX Review: Product Designer
- [ ] Security Review: Security Team
- [ ] Stakeholder Approval: Product Owner

**Status**: Draft
**Risk Level**: Low
**Priority**: High
