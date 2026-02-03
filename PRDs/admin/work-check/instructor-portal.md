# PRD: Instructor Portal (Dashboard)

**Version:** 1.0.0
**Created:** January 27, 2026
**Status:** Draft
**Confidence Score:** 8/10
**Estimated Effort:** 2-3 days

---

## 1. Overview

### 1.1 Purpose
Provide instructors with a dedicated dashboard within the admin portal where they can view their assigned groups, trainees, and upcoming instruction schedules. The portal is read-only and provides instructors visibility into their teaching assignments.

### 1.2 Key Requirement: Role-Based Routing
**CRITICAL**: When a user logs in with the `instructor` role, they should **ONLY** have access to the instructor dashboard and related routes. They should NOT see or access admin features like Mock Exams management, Bulk Bookings, etc.

### 1.3 Scope
- Instructor role in authentication system
- Role-based routing and navigation
- Instructor-specific API endpoints
- Instructor dashboard UI
- My Groups view
- Upcoming Schedule view

### 1.4 Out of Scope
- Instructor CRUD management (covered in Instructor Management PRD)
- Work checks system (future PRD)
- Work check booking system (future PRD)
- Group-instructor assignments (covered in Group Management PRD)

---

## 2. Authentication & Authorization

### 2.1 Existing Middleware (USE THESE)

**IMPORTANT**: The following middleware already exists and should be reused:

| File | Function | Usage |
|------|----------|-------|
| `requireAuth.js` | `requireAuth(req)` | Verifies JWT token, returns user |
| `requireRole.js` | `requireRole(req, allowedRoles)` | Verifies user has specific role(s) |

**Existing `requireRole` implementation** (from `admin_root/api/admin/middleware/requireRole.js`):
```javascript
async function requireRole(req, allowedRoles) {
  const user = await requireAuth(req);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRole = user.user_role || 'viewer';
  if (!roles.includes(userRole)) {
    const error = new Error(`Role required: ${roles.join(' or ')}`);
    error.statusCode = 403;
    throw error;
  }
  return user;
}
```

### 2.2 User Role System

The system will use the `user_role` claim from JWT tokens to determine user access:

| Role | Access Level | Dashboard |
|------|--------------|-----------|
| `admin` | Full admin access | Admin Dashboard (Mock Exams, Trainees, etc.) |
| `instructor` | Instructor-only access | Instructor Dashboard (Groups, Schedule) |
| `viewer` | Default role (legacy) | Same as admin (backward compatibility) |

### 2.3 JWT Claims Structure

The Supabase JWT token will include role information via `verifyToken()` from `admin_root/api/_shared/supabase.js`:

```json
{
  "sub": "user-uuid",
  "email": "instructor@prepdoctors.com",
  "user_role": "instructor",
  "permissions": ["instructor.view_groups", "instructor.view_schedule"],
  "instructor_id": "uuid-of-instructor-record",
  "role_assigned_at": "2026-01-27T10:00:00Z"
}
```

### 2.4 Role Assignment

Instructor role is assigned when:
1. Admin creates instructor record with `auth_user_id` linked
2. System updates Supabase user's app_metadata with role claims
3. User's next login receives updated JWT with instructor role


## 3. Frontend Architecture

### 3.1 Role-Based Routing Strategy

The application will use a **route guard pattern** that redirects users based on their role:

```
Login → Check Role → Route to appropriate dashboard
         │
         ├── admin → /mock-exams (Admin Dashboard)
         │
         └── instructor → /instructor (Instructor Dashboard)
```

### 3.2 Modified File Structure

```
admin_root/admin_frontend/src/
├── App.jsx                              # Updated with role-based routing
├── components/
│   ├── admin/
│   │   ├── ProtectedAdminRoute.jsx      # Updated: admin-only routes
│   │   └── ProtectedInstructorRoute.jsx # NEW: instructor-only routes
│   └── layout/
│       ├── MainLayout.jsx               # Admin layout (existing)
│       └── InstructorLayout.jsx         # NEW: Instructor layout
├── pages/
│   └── instructor/                      # NEW: Instructor pages
│       ├── InstructorDashboard.jsx
│       ├── InstructorGroups.jsx
│       └── InstructorSchedule.jsx
├── hooks/
│   └── useInstructorData.js             # NEW: Instructor data hooks
└── services/
    └── instructorPortalService.js       # NEW: Instructor API service
```

