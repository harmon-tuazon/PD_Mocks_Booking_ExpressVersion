# PRD: Instructor Management (Admin CRUD)

**Version:** 1.0.0
**Created:** January 27, 2026
**Status:** Draft
**Confidence Score:** 8/10
**Estimated Effort:** 2-3 days

---

## 1. Overview

### 1.1 Purpose
Provide administrators with the ability to manage instructor profiles within the admin portal. This is the foundational feature for instructor-related functionality, enabling CRUD operations on instructor records.

### 1.2 Scope
- Supabase table for instructor data
- Admin API endpoints for instructor CRUD operations
- Admin UI page for managing instructors
- Instructor dropdown data source for Group Management assignments

### 1.3 Out of Scope
- Group-instructor assignments (handled in Group Management PRD)
- Instructor portal/dashboard (separate PRD)
- Work checks system (future PRD)
- Instructor authentication/login (handled in Instructor Portal PRD)

---

## 2. Database Schema

### 2.1 Approved Table: `hubspot_sync.instructors`

```sql
-- ============================================================
-- CORE ENTITY TABLE: hubspot_sync.instructors
-- Purpose: Instructor profiles for work check assignments
-- SIMPLIFIED: Single name field, no phone/specialization/notes
-- ============================================================
CREATE TABLE hubspot_sync.instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_name VARCHAR(100) NOT NULL,          -- Full name (e.g., "Dr. Ahmad Judeh")
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    auth_user_id UUID REFERENCES auth.users(id),    -- For instructor portal access
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_instructors_is_active ON hubspot_sync.instructors(is_active);
CREATE INDEX idx_instructors_email ON hubspot_sync.instructors(email);
CREATE INDEX idx_instructors_auth_user_id ON hubspot_sync.instructors(auth_user_id);

-- Updated_at trigger
CREATE TRIGGER update_instructors_updated_at
    BEFORE UPDATE ON hubspot_sync.instructors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 Sample Data Structure

```json
{
  "id": "uuid-here",
  "instructor_name": "Dr. Ahmad Judeh",
  "email": "ahmad.judeh@prepdoctors.com",
  "is_active": true,
  "auth_user_id": "supabase-auth-uuid",
  "created_at": "2026-01-27T10:00:00Z",
  "updated_at": "2026-01-27T10:00:00Z"
}
```

### 2.3 Architecture Notes

**Simplified Design:**
- Single `instructor_name` field instead of separate first/last name
- Removed `phone`, `specialization`, and `notes` fields (not needed for core functionality)
- Instructor-group relationships are captured through `work_check_slots` table, not a separate junction table

---

## 3. API Specification

### 3.1 Endpoints Overview

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/admin/instructors` | List instructors with pagination/search | `workcheck.view` |
| POST | `/api/admin/instructors` | Create new instructor | `workcheck.create` |
| GET | `/api/admin/instructors/:id` | Get single instructor | `workcheck.view` |
| PUT | `/api/admin/instructors/:id` | Update instructor | `workcheck.edit` |
| DELETE | `/api/admin/instructors/:id` | Soft delete instructor | `workcheck.delete` |
| GET | `/api/admin/instructors/dropdown` | Get active instructors for dropdowns | `workcheck.view` |

### 3.2 Endpoint Details

#### GET `/api/admin/instructors` - List Instructors

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Records per page (max 100) |
| `search` | string | - | Search by name or email |
| `is_active` | string | 'all' | Filter: 'true', 'false', 'all' |
| `sort_by` | string | 'instructor_name' | Sort field |
| `sort_order` | string | 'asc' | 'asc' or 'desc' |

**Response:**
```json
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 1,
    "total_records": 4,
    "records_per_page": 20
  },
  "data": [
    {
      "id": "uuid",
      "instructor_name": "Dr. Ahmad Judeh",
      "email": "ahmad.judeh@prepdoctors.com",
      "is_active": true,
      "created_at": "2026-01-27T10:00:00Z",
      "updated_at": "2026-01-27T10:00:00Z"
    }
  ]
}
```

#### POST `/api/admin/instructors` - Create Instructor

**Request Body:**
```json
{
  "instructor_name": "Dr. John Smith",
  "email": "john.smith@prepdoctors.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "instructor_name": "Dr. John Smith",
    "email": "john.smith@prepdoctors.com",
    "is_active": true,
    "created_at": "2026-01-27T10:00:00Z",
    "updated_at": "2026-01-27T10:00:00Z"
  }
}
```

