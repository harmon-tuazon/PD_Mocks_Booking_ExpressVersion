# PRD: Group Management for Mock Booking Admin

**Version:** 1.1.0
**Date:** January 27, 2026
**Author:** Claude Code
**Confidence Score:** 8/10
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Problem Statement
The PrepDoctors Mock Booking system currently manages individual student bookings without the ability to organize students into cohorts or groups. This limits the ability to:
- Organize students into training cohorts for batch scheduling
- Assign instructors to specific groups
- Track group-level progress and attendance
- Manage seat assignments within groups
- Clone group configurations for recurring training cycles

### 1.2 Proposed Solution
Implement a comprehensive Group Management feature in the admin dashboard that allows administrators to:
- Create and manage training groups with date ranges and time periods
- Assign students (contacts) to groups with seat numbers
- Assign instructors to groups for specific instruction dates
- Clone groups for new training cycles
- View group statistics and member details

### 1.3 Success Criteria
- Admin can create, edit, delete groups
- Admin can assign/remove students and instructors from groups
- Bulk assignment of students to groups
- Group cloning for new cycles
- Group statistics dashboard
- All data stored in Supabase (primary source of truth)

---

## 2. Architecture Alignment

### 2.1 Current System Patterns

This feature follows the established patterns from the mocks_booking system:

| Pattern | Implementation |
|---------|----------------|
| **API Style** | Vercel Serverless Functions (not Express routes) |
| **Database** | Supabase-first (no HubSpot custom object for groups) |
| **Table Naming** | Tables in `hubspot_sync` schema (e.g., `hubspot_sync.groups`) |
| **Auth** | Permission-based via `requirePermission(req, 'groups.view')` |
| **Validation** | Joi schemas in `validation.js` + `validationMiddleware()` |
| **Frontend** | React + TanStack Query + shadcn/ui + Tailwind |
| **Caching** | Redis with 2-minute TTL for list operations |

### 2.2 Data Source Strategy

**Supabase-Only (No HubSpot Sync)**
- Groups are an internal organizational concept
- No need for HubSpot CRM integration
- Contacts referenced by `hubspot_id` from `hubspot_contact_credits`
- Future consideration: HubSpot sync if needed for CRM visibility

---

## 3. Database Schema (Supabase)

### 3.1 Approved Tables

```sql
-- ============================================================
-- CORE ENTITY TABLE: hubspot_sync.groups
-- Purpose: Training groups with date ranges and time periods
-- ============================================================
CREATE TABLE hubspot_sync.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR(50) UNIQUE NOT NULL,           -- Auto-generated: YYMMDDAMGR1
    group_name VARCHAR(100) NOT NULL,
    time_period VARCHAR(10) NOT NULL CHECK (time_period IN ('AM', 'PM')),
    start_date DATE NOT NULL,
    end_date DATE,
    max_capacity INTEGER DEFAULT 20,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_status ON hubspot_sync.groups(status);
CREATE INDEX idx_groups_start_date ON hubspot_sync.groups(start_date);

-- ============================================================
-- JUNCTION TABLE: hubspot_sync.groups_students
-- Purpose: Links students (contacts) to groups
-- NOTE: No cached fields - use JOINs to get student details
-- ============================================================
CREATE TABLE hubspot_sync.groups_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id VARCHAR(50) NOT NULL REFERENCES hubspot_sync.groups(group_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES hubspot_sync.contact_credits(student_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'removed', 'completed')),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_group_student UNIQUE (group_id, student_id)
);

CREATE INDEX idx_gs_group ON hubspot_sync.groups_students(group_id);
CREATE INDEX idx_gs_student ON hubspot_sync.groups_students(student_id);
```

### 3.2 Architecture Notes

**Important Design Decisions:**

1. **No `groups_instructors` Junction Table**: The instructor-group relationship is captured through `work_check_slots` table. When an admin creates a slot, they specify both the instructor and which groups can book it. This eliminates redundant data.