### 3.3 Updated App.jsx Structure

```jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Layouts
import MainLayout from './components/layout/MainLayout';
import InstructorLayout from './components/layout/InstructorLayout';

// Route Guards
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';
import ProtectedInstructorRoute from './components/admin/ProtectedInstructorRoute';

// Pages
import Login from './pages/Login';
// ... admin pages
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import InstructorGroups from './pages/instructor/InstructorGroups';
import InstructorSchedule from './pages/instructor/InstructorSchedule';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<PasswordReset />} />

          {/* Role-Based Redirect */}
          <Route path="/" element={<RoleBasedRedirect />} />

          {/* Admin Routes - Only accessible by admin role */}
          <Route element={<ProtectedAdminRoute><MainLayout /></ProtectedAdminRoute>}>
            <Route path="mock-exams" element={<MockExamsDashboard />} />
            <Route path="mock-exams/create" element={<MockExams />} />
            <Route path="mock-exams/:id" element={<MockExamDetail />} />
            <Route path="trainees" element={<TraineeDashboard />} />
            <Route path="instructors" element={<Instructors />} />
            {/* ... other admin routes */}
          </Route>

          {/* Instructor Routes - Only accessible by instructor role */}
          <Route element={<ProtectedInstructorRoute><InstructorLayout /></ProtectedInstructorRoute>}>
            <Route path="instructor" element={<InstructorDashboard />} />
            <Route path="instructor/groups" element={<InstructorGroups />} />
            <Route path="instructor/schedule" element={<InstructorSchedule />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

// Role-based redirect component
function RoleBasedRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  const userRole = user.user_role || 'admin';

  if (userRole === 'instructor') {
    return <Navigate to="/instructor" replace />;
  }

  return <Navigate to="/mock-exams" replace />;
}
```

### 3.4 ProtectedInstructorRoute Component

```jsx
/**
 * Protected Instructor Route Component
 * Only allows users with 'instructor' role to access
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ProtectedInstructorRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has instructor role
  const userRole = user.user_role || user.app_metadata?.user_role;

  if (userRole !== 'instructor') {
    // Non-instructors trying to access instructor routes
    // Redirect to their appropriate dashboard
    return <Navigate to="/mock-exams" replace />;
  }

  return children;
};

export default ProtectedInstructorRoute;
```

### 3.5 Updated ProtectedAdminRoute Component

```jsx
/**
 * Protected Admin Route Component
 * Only allows users with 'admin' role (or no role = legacy admin)
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check user role - allow admin or undefined (legacy users)
  const userRole = user.user_role || user.app_metadata?.user_role;

  if (userRole === 'instructor') {
    // Instructors should not access admin routes
    return <Navigate to="/instructor" replace />;
  }

  // Admin or legacy users (no role) can access
  return children;
};

export default ProtectedAdminRoute;
```

---

## 4. API Specification

### 4.1 Endpoints Overview

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/instructor/me` | Get current instructor profile | `instructor.*` |
| GET | `/api/admin/instructor/dashboard/stats` | Dashboard statistics | `instructor.view_groups` |
| GET | `/api/admin/instructor/groups` | List assigned groups | `instructor.view_groups` |
| GET | `/api/admin/instructor/groups/:groupId` | Get group details with trainees | `instructor.view_groups` |
| GET | `/api/admin/instructor/schedule` | Upcoming instruction schedule | `instructor.view_schedule` |

### 4.2 Endpoint Details

#### GET `/api/admin/instructor/me` - Get Instructor Profile

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "instructor-uuid",
    "instructor_name": "Dr. Ahmad Judeh",
    "email": "ahmad.judeh@prepdoctors.com",
    "is_active": true
  }
}
```

#### GET `/api/admin/instructor/dashboard/stats` - Dashboard Stats

**Response:**
```json
{
  "success": true,
  "data": {
    "assigned_groups": 3,
    "total_trainees": 45,
    "active_groups": 2,
    "upcoming_sessions": 5,
    "next_session": {
      "date": "2026-01-28",
      "group_name": "260128AMGR1",
      "trainee_count": 15
    }
  }
}
```

