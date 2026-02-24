# PRD: Instructor Auth Provisioning

**Version:** 1.0.0
**Created:** February 11, 2026
**Status:** Draft
**Confidence Score:** 9/10
**Estimated Effort:** 1-1.5 days

---

## 1. Overview

### 1.1 Purpose
Bridge the gap between the Instructor Management module and the Instructor Portal by provisioning Supabase Auth accounts for instructors at creation time. When an admin creates an instructor, the system also creates a Supabase Auth user with a password set by the admin, links the two records via `auth_user_id`, and embeds role claims in the JWT so the instructor can log in via the existing `/login` page and be routed to the instructor dashboard.

### 1.2 Problem Statement
The Instructor Management PRD defers auth to the Instructor Portal PRD. The Instructor Portal PRD assumes `auth_user_id` is already populated. Neither owns the step that actually creates the auth account and sets JWT claims. This PRD fills that gap.

### 1.3 Scope
- Extend instructor `create.js` to also create a Supabase Auth user with admin-set password
- Assign `instructor` role via `user_roles` table (JWT claims injected by `custom_access_token_hook`)
- Populate `auth_user_id` on the instructor record (used for reverse-lookup — no `app_metadata` needed)
- Add password field to `InstructorFormModal.jsx` (create mode only)
- Sync auth user state on instructor deactivation/reactivation/email change/deletion
- Update validation schemas

### 1.4 Out of Scope
- Instructor portal UI (covered in Instructor Portal PRD)
- Role-based frontend routing (covered in Instructor Portal PRD)
- Instructor self-service password reset (can use existing `/reset-password` flow)
- Magic link / invite-based onboarding (future enhancement)

### 1.5 Key Decision: Password Hashing
**Supabase handles all password hashing and salting internally.** The `supabaseAdmin.auth.admin.createUser()` API accepts a plaintext password and Supabase hashes it using bcrypt before storing. This is identical to how existing admin users work — no custom hashing code is needed.

---

## 2. Architecture

### 2.1 How It Connects

```
Admin creates instructor (name + email + password)
         │
         ├─→ 1. Create Supabase Auth user via supabaseAdmin.auth.admin.createUser()
         │      - email + password (Supabase hashes internally)
         │      - email_confirm: true (skip email verification)
         │
         ├─→ 2. Insert instructor record in hubspot_sync.instructors
         │      - instructor_name, email, is_active
         │      - auth_user_id = auth user's UUID from step 1
         │
         ├─→ 3. Insert role into public.user_roles table
         │      - user_id = auth user UUID, role = 'instructor'
         │      - custom_access_token_hook injects role + permissions into JWT on login
         │
         └─→ 4. Instructor can now log in at /login
                - Same login page, same login API endpoint
                - JWT contains user_role: "instructor" (from hook)
                - JWT contains permissions: [...] (from hook via role_permissions table)
                - Instructor record looked up via: instructors.auth_user_id = JWT.sub
                - Frontend reads role → routes to /instructor dashboard
```

**No `app_metadata` needed.** The `instructors` table already has `auth_user_id` pointing to the auth user. Any endpoint that needs the instructor record simply queries:
```javascript
const { data: instructor } = await supabaseAdmin
  .from('instructors')
  .select('*')
  .eq('auth_user_id', req.user.id)  // req.user.id = JWT 'sub' claim
  .single();
```

### 2.2 Why No Custom Password Handling

The existing login flow (`admin_root/api/admin/auth/login.js`) calls `supabasePublic.auth.signInWithPassword()`. Supabase validates the password against its internally stored bcrypt hash. The `verifyToken()` function in `admin_root/api/_shared/supabase.js` already extracts `user_role`, `permissions`, and `role_assigned_at` from the JWT payload (lines 66-75). These claims are injected by the `custom_access_token_hook` which queries the `user_roles` and `role_permissions` tables on every login/token refresh.

### 2.3 JWT Claims via custom_access_token_hook (Mechanism A)

**This system uses table-based RBAC. No `app_metadata` is used.**