#### GET `/api/admin/instructors/:id` - Get Single Instructor

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "instructor_name": "Dr. Ahmad Judeh",
    "email": "ahmad.judeh@prepdoctors.com",
    "is_active": true,
    "auth_user_id": "supabase-auth-uuid",
    "has_portal_access": true,
    "created_at": "2026-01-27T10:00:00Z",
    "updated_at": "2026-01-27T10:00:00Z"
  }
}
```

#### PUT `/api/admin/instructors/:id` - Update Instructor

**Request Body:**
```json
{
  "instructor_name": "Dr. Ahmad Judeh",
  "email": "ahmad.judeh@prepdoctors.com",
  "is_active": true
}
```

#### DELETE `/api/admin/instructors/:id` - Soft Delete

**Response:**
```json
{
  "success": true,
  "message": "Instructor deactivated successfully"
}
```

**Note:** This performs a soft delete by setting `is_active = false`. Hard deletes are not supported to maintain data integrity with group assignments.

#### GET `/api/admin/instructors/dropdown` - Dropdown Data

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active_only` | boolean | true | Only return active instructors |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "instructor_name": "Dr. Ahmad Judeh",
      "email": "ahmad.judeh@prepdoctors.com"
    },
    {
      "id": "uuid-2",
      "instructor_name": "Dr. Ibrahim Cholakian",
      "email": "ibrahim.c@prepdoctors.com"
    }
  ]
}
```

---

## 4. Validation Schemas

### 4.1 Joi Schemas

Add to `admin_root/api/_shared/validation.js` inside the `schemas` object:

```javascript
// =====================================================
// INSTRUCTOR MANAGEMENT SCHEMAS
// =====================================================

// Instructor list query validation (matches mockExamList pattern)
instructorList: Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
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
    }),
  search: Joi.string()
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Search query cannot exceed 100 characters'
    }),
  is_active: Joi.string()
    .valid('true', 'false', 'all')
    .optional()
    .default('all')
    .messages({
      'any.only': 'is_active must be one of: true, false, all'
    }),
  sort_by: Joi.string()
    .valid('instructor_name', 'email', 'created_at', 'updated_at')
    .optional()
    .default('instructor_name')
    .messages({
      'any.only': 'sort_by must be one of: instructor_name, email, created_at, updated_at'
    }),
  sort_order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('asc')
    .messages({
      'any.only': 'sort_order must be either asc or desc'
    })
}),

// Instructor creation validation (simplified - only name and email required)
instructorCreate: Joi.object({
  instructor_name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Instructor name is required',
      'string.min': 'Instructor name must be at least 1 character',
      'string.max': 'Instructor name cannot exceed 100 characters',
      'any.required': 'Instructor name is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    })
}),

// Instructor update validation
instructorUpdate: Joi.object({
  instructor_name: Joi.string()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Instructor name must be at least 1 character',
      'string.max': 'Instructor name cannot exceed 100 characters'
    }),
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please enter a valid email address'
    }),
  is_active: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_active must be a boolean value'
    })
}).min(1).messages({
  'object.min': 'At least one property must be provided for update'
})

---

## 5. Frontend Specification

### 5.1 New Files

```
admin_root/admin_frontend/src/
├── pages/
│   └── Instructors.jsx              # Main instructors page
├── components/
│   └── admin/
│       ├── InstructorTable.jsx      # Table component
│       ├── InstructorFormModal.jsx  # Create/Edit modal
│       └── InstructorFilters.jsx    # Filter bar
├── hooks/
│   ├── useInstructorsData.js        # List query hook (TanStack Query)
│   └── useInstructorMutations.js    # CRUD mutations (useMutation)
```

### 5.1.1 Service Integration

**Add to existing `admin_root/admin_frontend/src/services/adminApi.js`:**