2. **No Cached Fields in Junction Tables**: Student details (name, email) are retrieved via JOINs to `hubspot_sync.contact_credits`. This ensures data consistency and reduces maintenance overhead.

3. **Simplified Student Reference**: Uses `student_id` (UUID) which references `contact_credits.student_id` directly, maintaining referential integrity.

### 3.3 Why `hubspot_sync` Schema?
- **Separation**: Work-check tables are isolated in their own schema for clarity
- **Consistency**: Follows the pattern of keeping related functionality grouped together
- **Contact Integration**: Groups reference contacts via `student_id` (UUID from `hubspot_contact_credits`)

---

## 4. API Specification

### 4.1 File Structure

```
admin_root/
└── api/
    └── admin/
        └── groups/
            ├── list.js                    # GET  - List all groups
            ├── create.js                  # POST - Create new group
            ├── statistics.js              # GET  - Group statistics
            ├── assign-student.js          # POST - Assign student to group
            ├── bulk-assign-students.js    # POST - Bulk assign students
            ├── [id].js                    # GET/PUT/DELETE - Single group
            ├── [id]/
            │   └── clone.js               # POST - Clone group
            ├── [groupId]/
            │   └── students/
            │       └── [studentId].js     # DELETE - Remove student
            └── batch-clone.js             # POST - Batch clone

# NOTE: No instructor assignment endpoints here
# Instructor-group relationships are managed via work_check_slots table
```

### 4.2 Endpoint Specifications

#### 4.2.1 List Groups
```javascript
// GET /api/admin/groups/list.js
// Permission: 'groups.view'

// Query Parameters:
{
  page: 1,              // Pagination
  limit: 50,            // Max 100
  sort_by: 'start_date',
  sort_order: 'desc',
  filter_status: 'active' | 'inactive' | 'completed' | 'all',
  search: 'Group 1'     // Search group_name
}

// Response:
{
  success: true,
  pagination: {
    current_page: 1,
    total_pages: 5,
    total_records: 229,
    records_per_page: 50
  },
  data: [
    {
      id: "uuid-...",
      group_id: "260301AMGR1",
      group_name: "Group 1",
      time_period: "AM",
      start_date: "2026-03-01",
      end_date: "2026-06-30",
      max_capacity: 20,
      status: "active",
      student_count: 15,           // Computed
      instructor_count: 2,         // Computed
      created_at: "2026-01-27T..."
    }
  ]
}
```

#### 4.2.2 Create Group
```javascript
// POST /api/admin/groups/create.js
// Permission: 'groups.create'

// Request Body:
{
  groupName: "Group 1",            // Required
  description: "Morning cohort",   // Optional
  timePeriod: "AM",                // Required: "AM" or "PM"
  startDate: "2026-03-01",         // Required
  endDate: "2026-06-30",           // Optional
  maxCapacity: 20                  // Optional, default 20
}

// Response:
{
  success: true,
  message: "Group created successfully",
  data: {
    id: "uuid-...",
    group_id: "260301AMGR1",       // Auto-generated
    group_name: "Group 1",
    ...
  }
}
```

#### 4.2.3 Assign Student
```javascript
// POST /api/admin/groups/assign-student.js
// Permission: 'groups.edit'

// Request Body:
{
  groupId: "260301AMGR1",          // Required
  studentId: "uuid-..."            // Required: UUID from hubspot_contact_credits.student_id
}

// Response:
{
  success: true,
  message: "Student assigned to group successfully",
  data: {
    id: "uuid-...",
    group_id: "260301AMGR1",
    student_id: "uuid-...",
    status: "active",
    enrolled_at: "2026-03-01T10:00:00Z",
    // Student details from JOIN:
    student: {
      firstname: "John",
      lastname: "Doe",
      email: "john@example.com",
      student_id: "PREP001"
    }
  }
}
```