The `custom_access_token_hook` is a PL/pgSQL function that runs on every login and token refresh. It:
1. Looks up the user's role from `public.user_roles` table
2. Looks up the role's permissions from `public.role_permissions` table
3. Injects `user_role`, `permissions`, and `role_assigned_at` directly into the JWT claims

When an instructor logs in, the hook produces a JWT like:
```json
{
  "sub": "auth-user-uuid",
  "email": "instructor@prepdoctors.com",
  "user_role": "instructor",
  "permissions": ["groups.view", "workcheck.edit", "workcheck.view", "workcheck.create"],
  "role_assigned_at": "2026-02-11T10:30:00.000Z"
}
```

**Role & Permissions**: Come from the hook (tables) — we INSERT into `user_roles` at creation time.
**instructor_id**: NOT in the JWT. Looked up at request time via `instructors.auth_user_id = JWT.sub`.

The existing `verifyToken()` → `decodeJwtPayload()` chain already reads `user_role` and `permissions` from the JWT. **No changes to `verifyToken()` are needed.** Instructor portal endpoints that need the instructor record query the `instructors` table directly:

```javascript
// In any instructor portal endpoint or middleware
const { data: instructor } = await supabaseAdmin
  .from('instructors')
  .select('id, instructor_name, email, is_active')
  .eq('auth_user_id', req.user.id)
  .single();
```

---

## 3. Backend Changes

### 3.1 Modified: `admin_root/api/admin/instructors/create.js`

**Current behavior:** Inserts `instructor_name`, `email`, `is_active` into `instructors` table.

**New behavior:** Also creates a Supabase Auth user and links via `auth_user_id`.

```javascript
/**
 * POST /api/admin/instructors/create
 * Create a new instructor with Supabase Auth account
 * Permission: 'workcheck.create'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
    });
  }

  try {
    await requirePermission(req, 'workcheck.create');

    // Validate request body (now includes password)
    const validator = validationMiddleware('instructorCreate');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { instructor_name, email, password } = req.validatedData;
    const normalizedEmail = email.toLowerCase().trim();

    console.log('[Instructor Create] Creating instructor:', { instructor_name, email: normalizedEmail });

    // Check for duplicate email in instructors table
    const { data: existingInstructor } = await supabaseAdmin
      .from('instructors')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    if (existingInstructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An instructor with this email already exists'
        }
      });
    }

    // Step 1: Create Supabase Auth user
    // Supabase handles password hashing (bcrypt) internally
    // NOTE: Do NOT set user_role or permissions in app_metadata — the custom_access_token_hook
    // injects these from the user_roles and role_permissions tables on login/refresh
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true // Skip email verification — admin is vouching for the email
    });

    if (authError) {
      console.error('[Auth ERROR] Failed to create auth user:', authError.message);

      // Handle duplicate auth user (email already exists in auth.users)
      if (authError.message?.includes('already been registered') || authError.status === 422) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AUTH_EMAIL_EXISTS',
            message: 'A login account with this email already exists in the system'
          }
        });
      }

      throw new Error(`Failed to create auth account: ${authError.message}`);
    }

    const authUserId = authData.user.id;

    // Step 2: Insert instructor record with auth_user_id link
    const { data: newInstructor, error: insertError } = await supabaseAdmin
      .from('instructors')
      .insert({
        instructor_name: instructor_name.trim(),
        email: normalizedEmail,
        is_active: true,
        auth_user_id: authUserId
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Supabase ERROR] Instructor insert failed:', insertError.message);

      // Rollback: delete the auth user we just created
      console.log('[Rollback] Deleting auth user:', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      if (insertError.code === '23505') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An instructor with this email already exists'
          }
        });
      }

      throw new Error(`Failed to create instructor: ${insertError.message}`);
    }

    // Step 3: Assign 'instructor' role via user_roles table
    // The custom_access_token_hook reads this table on login to inject user_role + permissions into JWT
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUserId,
        role: 'instructor',
        granted_by: req.user?.id || null, // The admin who created this instructor
        notes: `Auto-provisioned on instructor creation for ${instructor_name}`
      });

    if (roleError) {
      console.error('[RBAC ERROR] Failed to assign instructor role:', roleError.message);
      // Rollback: delete auth user and instructor record
      console.log('[Rollback] Cleaning up auth user and instructor record');
      await supabaseAdmin.from('instructors').delete().eq('id', newInstructor.id);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    // No app_metadata needed — instructor portal endpoints look up the instructor
    // record via: SELECT * FROM instructors WHERE auth_user_id = req.user.id

    console.log(`[Instructor Created] ${newInstructor.id} - ${instructor_name} (auth: ${authUserId})`);

    res.status(201).json({
      success: true,
      message: 'Instructor created successfully',
      data: {
        id: newInstructor.id,
        instructor_name: newInstructor.instructor_name,
        email: newInstructor.email,
        is_active: newInstructor.is_active,
        auth_user_id: newInstructor.auth_user_id,
        has_portal_access: true,
        created_at: newInstructor.created_at,
        updated_at: newInstructor.updated_at
      }
    });

  } catch (error) {
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error('Error creating instructor:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to create instructor'
    });
  }
};
```