```javascript
/**
 * Instructor API endpoints
 */
export const instructorsApi = {
  /**
   * List instructors with pagination and filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated instructors
   */
  list: async (params = {}) => {
    const response = await api.get('/admin/instructors/list', { params });
    return response.data;
  },

  /**
   * Get single instructor by ID
   * @param {string} id - Instructor UUID
   * @returns {Promise<Object>} Instructor details
   */
  getById: async (id) => {
    const response = await api.get(`/admin/instructors/${id}`);
    return response.data;
  },

  /**
   * Create a new instructor
   * @param {Object} data - Instructor data
   * @returns {Promise<Object>} Created instructor
   */
  create: async (data) => {
    const response = await api.post('/admin/instructors/create', data);
    return response.data;
  },

  /**
   * Update an instructor
   * @param {string} id - Instructor UUID
   * @param {Object} data - Updated fields
   * @returns {Promise<Object>} Updated instructor
   */
  update: async (id, data) => {
    const response = await api.put(`/admin/instructors/${id}`, data);
    return response.data;
  },

  /**
   * Delete (deactivate) an instructor
   * @param {string} id - Instructor UUID
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (id) => {
    const response = await api.delete(`/admin/instructors/${id}`);
    return response.data;
  },

  /**
   * Get instructors for dropdown (active only, minimal fields)
   * @returns {Promise<Object>} Instructor list for dropdowns
   */
  getDropdown: async () => {
    const response = await api.get('/admin/instructors/dropdown');
    return response.data;
  }
};
```

### 5.1.2 Hook Implementation

**Create `admin_root/admin_frontend/src/hooks/useInstructorsData.js`:**

```javascript
/**
 * Custom hooks for instructor data management
 * Uses TanStack Query for data fetching and caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorsApi } from '../services/adminApi';
import toast from 'react-hot-toast';

/**
 * Hook to fetch instructors list with pagination and filtering
 */
export function useInstructorsData(params = {}, options = {}) {
  return useQuery({
    queryKey: ['instructors', JSON.stringify(params)],
    queryFn: () => instructorsApi.list(params),
    staleTime: 5000,
    refetchOnWindowFocus: false,
    ...options
  });
}

/**
 * Hook to fetch single instructor details
 */
export function useInstructorDetails(id, options = {}) {
  return useQuery({
    queryKey: ['instructor', id],
    queryFn: () => instructorsApi.getById(id),
    enabled: !!id,
    ...options
  });
}

/**
 * Hook to fetch instructors for dropdown
 */
export function useInstructorsDropdown(options = {}) {
  return useQuery({
    queryKey: ['instructorsDropdown'],
    queryFn: () => instructorsApi.getDropdown(),
    staleTime: 60000, // Cache for 1 minute
    ...options
  });
}

/**
 * Hook for instructor mutations (create, update, delete)
 */
export function useInstructorMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: instructorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      toast.success('Instructor created successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create instructor');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => instructorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      toast.success('Instructor updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update instructor');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: instructorsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['instructorsDropdown'] });
      toast.success('Instructor deactivated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to deactivate instructor');
    }
  });

  return {
    createInstructor: createMutation,
    updateInstructor: updateMutation,
    deleteInstructor: deleteMutation
  };
}
```

### 5.2 Page Layout: Instructors.jsx