#### 4.2.4 Bulk Assign Students
```javascript
// POST /api/admin/groups/bulk-assign-students.js
// Permission: 'groups.edit'

// Request Body:
{
  groupId: "260301AMGR1",
  studentIds: [
    "uuid-1...",
    "uuid-2...",
    "uuid-3..."
  ]
}

// Response:
{
  success: true,
  message: "3 students assigned to group successfully",
  data: {
    assigned: 3,
    failed: 0,
    results: [...]
  }
}
```

#### 4.2.5 Clone Group
```javascript
// POST /api/admin/groups/[id]/clone.js
// Permission: 'groups.create'

// Request Body:
{
  groupName: "Group 1 - Cycle 2",
  timePeriod: "AM",
  startDate: "2026-06-01",
  endDate: "2026-09-30",
  includeInstructors: true,        // Default: false
  includeStudents: true            // Default: true
}

// Response:
{
  success: true,
  message: "Group cloned successfully. 15 students and 2 instructors copied.",
  data: {
    id: "uuid-...",
    group_id: "260601AMGR1",
    clonedStudents: 15,
    clonedInstructors: 2
  }
}
```

---

## 5. Validation Schemas

Add to `admin_root/api/_shared/validation.js`:

```javascript
// ============================================================
// GROUP MANAGEMENT SCHEMAS
// ============================================================

// Schema for group creation
groupCreation: Joi.object({
  groupName: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': 'Group name must be at least 1 character',
      'string.max': 'Group name cannot exceed 100 characters',
      'any.required': 'Group name is required'
    }),
  description: Joi.string()
    .max(500)
    .allow('', null)
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  timePeriod: Joi.string()
    .valid('AM', 'PM')
    .required()
    .messages({
      'any.only': 'Time period must be AM or PM',
      'any.required': 'Time period is required'
    }),
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Start date must be in YYYY-MM-DD format',
      'any.required': 'Start date is required'
    }),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'End date must be in YYYY-MM-DD format'
    }),
  maxCapacity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Max capacity must be at least 1',
      'number.max': 'Max capacity cannot exceed 100'
    })
}).custom((value, helpers) => {
  // Validate end date is after start date
  if (value.endDate && value.startDate && value.endDate <= value.startDate) {
    return helpers.error('custom.endDateBeforeStart');
  }
  return value;
}).messages({
  'custom.endDateBeforeStart': 'End date must be after start date'
}),

// Schema for group list query
groupList: Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  sort_by: Joi.string()
    .valid('start_date', 'group_name', 'created_at', 'status')
    .default('start_date'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  filter_status: Joi.string()
    .valid('all', 'active', 'inactive', 'completed')
    .default('all'),
  search: Joi.string().max(100).allow('').optional()
}),

// Schema for student assignment
studentAssignment: Joi.object({
  groupId: Joi.string()
    .required()
    .messages({
      'any.required': 'Group ID is required'
    }),
  studentId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Student ID must be a valid UUID',
      'any.required': 'Student ID is required'
    })
}),

// Schema for bulk student assignment
bulkStudentAssignment: Joi.object({
  groupId: Joi.string().required(),
  studentIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one student ID is required',
      'array.max': 'Cannot assign more than 100 students at once'
    })
}),

// NOTE: Instructor assignments are handled via work_check_slots table
// No separate groups_instructors junction table needed

// Schema for group clone
groupClone: Joi.object({
  groupName: Joi.string().min(1).max(100).required(),
  timePeriod: Joi.string().valid('AM', 'PM').required(),
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, ''),
  maxCapacity: Joi.number().integer().min(1).max(100),
  includeInstructors: Joi.boolean().default(false),
  includeStudents: Joi.boolean().default(true)
}),
```

---

## 6. Frontend Specification

### 6.1 New Files