### 3.2 Modified: `admin_root/api/admin/instructors/[id].js` — PUT handler

When updating an instructor, sync relevant changes to the auth user:

**Email change:** Update the auth user's email via `supabaseAdmin.auth.admin.updateUserById()`.

**Deactivation (`is_active: false`):** Ban the auth user so they cannot log in:
```javascript
await supabaseAdmin.auth.admin.updateUserById(authUserId, {
  ban_duration: '876000h' // ~100 years = effectively permanent
});
```

**Reactivation (`is_active: true`):** Unban the auth user:
```javascript
await supabaseAdmin.auth.admin.updateUserById(authUserId, {
  ban_duration: 'none'
});
```

**Implementation pattern for PUT handler additions:**
```javascript
// After successfully updating the instructor record...

// Sync auth user if instructor has portal access
if (updatedInstructor.auth_user_id) {
  const authUpdates = {};

  // Sync email change
  if (updates.email !== undefined) {
    authUpdates.email = updates.email.toLowerCase().trim();
  }

  // Sync active status (ban/unban)
  if (updates.is_active !== undefined) {
    authUpdates.ban_duration = updates.is_active ? 'none' : '876000h';
  }

  if (Object.keys(authUpdates).length > 0) {
    const { error: authSyncError } = await supabaseAdmin.auth.admin.updateUserById(
      updatedInstructor.auth_user_id,
      authUpdates
    );

    if (authSyncError) {
      // Non-fatal: log but don't fail the request
      console.error('[Auth Sync WARNING] Failed to sync auth user:', authSyncError.message);
    }
  }
}
```

### 3.3 Modified: `admin_root/api/admin/instructors/[id].js` — DELETE handler (soft delete)

The existing soft delete sets `is_active = false`. Add auth user ban to prevent login:

```javascript
// After soft delete succeeds...
if (deletedInstructor.auth_user_id) {
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
    deletedInstructor.auth_user_id,
    { ban_duration: '876000h' }
  );

  if (banError) {
    console.error('[Auth Sync WARNING] Failed to ban auth user:', banError.message);
  }
}
```

### 3.4 Modified: `admin_root/api/admin/instructors/bulk-delete.js` (hard delete)

The existing hard delete removes the instructor row entirely. Also delete the auth user and clean up the `user_roles` row:

```javascript
// Before or after hard deleting the instructor row...
if (instructor.auth_user_id) {
  // Remove role assignment (the CASCADE on auth.users deletion would also handle this,
  // but explicit cleanup is safer if delete order varies)
  await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', instructor.auth_user_id);

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
    instructor.auth_user_id
  );

  if (authDeleteError) {
    console.error('[Auth WARNING] Failed to delete auth user:', authDeleteError.message);
  }
}
```