#### GET `/api/admin/instructor/groups` - List Assigned Groups

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | 'active' | Filter: 'active', 'completed', 'all' |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "group_id": "260128AMGR1",
      "group_name": "January 28 AM Group 1",
      "time_period": "AM",
      "start_date": "2026-01-28",
      "end_date": "2026-03-15",
      "status": "active",
      "trainee_count": 15,
      "total_instruction_days": 8,
      "next_instruction_date": "2026-01-30"
    }
  ]
}
```

#### GET `/api/admin/instructor/groups/:groupId` - Group Details

**Response:**
```json
{
  "success": true,
  "data": {
    "group_id": "260128AMGR1",
    "group_name": "January 28 AM Group 1",
    "time_period": "AM",
    "start_date": "2026-01-28",
    "end_date": "2026-03-15",
    "status": "active",
    "instruction_dates": [
      { "date": "2026-01-28", "day_of_week": "Wednesday" },
      { "date": "2026-01-30", "day_of_week": "Friday" }
    ],
    "trainees": [
      {
        "student_id": "trainee-uuid",
        "firstname": "John",
        "lastname": "Doe",
        "email": "john.doe@example.com"
      }
    ]
  }
}
```

#### GET `/api/admin/instructor/schedule` - Upcoming Schedule

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 30 | Number of days to look ahead |
| `limit` | integer | 20 | Max results |

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "date": "2026-01-28",
        "day_of_week": "Wednesday",
        "groups": [
          {
            "group_id": "260128AMGR1",
            "group_name": "January 28 AM Group 1",
            "time_period": "AM",
            "trainee_count": 15
          }
        ]
      },
      {
        "date": "2026-01-30",
        "day_of_week": "Friday",
        "groups": [
          {
            "group_id": "260128AMGR1",
            "group_name": "January 28 AM Group 1",
            "time_period": "AM",
            "trainee_count": 15
          }
        ]
      }
    ],
    "total_sessions": 5
  }
}
```

---

## 4B. Frontend Service & Hooks (Architecture Alignment)

### 4B.1 Service Integration (add to adminApi.js)

Following the existing axios service pattern in `admin_root/admin_frontend/src/services/adminApi.js`:

```javascript
// Add to adminApi.js - Instructor Portal API
export const instructorPortalApi = {
  // Get current instructor's profile
  getMe: async () => {
    const response = await api.get('/admin/instructor/me');
    return response.data;
  },

  // Get dashboard statistics
  getDashboardStats: async () => {
    const response = await api.get('/admin/instructor/dashboard/stats');
    return response.data;
  },

  // List assigned groups
  listGroups: async (params = {}) => {
    const response = await api.get('/admin/instructor/groups', { params });
    return response.data;
  },

  // Get group details with trainees
  getGroup: async (groupId) => {
    const response = await api.get(`/admin/instructor/groups/${groupId}`);
    return response.data;
  },

  // Get upcoming schedule
  getSchedule: async (params = {}) => {
    const response = await api.get('/admin/instructor/schedule', { params });
    return response.data;
  }
};
```

### 4B.2 TanStack Query Hooks (create useInstructorPortalData.js)

Following the existing hook pattern from `admin_root/admin_frontend/src/hooks/useMockExamsData.js`:

```javascript
// admin_root/admin_frontend/src/hooks/useInstructorPortalData.js
import { useQuery } from '@tanstack/react-query';
import { instructorPortalApi } from '../services/adminApi';

/**
 * Hook for fetching instructor profile
 */
export function useInstructorProfile(options = {}) {
  return useQuery({
    queryKey: ['instructor', 'me'],
    queryFn: () => instructorPortalApi.getMe(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching instructor dashboard stats
 */
export function useInstructorDashboardStats(options = {}) {
  return useQuery({
    queryKey: ['instructor', 'dashboard-stats'],
    queryFn: () => instructorPortalApi.getDashboardStats(),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    ...options
  });
}

/**
 * Hook for fetching instructor's assigned groups
 */
export function useInstructorGroups(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'groups', JSON.stringify(params)],
    queryFn: () => instructorPortalApi.listGroups(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching a specific group's details
 */
export function useInstructorGroupDetail(groupId, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'groups', groupId],
    queryFn: () => instructorPortalApi.getGroup(groupId),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook for fetching instructor's upcoming schedule
 */
export function useInstructorSchedule(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructor', 'schedule', JSON.stringify(params)],
    queryFn: () => instructorPortalApi.getSchedule(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    ...options
  });
}
```