```
┌─────────────────────────────────────────────────────────────────┐
│  Instructors                                    [+ Add Instructor] │
├─────────────────────────────────────────────────────────────────┤
│  [Search...]  [Status: All ▼]  [Sort: Last Name ▼]              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Name          │ Email              │ Specialization │ Status ││
│  ├───────────────┼────────────────────┼────────────────┼────────┤│
│  │ Ahmad Judeh   │ ahmad@pd.com       │ Clinical Skills│ Active ││
│  │ Ibrahim C.    │ ibrahim@pd.com     │ SJ             │ Active ││
│  │ [More rows...]                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│  Showing 1-4 of 4 instructors           [< 1 >]                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Component Specifications

#### InstructorTable.jsx
- Columns: Name, Email, Phone, Specialization, Status, Actions
- Row actions: Edit, Deactivate/Activate
- Sortable columns: Name, Email, Created At
- Empty state when no instructors found

#### InstructorFormModal.jsx
- Mode: Create or Edit (determined by prop)
- Fields:
  - First Name (required)
  - Last Name (required)
  - Email (required, validated)
  - Phone (optional)
  - Specialization (optional, text input or predefined options)
  - Notes (optional, textarea)
- Validation: Client-side with error messages
- Submit: Creates/updates instructor, closes modal, refreshes list

#### InstructorFilters.jsx
- Search input (debounced, 300ms)
- Status filter dropdown (All, Active, Inactive)
- Sort dropdown

### 5.4 Route Configuration

Add to `App.jsx`:

```jsx
// Inside protected routes
<Route path="instructors" element={<Instructors />} />
```

Add to `MainLayout.jsx` navigation:

```jsx
{
  name: 'Instructors',
  path: '/instructors',
  icon: UserGroupIcon,  // or appropriate icon
  requiredPermission: 'workcheck.view'  // Available to super_admin, admin, instructor
}
```

---

## 6. API File Structure

```
admin_root/api/admin/instructors/
├── list.js          # GET /api/admin/instructors
├── create.js        # POST /api/admin/instructors
├── [id].js          # GET, PUT, DELETE /api/admin/instructors/:id
└── dropdown.js      # GET /api/admin/instructors/dropdown
```

### 6.1 Sample Implementation: list.js

**File: `admin_root/api/admin/instructors/list.js`**

```javascript
/**
 * GET /api/admin/instructors/list
 * List instructors with pagination, filtering, and sorting
 *
 * Pattern matches: admin_root/api/admin/mock-exams/list.js
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  try {
    // Verify authentication and permission
    const user = await requirePermission(req, 'workcheck.view');

    // Validate query parameters
    const validator = validationMiddleware('instructorList');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { page, limit, search, is_active, sort_by, sort_order } = req.validatedData;

    console.log(`📋 [INSTRUCTORS] Fetching with params:`, { page, limit, search, is_active, sort_by, sort_order });

    // Build query
    let query = supabaseAdmin
      .from('hubspot_sync.instructors')
      .select('*', { count: 'exact' });

    // Apply filters
    if (is_active !== 'all') {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`instructor_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('❌ [INSTRUCTORS] Supabase error:', error);
      throw error;
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / limit);

    console.log(`✅ [INSTRUCTORS] Found ${count} instructors, returning page ${page}`);

    res.status(200).json({
      success: true,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_records: count,
        records_per_page: limit
      },
      data
    });

  } catch (error) {
    console.error('Error fetching instructors:', error);

    // Handle auth errors
    if (error.statusCode === 403 || error.statusCode === 401) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }

    // Handle validation errors
    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.validationErrors || []
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch instructors' }
    });
  }
};
```

### 6.2 Sample Implementation: create.js

**File: `admin_root/api/admin/instructors/create.js`**

```javascript
/**
 * POST /api/admin/instructors/create
 * Create a new instructor
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  try {
    // Verify authentication and permission
    await requirePermission(req, 'workcheck.create');

    // Validate request body
    const validator = validationMiddleware('instructorCreate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { instructor_name, email } = req.validatedData;

    console.log(`📝 [INSTRUCTORS] Creating instructor: ${instructor_name}`);

    // Check for duplicate email
    const { data: existing } = await supabaseAdmin
      .from('hubspot_sync.instructors')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'An instructor with this email already exists' }
      });
    }

    // Insert new instructor
    const { data, error } = await supabaseAdmin
      .from('hubspot_sync.instructors')
      .insert({
        instructor_name,
        email,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [INSTRUCTORS] Create error:', error);
      throw error;
    }

    console.log(`✅ [INSTRUCTORS] Created instructor: ${data.id}`);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error creating instructor:', error);

    if (error.statusCode === 403 || error.statusCode === 401) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create instructor' }
    });
  }
};
```

---

## 7. Permissions

### 7.1 Role-Based Access Control (RBAC)

Instructor management uses the **`workcheck.*` permission namespace** (not `instructors.*`). This is because instructor CRUD operations are part of the broader work check system.

**Permission Model:**
```sql
-- Work check permissions from database (includes instructor management)
('instructor', 'workcheck.edit'),
('instructor', 'workcheck.view'),
('super_admin', 'workcheck.create'),
('super_admin', 'workcheck.edit'),
('super_admin', 'workcheck.delete'),
('super_admin', 'workcheck.view'),
('admin', 'workcheck.create'),
('admin', 'workcheck.edit'),
('admin', 'workcheck.delete'),
('admin', 'workcheck.view')
```

### 7.2 Permission Breakdown

| Permission | Description | Roles |
|------------|-------------|-------|
| `workcheck.view` | View instructor list and details | super_admin, admin, instructor |
| `workcheck.create` | Create new instructors | super_admin, admin |
| `workcheck.edit` | Edit existing instructors | super_admin, admin, instructor |
| `workcheck.delete` | Deactivate instructors | super_admin, admin |

**Important Notes:**
- No separate `instructors.*` permissions exist in the database
- Instructors can view the instructor list and edit their own profiles (via `workcheck.view` and `workcheck.edit`)
- Only super_admin and admin can create/delete instructors
- Instructor self-editing is a future enhancement (Phase 2)

### 7.3 Endpoint Permission Requirements

```javascript
// List instructors
GET /api/admin/instructors/list
Permission: 'workcheck.view'
Roles: super_admin, admin, instructor

// Create instructor
POST /api/admin/instructors/create
Permission: 'workcheck.create'
Roles: super_admin, admin

// Get single instructor
GET /api/admin/instructors/[id]
Permission: 'workcheck.view'
Roles: super_admin, admin, instructor

// Update instructor
PUT /api/admin/instructors/[id]
Permission: 'workcheck.edit'
Roles: super_admin, admin, instructor (own profile only - future)

// Delete (deactivate) instructor
DELETE /api/admin/instructors/[id]
Permission: 'workcheck.delete'
Roles: super_admin, admin

// Dropdown endpoint
GET /api/admin/instructors/dropdown
Permission: 'workcheck.view'
Roles: super_admin, admin, instructor
```

### 7.4 Implementation Pattern

```javascript
// Example: List endpoint (view permission)
const user = await requirePermission(req, 'workcheck.view');
// Allows: super_admin, admin, instructor

// Example: Create endpoint
const user = await requirePermission(req, 'workcheck.create');
// Allows: super_admin, admin only

// Example: Update endpoint
const user = await requirePermission(req, 'workcheck.edit');
// Allows: super_admin, admin, instructor
// Future: Add check to restrict instructors to editing own profile only

// Example: Delete endpoint
const user = await requirePermission(req, 'workcheck.delete');
// Allows: super_admin, admin only
```

---

## 8. Implementation Checklist

### Phase 1: Database (0.5 day)
- [ ] Create `hubspot_sync.instructors` table in Supabase
- [ ] Add indexes
- [ ] Create updated_at trigger
- [ ] Insert sample data for testing

### Phase 2: Backend API (1 day)
- [ ] Add validation schemas to `validation.js`
- [ ] Create `list.js` endpoint
- [ ] Create `create.js` endpoint
- [ ] Create `[id].js` endpoint (GET, PUT, DELETE)
- [ ] Create `dropdown.js` endpoint
- [ ] Add permissions to auth system

### Phase 3: Frontend (1-1.5 days)
- [ ] Create `instructorService.js`
- [ ] Create `useInstructors.js` hook
- [ ] Create `useInstructorMutations.js` hook
- [ ] Create `Instructors.jsx` page
- [ ] Create `InstructorTable.jsx` component
- [ ] Create `InstructorFormModal.jsx` component
- [ ] Create `InstructorFilters.jsx` component
- [ ] Add route to `App.jsx`
- [ ] Add navigation item to `MainLayout.jsx`

### Phase 4: Testing & Polish (0.5 day)
- [ ] Test all CRUD operations
- [ ] Test pagination and filtering
- [ ] Test error handling
- [ ] Verify permissions work correctly
- [ ] Test dropdown integration readiness

---

## 9. Success Criteria

1. Admin can view list of all instructors with pagination
2. Admin can search instructors by name or email
3. Admin can filter instructors by active status
4. Admin can create new instructor with validation
5. Admin can edit existing instructor details
6. Admin can deactivate/reactivate instructors
7. Dropdown endpoint returns active instructors for Group Management integration
8. All operations require appropriate permissions
9. UI follows existing admin portal design patterns

---

## 10. Dependencies

### Requires
- Existing admin authentication system
- Supabase database access
- Permission system (already exists)

### Required By
- **Group Management PRD** - Uses instructor dropdown for assignments
- **Instructor Portal PRD** - Uses instructor records for portal access

---

## 11. Future Considerations

1. **Portal Access Management**: Link instructor records to Supabase auth users for portal login
2. **Bulk Import**: CSV import for multiple instructors
3. **Profile Photos**: Avatar/photo upload capability
4. **Availability Settings**: Instructor availability preferences
5. **Performance Metrics**: Track instructor teaching history and ratings