```
admin_root/admin_frontend/src/
├── pages/
│   └── Groups.jsx                      # Main groups management page
├── components/
│   └── admin/
│       ├── GroupsTable.jsx             # Data table component
│       ├── GroupForm.jsx               # Create/Edit form
│       ├── GroupDetailsModal.jsx       # View details modal
│       ├── BulkAssignStudentsModal.jsx # Bulk assignment modal
│       └── CloneGroupModal.jsx         # Clone group modal
├── services/
│   └── groupsApi.js                    # API service (or add to adminApi.js)
└── constants/
    └── groupConstants.js               # TIME_PERIODS, STATUS_OPTIONS
```

### 6.2 Main Page Component Pattern

Following the `MockExamsDashboard.jsx` pattern:

```jsx
// pages/Groups.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../services/adminApi';
import GroupsTable from '../components/admin/GroupsTable';
import GroupForm from '../components/admin/GroupForm';
import toast from 'react-hot-toast';
import { PlusIcon, UsersIcon } from '@heroicons/react/24/outline';

function Groups() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    filter_status: 'all',
    search: ''
  });

  // Fetch groups
  const { data, isLoading, error } = useQuery({
    queryKey: ['groups', filters],
    queryFn: () => groupsApi.list(filters)
  });

  // Statistics query
  const { data: stats } = useQuery({
    queryKey: ['groups-statistics'],
    queryFn: () => groupsApi.getStatistics()
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => groupsApi.create(data),
    onSuccess: () => {
      toast.success('Group created successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups-statistics'] });
      setShowCreateModal(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create group');
    }
  });

  return (
    <div className="p-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Groups" value={stats?.total || 0} icon={UsersIcon} />
        <StatCard title="Active" value={stats?.active || 0} color="green" />
        <StatCard title="Total Students" value={stats?.totalStudents || 0} />
        <StatCard title="Avg Size" value={stats?.averageSize?.toFixed(1) || 0} />
      </div>

      {/* Table with filters */}
      <GroupsTable
        data={data?.data || []}
        pagination={data?.pagination}
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        onCreateClick={() => setShowCreateModal(true)}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <GroupForm
          onSubmit={createMutation.mutate}
          onClose={() => setShowCreateModal(false)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}
```

### 6.3 API Service

Add to `adminApi.js` or create `groupsApi.js`:

```javascript
// services/adminApi.js (additions)

export const groupsApi = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, value);
      }
    });
    const response = await apiClient.get(`/admin/groups/list?${queryParams}`);
    return response.data;
  },

  create: async (data) => {
    const response = await apiClient.post('/admin/groups/create', data);
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/admin/groups/${id}`);
    return response.data;
  },

  update: async (id, data) => {
    const response = await apiClient.put(`/admin/groups/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/admin/groups/${id}`);
    return response.data;
  },

  getStatistics: async () => {
    const response = await apiClient.get('/admin/groups/statistics');
    return response.data;
  },

  assignStudent: async (data) => {
    const response = await apiClient.post('/admin/groups/assign-student', data);
    return response.data;
  },

  bulkAssignStudents: async (data) => {
    const response = await apiClient.post('/admin/groups/bulk-assign-students', data);
    return response.data;
  },

  removeStudent: async (groupId, studentId) => {
    const response = await apiClient.delete(`/admin/groups/${groupId}/students/${studentId}`);
    return response.data;
  },

  // NOTE: Instructor assignments handled via work_check_slots API
  // See Work Check Slot Management PRD for instructor-group relationships

  clone: async (id, data) => {
    const response = await apiClient.post(`/admin/groups/${id}/clone`, data);
    return response.data;
  },

  batchClone: async (data) => {
    const response = await apiClient.post('/admin/groups/batch-clone', data);
    return response.data;
  }
};
```

### 6.4 Navigation Integration

Add to `SidebarNavigation.jsx`:

```jsx
{
  path: '/groups',
  icon: UsersIcon,
  label: 'Groups',
  requiredPermission: 'groups.view'  // Available to super_admin, admin, instructor
}
```

Add route to `App.jsx`:

```jsx
<Route path="/groups" element={<ProtectedAdminRoute><Groups /></ProtectedAdminRoute>} />
```

---

## 7. Implementation Plan

### Phase 1: Database & Core API (2-3 days)

| Task | File | Priority |
|------|------|----------|
| Create Supabase migration | SQL migration file | P0 |
| Group list endpoint | `groups/list.js` | P0 |
| Group create endpoint | `groups/create.js` | P0 |
| Group CRUD endpoint | `groups/[id].js` | P0 |
| Statistics endpoint | `groups/statistics.js` | P1 |
| Add validation schemas | `validation.js` | P0 |

### Phase 2: Assignment APIs (2 days)

| Task | File | Priority |
|------|------|----------|
| Student assignment | `groups/assign-student.js` | P0 |
| Bulk student assignment | `groups/bulk-assign-students.js` | P1 |
| Instructor assignment | `groups/assign-instructor.js` | P1 |
| Remove student | `groups/[groupId]/students/[contactId].js` | P0 |
| Remove instructor | `groups/[groupId]/instructors/[instructorId].js` | P1 |

### Phase 3: Clone & Frontend (2-3 days)

| Task | File | Priority |
|------|------|----------|
| Clone group | `groups/[id]/clone.js` | P1 |
| Batch clone | `groups/batch-clone.js` | P2 |
| Groups page | `pages/Groups.jsx` | P0 |
| Groups table | `components/admin/GroupsTable.jsx` | P0 |
| Group form | `components/admin/GroupForm.jsx` | P0 |
| Details modal | `components/admin/GroupDetailsModal.jsx` | P1 |
| Bulk assign modal | `components/admin/BulkAssignStudentsModal.jsx` | P1 |

### Phase 4: Testing & Polish (1-2 days)

- Unit tests for validation schemas
- Integration tests for API endpoints
- UI polish and error handling
- Documentation update

---

## 8. Permissions

### 8.1 Role-Based Access Control (RBAC)

The system implements full RBAC for group management with three permission levels:

**Permission Model:**
```sql
-- Groups permissions from database
('super_admin', 'groups.create'),
('super_admin', 'groups.edit'),
('super_admin', 'groups.delete'),
('super_admin', 'groups.view'),
('admin', 'groups.create'),
('admin', 'groups.edit'),
('admin', 'groups.delete'),
('admin', 'groups.view'),
('instructor', 'groups.view')
```

### 8.2 Permission Breakdown

| Permission | Description | Roles |
|------------|-------------|-------|
| `groups.view` | View groups list and details | super_admin, admin, instructor |
| `groups.create` | Create new groups | super_admin, admin |
| `groups.edit` | Edit existing groups and assign/remove members | super_admin, admin |
| `groups.delete` | Delete groups | super_admin, admin |

**Important Notes:**
- Member assignment (students/instructors) uses `groups.edit` permission
- No separate `groups.assign` permission exists
- Instructors have read-only access (view only)

### 8.3 Endpoint Permission Requirements

```javascript
// List groups
GET /api/admin/groups/list
Permission: 'groups.view'
Roles: super_admin, admin, instructor

// Create group
POST /api/admin/groups/create
Permission: 'groups.create'
Roles: super_admin, admin

// Get/Update/Delete single group
GET/PUT/DELETE /api/admin/groups/[id]
Permission GET: 'groups.view'
Permission PUT: 'groups.edit'
Permission DELETE: 'groups.delete'
Roles: super_admin, admin (instructor read-only)

// Assign student to group
POST /api/admin/groups/assign-student
Permission: 'groups.edit'
Roles: super_admin, admin

// Bulk assign students
POST /api/admin/groups/bulk-assign-students
Permission: 'groups.edit'
Roles: super_admin, admin

// Remove student from group
DELETE /api/admin/groups/[groupId]/students/[studentId]
Permission: 'groups.edit'
Roles: super_admin, admin