### 4B.3 Validation Schemas (add to validation.js)

Following the existing Joi schema pattern in `admin_root/api/_shared/validation.js`:

```javascript
// Add to schemas object in validation.js

instructorGroupsList: Joi.object({
  status: Joi.string()
    .valid('active', 'completed', 'all')
    .optional()
    .default('active')
    .messages({
      'any.only': 'Status must be one of: active, completed, all'
    })
}),

instructorSchedule: Joi.object({
  days: Joi.number()
    .integer()
    .min(1)
    .max(90)
    .optional()
    .default(30)
    .messages({
      'number.base': 'Days must be a number',
      'number.integer': 'Days must be an integer',
      'number.min': 'Days must be at least 1',
      'number.max': 'Days cannot exceed 90'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
})
```

---

## 5. Frontend Components

### 5.1 InstructorLayout.jsx

Simplified layout for instructors with limited navigation:

```jsx
const InstructorLayout = () => {
  const { user, signOut } = useAuth();

  const navigation = [
    { name: 'Dashboard', path: '/instructor', icon: HomeIcon },
    { name: 'My Groups', path: '/instructor/groups', icon: UserGroupIcon },
    { name: 'Schedule', path: '/instructor/schedule', icon: CalendarIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="text-sm text-gray-500">Instructor Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, {user?.first_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b px-6 py-2">
        <div className="flex gap-6">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
};
```

### 5.2 InstructorDashboard.jsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Welcome back, Ahmad!                                           │
│  Here's your teaching overview                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 3            │ │ 45           │ │ 5            │            │
│  │ Active       │ │ Total        │ │ Upcoming     │            │
│  │ Groups       │ │ Trainees     │ │ Sessions     │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│  Next Session                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Wednesday, January 28, 2026                                 ││
│  │ Group: 260128AMGR1 (AM)                                     ││
│  │ 15 trainees                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  My Active Groups                              [View All →]     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Group           │ Time   │ Start Date │ Trainees │ Status  ││
│  │ 260128AMGR1     │ AM     │ Jan 28     │ 15       │ Active  ││
│  │ 260128PMGR2     │ PM     │ Jan 28     │ 12       │ Active  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 InstructorGroups.jsx

```
┌─────────────────────────────────────────────────────────────────┐
│  My Groups                                                      │
│  View your assigned training groups                             │
├─────────────────────────────────────────────────────────────────┤
│  [Status: Active ▼]                                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 260128AMGR1 - January 28 AM Group 1                   [▼]  ││
│  │ AM | Jan 28 - Mar 15 | 15 trainees | Active                ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Trainees:                                                   ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ # │ Name         │ Email                  │ Seat       │ ││
│  │ │ 1 │ John Doe     │ john.doe@example.com   │ 1          │ ││
│  │ │ 2 │ Jane Smith   │ jane.smith@example.com │ 2          │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ Instruction Dates: Wed Jan 28, Fri Jan 30, Mon Feb 3...    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 260128PMGR2 - January 28 PM Group 2                   [▶]  ││
│  │ PM | Jan 28 - Mar 15 | 12 trainees | Active                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 InstructorSchedule.jsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Upcoming Schedule                                              │
│  Your instruction sessions for the next 30 days                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Wednesday, January 28, 2026                                 ││
│  │ ┌───────────────────────────────────────────────────────┐   ││
│  │ │ 260128AMGR1 | AM | 15 trainees                        │   ││
│  │ └───────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Friday, January 30, 2026                                    ││
│  │ ┌───────────────────────────────────────────────────────┐   ││
│  │ │ 260128AMGR1 | AM | 15 trainees                        │   ││
│  │ │ 260128PMGR2 | PM | 12 trainees                        │   ││
│  │ └───────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Monday, February 3, 2026                                    ││
│  │ ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API File Structure

```
admin_root/api/admin/instructor/
├── me.js              # GET /api/admin/instructor/me
├── dashboard-stats.js # GET /api/admin/instructor/dashboard/stats
├── groups/
│   ├── list.js        # GET /api/admin/instructor/groups
│   └── [groupId].js   # GET /api/admin/instructor/groups/:groupId
└── schedule.js        # GET /api/admin/instructor/schedule
```

### 6.1 Using Existing Middleware

**Use the existing `requireRole` middleware** from `admin_root/api/admin/middleware/requireRole.js`:

```javascript
/**
 * Example: me.js endpoint using existing middleware
 */