**Note:** The `user_roles` table has `ON DELETE CASCADE` on the `user_id` FK to `auth.users`, so deleting the auth user would also remove the role row. The explicit delete above is a safety measure in case the operation order varies.

### 3.5 Modified: `admin_root/api/admin/instructors/bulk-toggle-status.js`

When bulk toggling, sync the ban/unban for each instructor with an `auth_user_id`:

```javascript
// For each instructor being toggled...
if (instructor.auth_user_id) {
  await supabaseAdmin.auth.admin.updateUserById(
    instructor.auth_user_id,
    { ban_duration: newActiveState ? 'none' : '876000h' }
  );
}
```

### 3.6 Optional: New endpoint `admin_root/api/admin/instructors/[id]/reset-password.js`

Allow admins to reset an instructor's password directly:

```javascript
/**
 * POST /api/admin/instructors/:id/reset-password
 * Admin resets an instructor's password
 * Permission: 'workcheck.edit'
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  }

  try {
    await requirePermission(req, 'workcheck.edit');

    const { id } = req.query;
    const { new_password } = req.body;

    // Validate password
    // ... (use Joi schema)

    // Get instructor record
    const { data: instructor } = await supabaseAdmin
      .from('instructors')
      .select('id, auth_user_id, instructor_name')
      .eq('id', id)
      .single();

    if (!instructor || !instructor.auth_user_id) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Instructor or auth account not found' }
      });
    }

    // Update password — Supabase handles hashing
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      instructor.auth_user_id,
      { password: new_password }
    );

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Password updated for ${instructor.instructor_name}`
    });

  } catch (error) {
    // ... standard error handling
  }
};
```

---

## 4. Validation Schema Changes

### 4.1 Modified: `instructorCreate` schema

Add a `password` field to the existing schema in `admin_root/api/_shared/validation.js`:

```javascript
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
    }),
  password: Joi.string()
    .min(8)
    .max(72)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password cannot exceed 72 characters',
      'any.required': 'Password is required'
    })
}),
```

**Note:** The max of 72 characters matches bcrypt's input limit (Supabase uses bcrypt internally).

### 4.2 New: `instructorResetPassword` schema

```javascript
instructorResetPassword: Joi.object({
  new_password: Joi.string()
    .min(8)
    .max(72)
    .required()
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password cannot exceed 72 characters',
      'any.required': 'New password is required'
    })
}),
```

---

## 5. Frontend Changes

### 5.1 Modified: `InstructorFormModal.jsx`

Add a password field that appears **only in create mode** (not edit mode):

**Form state change:**
```javascript
const [formData, setFormData] = useState({
  instructor_name: '',
  email: '',
  password: ''       // NEW
});
```

**Reset on open (create mode only):**
```javascript
useEffect(() => {
  if (isOpen) {
    if (initialData) {
      setFormData({
        instructor_name: initialData.instructor_name || '',
        email: initialData.email || '',
        password: ''  // Never pre-fill password in edit mode
      });
    } else {
      setFormData({
        instructor_name: '',
        email: '',
        password: ''
      });
    }
    setErrors({});
  }
}, [isOpen, initialData]);
```

**Validation addition:**
```javascript
// Only validate password in create mode
if (mode === 'create') {
  if (!formData.password) {
    newErrors.password = 'Password is required';
  } else if (formData.password.length < 8) {
    newErrors.password = 'Password must be at least 8 characters';
  }
}
```

**Submit data (only include password in create mode):**
```javascript
const submitData = {
  instructor_name: formData.instructor_name.trim(),
  email: formData.email.trim().toLowerCase()
};

if (mode === 'create') {
  submitData.password = formData.password;
}