// Clone group
POST /api/admin/groups/[id]/clone
Permission: 'groups.create'
Roles: super_admin, admin

// Group statistics
GET /api/admin/groups/statistics
Permission: 'groups.view'
Roles: super_admin, admin, instructor
```

### 8.4 Implementation Pattern

```javascript
// Example: List endpoint (view permission)
const user = await requirePermission(req, 'groups.view');
// Allows: super_admin, admin, instructor

// Example: Create endpoint
const user = await requirePermission(req, 'groups.create');
// Allows: super_admin, admin only

// Example: Update endpoint (includes assignments)
const user = await requirePermission(req, 'groups.edit');
// Allows: super_admin, admin only
```

---

## 9. Group ID Generation

```javascript
/**
 * Generate unique group ID
 * Pattern: YYMMDD{AM|PM}GR{N}
 * Examples: 260301AMGR1, 260301PMGR2
 */
function generateGroupId(startDate, timePeriod, groupName) {
  const date = new Date(startDate);
  const year = date.getUTCFullYear().toString().slice(-2);
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const period = timePeriod.toUpperCase();

  // Extract letters from group name
  const cleanName = groupName.trim().toUpperCase();
  const firstTwo = cleanName.substring(0, 2);
  const lastChar = cleanName.charAt(cleanName.length - 1);

  return `${year}${month}${day}${period}${firstTwo}${lastChar}`;
}

// Handle uniqueness with retry on conflict (PostgreSQL 23505 error)
```

---

## 10. Error Handling

Following current system patterns:

```javascript
// Standard error response format
{
  success: false,
  error: {
    code: 'GROUP_NOT_FOUND',
    message: 'Group with ID 260301AMGR1 not found'
  }
}

// Error codes
const ERROR_CODES = {
  GROUP_NOT_FOUND: 404,
  STUDENT_ALREADY_ASSIGNED: 400,
  GROUP_AT_CAPACITY: 400,
  INVALID_TIME_PERIOD: 400,
  INVALID_DATE_RANGE: 400,
  CONTACT_NOT_FOUND: 404
};
```

---

## 11. Caching Strategy

Following current Redis patterns:

```javascript
// Cache keys
const cacheKeys = {
  groupsList: (filters) => `admin:groups:list:${JSON.stringify(filters)}`,
  groupDetails: (id) => `admin:groups:${id}`,
  groupStatistics: () => `admin:groups:statistics`
};

// TTL: 2 minutes (matching mock exams pattern)
const CACHE_TTL = 120;

// Invalidate on mutations
await cache.del(cacheKeys.groupsList('*'));
await cache.del(cacheKeys.groupStatistics());
```

---

## 12. Rollback Plan

### Database Rollback
```sql
-- Only 2 tables to rollback (no groups_instructors table)
DROP TABLE IF EXISTS hubspot_sync.groups_students CASCADE;
DROP TABLE IF EXISTS hubspot_sync.groups CASCADE;
```

### Code Rollback
- Remove API files from `admin_root/api/admin/groups/`
- Remove frontend files from `admin_frontend/src/components/admin/Group*.jsx`
- Remove page from `pages/Groups.jsx`
- Remove route from `App.jsx`
- Remove navigation entry from `SidebarNavigation.jsx`

---

## 13. Future Considerations

### 13.1 HubSpot Integration (Phase 2)
- Create HubSpot custom object for Groups
- Sync groups to HubSpot for CRM visibility
- Associate contacts with groups in HubSpot

### 13.2 Email Notifications (Phase 2)
- Email students when assigned to group
- Email instructors with schedule
- Track email send status per group member

### 13.3 Group Attendance (Phase 3)
- Track attendance per session
- Link to mock exam bookings
- Generate attendance reports

### 13.4 Batch Clone Wizard (Phase 3)
- UI wizard for cloning multiple groups
- Date offset calculation
- Preview before execution

---

**End of PRD**