const { requireRole } = require('../middleware/requireRole');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  try {
    // Use existing requireRole middleware - requires 'instructor' role
    const user = await requireRole(req, 'instructor');

    // Get instructor_id from JWT claims
    const instructorId = user.instructor_id || user.app_metadata?.instructor_id;

    if (!instructorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSTRUCTOR_NOT_FOUND', message: 'Instructor profile not linked' }
      });
    }

    // Fetch instructor details
    const { data: instructor, error: dbError } = await supabaseAdmin
      .from('hubspot_sync.instructors')
      .select('id, instructor_name, email, is_active, auth_user_id, created_at, updated_at')
      .eq('id', instructorId)
      .eq('is_active', true)
      .single();

    if (dbError || !instructor) {
      return res.status(403).json({
        success: false,
        error: { code: 'INSTRUCTOR_INACTIVE', message: 'Instructor profile not found or inactive' }
      });
    }

    return res.status(200).json({
      success: true,
      data: instructor
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: { code: error.code || 'INTERNAL_ERROR', message: error.message }
    });
  }
};
```

### 6.2 Helper: getInstructorFromUser

For endpoints that need instructor data, create a shared helper:

```javascript
// admin_root/api/_shared/instructor-helpers.js
const { supabaseAdmin } = require('./supabase');

/**
 * Get instructor record from authenticated user
 * @param {Object} user - User object from requireRole middleware
 * @returns {Promise<Object>} instructor record
 */
async function getInstructorFromUser(user) {
  const instructorId = user.instructor_id || user.app_metadata?.instructor_id;

  if (!instructorId) {
    const error = new Error('Instructor profile not linked to user');
    error.statusCode = 403;
    error.code = 'INSTRUCTOR_NOT_FOUND';
    throw error;
  }

  const { data: instructor, error: dbError } = await supabaseAdmin
    .from('hubspot_sync.instructors')
    .select('*')
    .eq('id', instructorId)
    .eq('is_active', true)
    .single();

  if (dbError || !instructor) {
    const error = new Error('Instructor profile not found or inactive');
    error.statusCode = 403;
    error.code = 'INSTRUCTOR_INACTIVE';
    throw error;
  }

  return instructor;
}

module.exports = { getInstructorFromUser };
```

---

## 7. Database Requirements

### 7.1 Architecture Note: Instructor-Group Relationships

**IMPORTANT**: There is NO separate `groups_instructors` junction table.

The instructor-group relationship is captured through the `work_check_slots` table:

```sql
-- work_check_slots serves as the 3-way junction:
-- Instructor ↔ Groups ↔ Time Slots
CREATE TABLE hubspot_sync.work_check_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id UUID NOT NULL REFERENCES hubspot_sync.instructors(id) ON DELETE CASCADE,
    group_id VARCHAR(100)[] NOT NULL,  -- Array of group IDs that can book this slot
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    total_slots INTEGER NOT NULL DEFAULT 1,
    location VARCHAR(255) CHECK (location IN ('Mississauga', 'Vancouver', 'Calgary', 'Montreal', 'Richmond Hill', 'Online')),
    is_active BOOLEAN DEFAULT true,
    available_from TIMESTAMPTZ,  -- When this slot becomes visible for booking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_slot UNIQUE (instructor_id, group_id, slot_date, slot_time)
);

CREATE INDEX idx_wcs_instructor ON hubspot_sync.work_check_slots(instructor_id);
CREATE INDEX idx_wcs_group ON hubspot_sync.work_check_slots USING GIN (group_id);
CREATE INDEX idx_wcs_date ON hubspot_sync.work_check_slots(slot_date);
```

**To get instructor's assigned groups:**
```sql
-- Get unique groups that an instructor has slots for
SELECT DISTINCT unnest(group_id) as group_id
FROM hubspot_sync.work_check_slots
WHERE instructor_id = $1
  AND slot_date >= CURRENT_DATE
  AND is_active = true;