onSubmit(submitData);
```

**New JSX block — password field (rendered only in create mode):**
```jsx
{mode === 'create' && (
  <div>
    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      Password <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        name="password"
        id="password"
        value={formData.password}
        onChange={handleChange}
        disabled={isLoading}
        className={errors.password ? inputErrorClass : inputNormalClass}
        placeholder="Minimum 8 characters"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
      >
        {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
    {errors.password && (
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
    )}
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Share this password with the instructor for portal login.
    </p>
  </div>
)}
```

### 5.2 Portal Access Indicator

In the `InstructorTable.jsx`, optionally show a badge or icon indicating whether the instructor has portal access (i.e., `auth_user_id` is not null):

```jsx
// In the table row, near the status column
{instructor.auth_user_id && (
  <span className="inline-flex items-center text-xs text-green-600" title="Has portal access">
    <KeyIcon className="h-3 w-3 mr-1" />
    Portal
  </span>
)}
```

### 5.3 Password Reset Action (Optional Enhancement)

Add a "Reset Password" option to the instructor row actions dropdown or detail view. This would open a small modal with a single password input that calls the `reset-password` endpoint.

---

## 6. Existing Instructor Backfill

### 6.1 Problem
Instructors created before this feature will have `auth_user_id = null` and no Supabase Auth account.

### 6.2 Solution Options

**Option A: Admin manually provisions** (recommended for small numbers)
- Add a "Provision Portal Access" button on the instructor detail/edit view
- Only shown when `auth_user_id` is null
- Opens a modal with a password field
- Calls a new endpoint that creates the auth user and links it

**Option B: Bulk provisioning script** (for many existing instructors)
- One-time helper script that iterates through instructors with `auth_user_id = null`
- Creates auth users with generated passwords
- Outputs a CSV of email + temporary password for admin to distribute

Option A is recommended — the existing instructor count is small, and it keeps the admin in control of password distribution.

### 6.3 Provision Portal Access Endpoint

```javascript
/**
 * POST /api/admin/instructors/:id/provision-access
 * Create auth account for an existing instructor that doesn't have one
 * Permission: 'workcheck.create'
 */
```

This follows the same logic as the create flow (Steps 1-3 from Section 3.1) but for an existing instructor record:
1. Create auth user with password
2. INSERT into `user_roles` with `role: 'instructor'`
3. Update `auth_user_id` on the existing instructor row

---

## 7. Error Handling

### 7.1 Rollback Strategy

The create flow involves three systems (Supabase Auth + instructors table + user_roles table). If any step fails after a previous step succeeded, we roll back in reverse order:

```
1. Create auth user     → Success
2. Insert instructor    → FAILS → Rollback: Delete auth user from step 1
```

```
1. Create auth user     → Success
2. Insert instructor    → Success
3. Insert user_roles    → FAILS → Rollback: Delete instructor from step 2, delete auth user from step 1
```

If all three steps succeed, the instructor is fully provisioned. There is no step 4 — no `app_metadata` to set.

### 7.2 Error Scenarios

| Scenario | Error Code | User Message |
|----------|-----------|--------------|
| Email exists in `auth.users` but not in `instructors` | `AUTH_EMAIL_EXISTS` | "A login account with this email already exists in the system" |
| Email exists in `instructors` but not in `auth.users` | `DUPLICATE_EMAIL` | "An instructor with this email already exists" |
| Email exists in both | `DUPLICATE_EMAIL` | "An instructor with this email already exists" (caught by pre-check) |
| Password too short | Validation error | "Password must be at least 8 characters" |
| Supabase Auth service error | `AUTH_SERVICE_ERROR` | "Failed to create login account. Please try again." |

---

## 8. Security Considerations

1. **Password is transmitted over HTTPS** — the admin sends the password in the request body, which is encrypted in transit. The password is never logged.
2. **Supabase hashes with bcrypt** — we never see or store the plaintext password. It's passed directly to `supabaseAdmin.auth.admin.createUser()` which handles hashing.
3. **No password in logs** — the `console.log` in the create endpoint must NOT include the password field. Only log `instructor_name` and `email`.
4. **No password in responses** — the API response never includes the password.
5. **Admin-only operation** — requires `workcheck.create` permission, limited to `super_admin` and `admin` roles.
6. **email_confirm: true** — skips email verification since the admin is creating the account on behalf of the instructor. This matches the trusted internal-user model.

---

## 9. Vercel.json Route Configuration

Add the new endpoint routes:

```json
{
  "src": "/api/admin/instructors/([^/]+)/reset-password",
  "dest": "/api/admin/instructors/[id]/reset-password.js"
},
{
  "src": "/api/admin/instructors/([^/]+)/provision-access",
  "dest": "/api/admin/instructors/[id]/provision-access.js"
}
```

---

## 10. Database Prerequisites (RBAC Table Updates)

### 10.1 Add 'instructor' to `app_role` Enum

The `app_role` enum currently has: `super_admin`, `admin`, `coordinator`, `viewer`. Add `instructor`:

```sql
-- Add 'instructor' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'instructor';
```

**Note:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block. Run this as a standalone statement.

### 10.2 Verify Instructor Permissions in `app_permission` Enum

The user has confirmed that `app_permission` values have been updated directly on the database. Verify these instructor permissions exist:

```sql
-- Check if instructor permissions already exist in the enum
SELECT unnest(enum_range(NULL::app_permission)) AS permission
WHERE unnest(enum_range(NULL::app_permission))::TEXT IN ('groups.view', 'workcheck.edit', 'workcheck.view', 'workcheck.create');
```

If not present, add them:
```sql
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'groups.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'workcheck.edit';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'workcheck.view';
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'workcheck.create';
```

### 10.3 Seed `role_permissions` for Instructor Role

Map the instructor role to its permissions in the `role_permissions` table:

```sql
-- Seed instructor role permissions (already seeded — verified from live database)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('instructor', 'groups.view'),
  ('instructor', 'workcheck.edit'),
  ('instructor', 'workcheck.view'),
  ('instructor', 'workcheck.create')
ON CONFLICT (role, permission) DO NOTHING;
```

### 10.4 No Changes to `verifyToken()`

**No modifications needed.** The existing `verifyToken()` already extracts `user_role` and `permissions` from the JWT (injected by the hook). Since `instructor_id` is not in the JWT, there's nothing new to extract.

Instructor portal endpoints that need the instructor record use a simple query:
```javascript
const { data: instructor } = await supabaseAdmin
  .from('instructors')
  .select('id, instructor_name, email, is_active')
  .eq('auth_user_id', req.user.id)  // req.user.id comes from verifyToken()
  .single();
```

This query uses the existing `auth_user_id` column which is already indexed.

---

## 11. Implementation Checklist

### Phase 0: Database Prerequisites (0.25 day)
- [ ] Add `'instructor'` to `app_role` enum (`ALTER TYPE app_role ADD VALUE`)
- [ ] Verify instructor permissions exist in `app_permission` enum (user confirmed they were added directly)
- [ ] Seed `role_permissions` table with instructor role → permission mappings
- [ ] Test: verify `custom_access_token_hook` returns correct claims for instructor role

### Phase 1: Backend — Create Flow (0.5 day)
- [ ] Update `instructorCreate` Joi schema to include `password` field
- [ ] Modify `create.js` to create Supabase Auth user
- [ ] Add `user_roles` table INSERT with `role: 'instructor'` after auth user creation
- [ ] Implement full rollback chain (delete role → delete instructor → delete auth user on failure)
- [ ] Add `instructorResetPassword` Joi schema
- [ ] Test: create instructor → verify auth user exists → verify user_roles row → log in → verify JWT claims from hook

### Phase 2: Backend — Sync on Update/Delete (0.5 day)
- [ ] Modify `[id].js` PUT to sync email changes to auth user
- [ ] Modify `[id].js` PUT to ban/unban auth user on `is_active` toggle
- [ ] Modify `[id].js` DELETE to ban auth user on soft delete
- [ ] Modify `bulk-toggle-status.js` to ban/unban auth users
- [ ] Modify `bulk-delete.js` to delete auth users AND clean up `user_roles` on hard delete
- [ ] Create `[id]/reset-password.js` endpoint
- [ ] Test: deactivate instructor → verify login fails → reactivate → verify login works

### Phase 3: Frontend (0.5 day)
- [ ] Add password field + show/hide toggle to `InstructorFormModal.jsx` (create mode only)
- [ ] Add client-side password validation (min 8 chars)
- [ ] Update `onSubmit` to include password in create mode payload
- [ ] Add portal access indicator to `InstructorTable.jsx`
- [ ] Test: full create flow through UI → verify instructor can log in at `/login`

### Phase 4: Backfill (optional, 0.25 day)
- [ ] Create `[id]/provision-access.js` endpoint (creates auth user, INSERTs into `user_roles`, sets `auth_user_id`)
- [ ] Add "Provision Portal Access" button to instructor edit view (when `auth_user_id` is null)
- [ ] Test: provision existing instructor → verify `user_roles` row created → verify they can log in

---

## 12. Success Criteria

1. Admin creates an instructor with name, email, and password via the existing UI
2. A row is inserted into `user_roles` with `role: 'instructor'` for the new auth user
3. The instructor can immediately log in at `/login` using their email and password
4. The instructor's JWT contains `user_role: "instructor"` and `permissions: [...]` (both from hook). No `app_metadata` needed.
5. Instructor portal endpoints resolve the instructor record via `instructors.auth_user_id = JWT.sub`
6. Deactivating an instructor prevents them from logging in
7. Reactivating an instructor restores their ability to log in
8. Changing an instructor's email updates their login email
9. Hard deleting an instructor removes their auth account and `user_roles` row
10. Admin can reset an instructor's password
11. Existing instructors (created before this feature) can be backfilled with portal access (including `user_roles` INSERT)
12. No plaintext passwords appear in logs or API responses

---

## 13. Dependencies

### Requires
- Existing instructor management module (CRUD endpoints + UI)
- Existing Supabase Auth system (`supabaseAdmin.auth.admin.*` APIs)
- Existing login flow (`/login` page + `/api/admin/auth/login` endpoint)
- Existing `verifyToken()` that extracts `user_role` and `permissions` from JWT
- **RBAC tables deployed** (`user_roles`, `role_permissions`) with `custom_access_token_hook` enabled (Mechanism A — confirmed active)
- `app_role` enum must include `'instructor'` (Phase 0 prerequisite)
- `app_permission` enum must include instructor permissions (confirmed updated on database)

### Required By
- **Instructor Portal PRD** — depends on `auth_user_id` being populated and JWT containing role claims; portal endpoints resolve instructor record via `instructors.auth_user_id = JWT.sub`
- **Role-Based Routing** — depends on `user_role: "instructor"` being in the JWT

---

## 14. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| **Database** | SQL | Add `'instructor'` to `app_role` enum |
| **Database** | SQL | Verify/add instructor permissions to `app_permission` enum |
| **Database** | SQL | Seed `role_permissions` table with instructor role mappings |
| `admin_root/api/_shared/validation.js` | MODIFY | Add `password` to `instructorCreate`, add `instructorResetPassword` schema |
| `admin_root/api/admin/instructors/create.js` | MODIFY | Create Supabase Auth user, INSERT into `user_roles`, link `auth_user_id` |
| `admin_root/api/admin/instructors/[id].js` | MODIFY | Sync email/ban status to auth user on PUT; ban on DELETE |
| `admin_root/api/admin/instructors/bulk-toggle-status.js` | MODIFY | Ban/unban auth users when toggling |
| `admin_root/api/admin/instructors/bulk-delete.js` | MODIFY | Delete auth users + clean up `user_roles` on hard delete |
| `admin_root/api/admin/instructors/[id]/reset-password.js` | NEW | Admin password reset endpoint |
| `admin_root/api/admin/instructors/[id]/provision-access.js` | NEW | Backfill portal access for existing instructors (includes `user_roles` INSERT) |
| `admin_root/admin_frontend/src/components/admin/InstructorFormModal.jsx` | MODIFY | Add password field in create mode |
| `admin_root/vercel.json` | MODIFY | Add routes for new endpoints |

**Notably NOT modified:** `admin_root/api/_shared/supabase.js` — no changes to `verifyToken()` needed.