```

---

## 8. Implementation Checklist

### Phase 1: Authentication & Database Setup (0.5 day)
- [ ] Add role claims SQL function (`set_instructor_role`)
- [ ] Create `instructor-helpers.js` with `getInstructorFromUser()`
- [ ] Update AuthContext to expose `user_role` from JWT claims
- [ ] Add validation schemas to `validation.js` (instructorGroupsList, instructorSchedule)
- [ ] Test JWT claims with instructor role
- [ ] **NOTE**: Use existing `requireRole` middleware - no new middleware needed

### Phase 2: Backend API (1 day)
- [ ] Create `/api/admin/instructor/me.js` (uses `requireRole(req, 'instructor')`)
- [ ] Create `/api/admin/instructor/dashboard-stats.js`
- [ ] Create `/api/admin/instructor/groups/list.js`
- [ ] Create `/api/admin/instructor/groups/[groupId].js`
- [ ] Create `/api/admin/instructor/schedule.js`
- [ ] Ensure all endpoints return standard response format: `{ success: true, data: {...} }`

### Phase 3: Frontend Routing (0.5 day)
- [ ] Create `ProtectedInstructorRoute.jsx`
- [ ] Update `ProtectedAdminRoute.jsx` to redirect instructors
- [ ] Create `RoleBasedRedirect` component
- [ ] Update `App.jsx` with role-based routing
- [ ] Test routing for both roles

### Phase 4: Frontend UI & Service Layer (1 day)
- [ ] Add `instructorPortalApi` to `adminApi.js` (axios service)
- [ ] Create `useInstructorPortalData.js` hooks (TanStack Query)
- [ ] Create `InstructorLayout.jsx`
- [ ] Create `InstructorDashboard.jsx`
- [ ] Create `InstructorGroups.jsx`
- [ ] Create `InstructorSchedule.jsx`

### Phase 5: Testing (0.5 day)
- [ ] Test admin login → admin dashboard
- [ ] Test instructor login → instructor dashboard
- [ ] Test instructor cannot access admin routes
- [ ] Test admin cannot access instructor routes (optional - may allow)
- [ ] Test all instructor API endpoints
- [ ] Test group and schedule data display

---

## 9. Success Criteria

1. Users with `instructor` role are automatically redirected to instructor dashboard after login
2. Instructors can ONLY see instructor-specific navigation (Dashboard, Groups, Schedule)
3. Instructors CANNOT access admin routes (/mock-exams, /trainees, /instructors management, etc.)
4. Instructor dashboard shows accurate statistics for their assignments
5. My Groups page shows all assigned groups with trainee details
6. Schedule page shows upcoming instruction dates organized by date
7. All instructor data is scoped to the logged-in instructor only
8. Admin users continue to access admin dashboard normally

---

## 10. Dependencies

### Requires
- **Instructor Management PRD** - Instructor records with `auth_user_id` link
- **Group Management PRD** - Groups and group-instructor assignments
- Existing admin authentication system
- Supabase database access

### Required By
- **Work Checks PRD** (future) - Will add work check tracking to instructor portal

---

## 11. Security Considerations

1. **Data Scoping**: All instructor queries MUST filter by the logged-in instructor's ID
2. **Role Verification**: Every instructor endpoint must verify `user_role === 'instructor'`
3. **No Cross-Access**: Instructors cannot view other instructors' groups or data
4. **Read-Only**: Instructor portal is entirely read-only (no create/update/delete operations)
5. **JWT Claims**: Role claims must be set server-side, never from client

---

## 12. Future Considerations

1. **Work Check Integration**: Add work check tracking to dashboard and groups
2. **Attendance Marking**: Allow instructors to mark attendance (requires additional permissions)
3. **Notifications**: Notify instructors of schedule changes
4. **Mobile Responsiveness**: Optimize instructor portal for tablet/mobile use
5. **Calendar Integration**: Export schedule to Google Calendar / iCal
