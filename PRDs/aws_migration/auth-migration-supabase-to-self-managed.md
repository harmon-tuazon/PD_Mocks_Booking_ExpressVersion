# PRD: Authentication Migration — Supabase Auth to Self-Managed JWT

**Version:** 1.0.0
**Created:** February 11, 2026
**Status:** Draft
**Confidence Score:** 9/10
**Estimated Effort:** 3-4 days
**Companion To:** `aws-full-migration-with-shared-architecture.md`

---

## 1. Overview

### 1.1 Purpose
The existing AWS migration PRD covers database (Supabase → RDS), cache (Upstash → ElastiCache), and compute (Vercel → EC2). It does not address authentication. This PRD fills that gap by replacing all Supabase Auth dependencies with a self-managed JWT auth system backed by RDS PostgreSQL, `bcryptjs`, and `jsonwebtoken`.

### 1.2 Why Self-Managed Over Cognito

| Factor | Amazon Cognito | Self-Managed JWT |
|--------|----------------|------------------|
| Custom JWT claims (`user_role`, `permissions`, `instructor_id`) | Requires Pre-Token-Generation Lambda trigger | Built-in — read from `admin_users` table at sign time |
| Existing dependencies | New SDK (`@aws-sdk/client-cognito-identity-provider`) | Already in `package.json` (`bcryptjs`, `jsonwebtoken`) |
| User base size | Designed for thousands/millions | Small admin + instructor pool — Cognito is overkill |
| Complexity | Verbose API, Lambda trigger for RBAC, Cognito quirks | Straightforward SQL + bcrypt + jwt |
| Cost | Free tier covers it, but adds Lambda invocations | Zero additional cost (queries against existing RDS) |
| Vendor lock-in | Shifts from Supabase to AWS Cognito | No vendor dependency — standard JWT |

### 1.3 Scope

**In scope:**
- `admin_root` backend: Replace all 11 Supabase Auth API calls
- `admin_root` frontend: Remove `@supabase/supabase-js` and `@supabase/auth-helpers-react`, replace with pure axios/localStorage auth
- `user_root`: Verify no changes needed (credential-based lookup only)
- RDS schema: Create `admin_users` and `refresh_tokens` tables
- Data migration: Export existing Supabase Auth users to RDS
- JWT signing key management via AWS Secrets Manager

**Out of scope:**
- User app auth upgrade (students still use student_id + email lookup)
- MFA implementation (future enhancement)
- OAuth/social login (not needed for internal admin tool)

---

## 2. Current State Audit

### 2.1 Admin App — Supabase Auth Touchpoints (11 total)

#### Backend (8 files)

| # | File | Supabase Auth Call | Purpose |
|---|------|-------------------|---------|
| 1 | `api/admin/auth/login.js:75` | `supabasePublic.auth.signInWithPassword()` | Authenticate admin/instructor |
| 2 | `api/_shared/supabase.js:60` | `supabaseAdmin.auth.getUser(token)` | Verify JWT on every request |
| 3 | `api/admin/auth/refresh.js:46` | `supabasePublic.auth.refreshSession()` | Rotate access token |
| 4 | `api/admin/auth/logout.js:37` | `supabaseAdmin.auth.admin.signOut(token)` | Server-side session invalidation |
| 5 | `api/admin/auth/request-otp.js:67` | `supabaseAdmin.auth.admin.listUsers()` | Find user by email for OTP |
| 6 | `api/admin/auth/update-password.js:79-91` | `supabaseAdmin.auth.admin.listUsers()` + `updateUserById()` | Reset password |
| 7 | `api/admin/instructors/create.js` (new) | `supabaseAdmin.auth.admin.createUser()` | Provision instructor auth |
| 8 | `api/admin/instructors/[id].js` (new) | `supabaseAdmin.auth.admin.updateUserById()` | Ban/unban, email sync |

#### Frontend (3 files)

| # | File | Supabase Auth Call | Purpose |
|---|------|-------------------|---------|
| 9 | `utils/supabaseClient.js` | `supabase.auth.signInWithPassword()`, `.signOut()`, `.getSession()`, `.getUser()`, `.refreshSession()`, `.onAuthStateChange()` | Client-side auth helpers |
| 10 | `contexts/AuthContext.jsx:269` | `supabase.auth.setSession()` | Store tokens in Supabase internal storage |
| 11 | `contexts/AuthContext.jsx:98,157,372` | `supabase.auth.refreshSession()`, `.getSession()` | Token refresh, session restore |

#### Frontend npm Dependencies to Remove

| Package | Current Version |
|---------|----------------|
| `@supabase/supabase-js` | `^2.76.1` |
| `@supabase/auth-helpers-react` | `^0.5.0` |

#### Frontend Environment Variables to Remove

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### 2.2 User App — No Supabase Auth Dependencies

The user app uses a **credential-based lookup** system:
- Login: `POST /api/user/login` with `{ student_id, email }` → looks up `hubspot_contact_credits` table
- Every API call: passes `student_id` + `email` as query params or body fields → re-verified via DB lookup
- Session: Browser cookie with 2-hour expiry (client-side only)
- No passwords, no JWTs, no tokens, no `supabase.auth.*` calls

**Migration impact:** Zero. The `hubspot_contact_credits` lookup query works identically on RDS PostgreSQL. The user app only uses `supabaseAdmin` as a data client (`.from().select()`), which the main AWS migration PRD already covers.

---

## 3. Target Architecture

### 3.1 RDS Schema

```sql
-- ============================================================
-- ADMIN USERS TABLE
-- Replaces Supabase auth.users for admin/instructor accounts
-- ============================================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash (60 chars)
    user_role VARCHAR(50) NOT NULL DEFAULT 'viewer',  -- 'admin', 'super_admin', 'instructor', 'viewer'
    permissions TEXT[] DEFAULT '{}',              -- e.g., '{workcheck.view,workcheck.create}'
    instructor_id UUID,                          -- FK to instructors table (NULL for non-instructors)
    is_active BOOLEAN DEFAULT true,
    display_name VARCHAR(255),                   -- Optional display name
    last_sign_in TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(user_role);
CREATE INDEX idx_admin_users_instructor ON admin_users(instructor_id);

-- Updated_at trigger
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- REFRESH TOKENS TABLE
-- Server-side refresh token tracking for token rotation
-- ============================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,            -- SHA-256 hash of the refresh token
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Auto-cleanup expired tokens (run periodically or via pg_cron)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true;
```

### 3.2 JWT Structure

**Access Token** (short-lived, 15 minutes):
```json
{
  "sub": "user-uuid",
  "email": "admin@prepdoctors.com",
  "user_role": "instructor",
  "permissions": ["instructor.view_groups", "instructor.view_schedule"],
  "instructor_id": "instructor-uuid-or-null",
  "role_assigned_at": "2026-01-27T10:00:00Z",
  "iat": 1707600000,
  "exp": 1707600900
}
```

**Refresh Token** (long-lived, 7 days):
- Opaque random string (64 bytes, hex-encoded)
- Stored as SHA-256 hash in `refresh_tokens` table
- Rotated on every use (old token revoked, new one issued)

### 3.3 Signing Key Management

Store the JWT signing secret in AWS Secrets Manager:
```json
{
  "SecretId": "prepdoctors-jwt-signing-key",
  "SecretString": {
    "access_token_secret": "random-256-bit-key",
    "refresh_token_secret": "different-random-256-bit-key"
  }
}
```

Load at server startup alongside DB credentials (same pattern as `database.js` in the main migration PRD):
```javascript
// src/config/auth.js
const { getSecret } = require('./secrets');

let jwtSecrets = null;

async function initializeAuth() {
  jwtSecrets = await getSecret('prepdoctors-jwt-signing-key');
}

function getJwtSecrets() {
  if (!jwtSecrets) throw new Error('Auth not initialized');
  return jwtSecrets;
}

module.exports = { initializeAuth, getJwtSecrets };
```

---

## 4. Backend Migration — File-by-File

### 4.1 New: `src/services/auth-service.js`

Central auth service replacing all Supabase Auth calls:

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool } = require('../config/database');
const { getJwtSecrets } = require('../config/auth');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Hash a password with bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password against hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT access token with user claims
 */
function generateAccessToken(user) {
  const { access_token_secret } = getJwtSecrets();

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      user_role: user.user_role,
      permissions: user.permissions || [],
      instructor_id: user.instructor_id || null,
      role_assigned_at: user.updated_at
    },
    access_token_secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Verify and decode an access token
 */
function verifyAccessToken(token) {
  const { access_token_secret } = getJwtSecrets();
  return jwt.verify(token, access_token_secret);
}

/**
 * Generate a random refresh token and store its hash
 */
async function generateRefreshToken(userId) {
  const pool = getPool();
  const rawToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  return { rawToken, expiresAt };
}

/**
 * Validate a refresh token and return the user
 * Implements token rotation: old token revoked, new one issued
 */
async function rotateRefreshToken(rawToken) {
  const pool = getPool();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Find and revoke the old token in one atomic operation
  const result = await pool.query(`
    UPDATE refresh_tokens
    SET revoked = true, revoked_at = NOW()
    WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()
    RETURNING user_id
  `, [tokenHash]);

  if (result.rows.length === 0) {
    return null; // Token invalid, expired, or already revoked
  }

  const userId = result.rows[0].user_id;

  // Fetch the user
  const userResult = await pool.query(
    'SELECT * FROM admin_users WHERE id = $1 AND is_active = true',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return null; // User deleted or deactivated
  }

  // Issue a new refresh token
  const newRefresh = await generateRefreshToken(userId);

  return {
    user: userResult.rows[0],
    newRefreshToken: newRefresh.rawToken,
    expiresAt: newRefresh.expiresAt
  };
}

/**
 * Revoke all refresh tokens for a user (logout)
 */
async function revokeAllTokens(userId) {
  const pool = getPool();
  await pool.query(
    'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id = $1 AND revoked = false',
    [userId]
  );
}

/**
 * Create a new user (admin or instructor)
 */
async function createUser({ email, password, user_role, permissions, instructor_id, display_name }) {
  const pool = getPool();
  const passwordHash = await hashPassword(password);

  const result = await pool.query(`
    INSERT INTO admin_users (email, password_hash, user_role, permissions, instructor_id, display_name)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, user_role, permissions, instructor_id, display_name, is_active, created_at
  `, [email, passwordHash, user_role || 'viewer', permissions || [], instructor_id || null, display_name || null]);

  return result.rows[0];
}

/**
 * Find user by email
 */
async function findUserByEmail(email) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM admin_users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

/**
 * Update user password
 */
async function updatePassword(userId, newPassword) {
  const pool = getPool();
  const passwordHash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE admin_users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

/**
 * Update user properties (email, role, ban, etc.)
 */
async function updateUser(userId, updates) {
  const pool = getPool();
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await pool.query(
    `UPDATE admin_users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0];
}

/**
 * Delete user permanently
 */
async function deleteUser(userId) {
  const pool = getPool();
  // Cascade delete handles refresh_tokens via FK
  await pool.query('DELETE FROM admin_users WHERE id = $1', [userId]);
}

/**
 * Cleanup expired and revoked refresh tokens
 */
async function cleanupTokens() {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true'
  );
  return result.rowCount;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
  createUser,
  findUserByEmail,
  updatePassword,
  updateUser,
  deleteUser,
  cleanupTokens
};
```

### 4.2 Migrated: `auth/login.js`

**Before (Supabase):**
```javascript
const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
```

**After (self-managed):**
```javascript
const { findUserByEmail, comparePassword, generateAccessToken, generateRefreshToken } = require('../services/auth-service');

// Find user
const user = await findUserByEmail(email);
if (!user || !user.is_active) {
  return res.status(401).json({ /* invalid credentials */ });
}

// Verify password (bcrypt compare)
const valid = await comparePassword(password, user.password_hash);
if (!valid) {
  return res.status(401).json({ /* invalid credentials */ });
}

// Generate tokens
const accessToken = generateAccessToken(user);
const { rawToken: refreshToken, expiresAt } = await generateRefreshToken(user.id);

// Update last_sign_in
await pool.query('UPDATE admin_users SET last_sign_in = NOW() WHERE id = $1', [user.id]);

// Set cookie if rememberMe
if (rememberMe) {
  res.setHeader('Set-Cookie', [
    `admin_refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`
  ]);
}

res.status(200).json({
  success: true,
  user: { id: user.id, email: user.email, user_role: user.user_role },
  session: {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900  // 15 minutes in seconds
  }
});
```

### 4.3 Migrated: `requireAuth` middleware / `verifyToken`

**Before (Supabase):**
```javascript
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
const jwtPayload = decodeJwtPayload(token);  // manual decode for claims
```

**After (self-managed):**
```javascript
const { verifyAccessToken } = require('../services/auth-service');

async function requireAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    // jwt.verify both validates signature AND decodes claims — one step
    const payload = verifyAccessToken(token);

    return {
      id: payload.sub,
      email: payload.email,
      user_role: payload.user_role,
      permissions: payload.permissions,
      instructor_id: payload.instructor_id,
      role_assigned_at: payload.role_assigned_at
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Token expired');
      err.statusCode = 401;
      throw err;
    }
    throw new Error('Invalid token');
  }
}
```

**Key improvement:** Supabase's `getUser()` made a network call to Supabase servers on every request. Self-managed `jwt.verify()` is a local CPU operation — no network latency. This makes every authenticated API request faster.

### 4.4 Migrated: `auth/refresh.js`

**Before (Supabase):**
```javascript
const { data, error } = await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });
```

**After (self-managed):**
```javascript
const { rotateRefreshToken, generateAccessToken } = require('../services/auth-service');

const result = await rotateRefreshToken(refreshToken);
if (!result) {
  return res.status(401).json({ /* invalid refresh token */ });
}

const newAccessToken = generateAccessToken(result.user);

// Update cookie if present
if (req.headers.cookie?.includes('admin_refresh_token=')) {
  res.setHeader('Set-Cookie', [
    `admin_refresh_token=${result.newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`
  ]);
}

res.status(200).json({
  success: true,
  session: {
    access_token: newAccessToken,
    refresh_token: result.newRefreshToken,
    expires_in: 900
  }
});
```

### 4.5 Migrated: `auth/logout.js`

**Before (Supabase):**
```javascript
await supabaseAdmin.auth.admin.signOut(token);
```

**After (self-managed):**
```javascript
const { verifyAccessToken, revokeAllTokens } = require('../services/auth-service');

const payload = verifyAccessToken(token);
await revokeAllTokens(payload.sub);

res.setHeader('Set-Cookie', [
  'admin_refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
]);

res.status(200).json({ success: true, message: 'Successfully logged out' });
```

### 4.6 Migrated: `auth/request-otp.js`

**Before (Supabase):**
```javascript
const { data: users } = await supabaseAdmin.auth.admin.listUsers();
const userExists = users?.users?.some(u => u.email === email);
```

**After (self-managed):**
```javascript
const { findUserByEmail } = require('../services/auth-service');

const user = await findUserByEmail(email);
if (user) {
  // Generate OTP, store in Redis, trigger HubSpot webhook (unchanged)
}
```

### 4.7 Migrated: `auth/update-password.js`

**Before (Supabase):**
```javascript
const { data: users } = await supabaseAdmin.auth.admin.listUsers();
const user = users?.users?.find(u => u.email === email);
await supabaseAdmin.auth.admin.updateUserById(user.id, { password: password });
```

**After (self-managed):**
```javascript
const { findUserByEmail, updatePassword, revokeAllTokens } = require('../services/auth-service');

const user = await findUserByEmail(email);
if (!user) { /* 404 */ }

await updatePassword(user.id, password);      // bcrypt hashes internally
await revokeAllTokens(user.id);               // Force re-login after password change
```

### 4.8 Migrated: `instructors/create.js` (from instructor-auth-provisioning PRD)

**Before (Supabase — Mechanism A):**
```javascript
// Step 1: Create auth user
await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
// Step 2: Insert instructor record with auth_user_id link
await supabaseAdmin.from('instructors').insert({ ..., auth_user_id: authUserId });
// Step 3: INSERT into user_roles table (role = 'instructor')
await supabaseAdmin.from('user_roles').insert({ user_id: authUserId, role: 'instructor' });
// No app_metadata — instructor record looked up via instructors.auth_user_id = JWT.sub
```

**After (self-managed):**
```javascript
const { createUser } = require('../services/auth-service');

// Self-managed: role, permissions, and instructor_id all live in admin_users table
const authUser = await createUser({
  email: normalizedEmail,
  password: password,
  user_role: 'instructor',
  permissions: ['instructor.view_groups', 'instructor.view_schedule'],
  instructor_id: null  // Set after instructor record created (step 2)
});

// Insert instructor record with auth_user_id = authUser.id
// Then update authUser.instructor_id
```

**Note:** The self-managed system is simpler — no separate `user_roles` table INSERT needed. The `admin_users` table stores role and permissions directly, and `createUser()` in `auth-service.js` handles it all in one row.

### 4.9 Migrated: `instructors/[id].js` — ban/unban on deactivation

**Before (Supabase):**
```javascript
await supabaseAdmin.auth.admin.updateUserById(authUserId, { ban_duration: '876000h' });
```

**After (self-managed):**
```javascript
const { updateUser } = require('../services/auth-service');

// Deactivation
await updateUser(authUserId, { is_active: false });

// Reactivation
await updateUser(authUserId, { is_active: true });
```

The `is_active` check in `findUserByEmail` and `rotateRefreshToken` already blocks login for inactive users — no separate "ban" concept needed.

### 4.10 Summary: Supabase Auth Call → Replacement

| Supabase Auth Call | Self-Managed Replacement |
|-------------------|--------------------------|
| `signInWithPassword({ email, password })` | `findUserByEmail()` + `comparePassword()` + `generateAccessToken()` |
| `auth.getUser(token)` | `verifyAccessToken(token)` (local, no network) |
| `auth.refreshSession({ refresh_token })` | `rotateRefreshToken()` + `generateAccessToken()` |
| `auth.admin.signOut(token)` | `revokeAllTokens(userId)` |
| `auth.admin.createUser()` + `user_roles` INSERT + `instructors.auth_user_id` link | `createUser({ email, password, user_role, permissions, instructor_id })` |
| `auth.admin.updateUserById(id, { password })` | `updatePassword(userId, newPassword)` |
| `auth.admin.updateUserById(id, { ban_duration })` | `updateUser(userId, { is_active: false })` |
| `auth.admin.updateUserById(id, { email })` | `updateUser(userId, { email: newEmail })` |
| `auth.admin.deleteUser(id)` | `deleteUser(userId)` |
| `auth.admin.listUsers()` | `findUserByEmail(email)` (targeted, not list-all) |

---

## 5. Frontend Migration

### 5.1 Delete: `utils/supabaseClient.js`

This entire file is removed. All 6 auth helper functions it exports are replaced by direct API calls.

### 5.2 Rewritten: `contexts/AuthContext.jsx`

The new AuthContext is simpler — no Supabase client, no `onAuthStateChange` listener, no `setSession()`. It uses pure localStorage + axios.

**Key changes:**

| Current (Supabase) | Target (Self-Managed) |
|--------------------|-----------------------|
| `supabase.auth.setSession({ access_token, refresh_token })` | `localStorage.setItem('access_token', ...)` (already doing this) |
| `supabase.auth.getSession()` on mount | `axios.get('/admin/auth/me')` with stored token |
| `supabase.auth.onAuthStateChange()` | Removed — no event listener needed |
| `supabase.auth.refreshSession()` in 401 interceptor | `axios.post('/admin/auth/refresh', { refresh_token })` |
| `supabase.auth.signOut()` in logout | Removed — `axios.post('/admin/auth/logout')` handles everything |
| `import.meta.env.VITE_SUPABASE_URL` check | Removed — no Supabase config needed |
| `configError` state for missing env vars | Removed |

**Rewritten AuthContext structure:**

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
axios.defaults.baseURL = API_BASE_URL;

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set axios auth header from localStorage on init and when user changes
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [user]);

  const handleAuthError = useCallback(() => {
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  }, []);

  // 401 interceptor — attempt refresh, retry, or redirect to login
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) {
            handleAuthError();
            return Promise.reject(error);
          }

          try {
            const { data } = await axios.post('/admin/auth/refresh', {
              refresh_token: refreshToken
            });

            if (data?.session) {
              localStorage.setItem('access_token', data.session.access_token);
              localStorage.setItem('refresh_token', data.session.refresh_token);
              axios.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
              originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            handleAuthError();
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [handleAuthError]);

  // Initialize — check for existing token and validate
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      try {
        const { data } = await axios.get('/admin/auth/me');
        if (data?.user) {
          setUser(data.user);
        }
      } catch (error) {
        // Token expired — try refresh
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            const { data } = await axios.post('/admin/auth/refresh', {
              refresh_token: refreshToken
            });
            if (data?.session) {
              localStorage.setItem('access_token', data.session.access_token);
              localStorage.setItem('refresh_token', data.session.refresh_token);
              axios.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;

              const meResponse = await axios.get('/admin/auth/me');
              if (meResponse.data?.user) {
                setUser(meResponse.data.user);
              }
            }
          } catch {
            handleAuthError();
          }
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email, password, rememberMe = false) => {
    try {
      const { data } = await axios.post('/admin/auth/login', { email, password, rememberMe });

      if (data?.session && data?.user) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data?.error || 'Login failed' };
    } catch (error) {
      // ... same error handling as current
    }
  };

  const signOut = async () => {
    try {
      await axios.post('/admin/auth/logout');
    } catch {
      // Ignore — clear local state regardless
    }

    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isAuthenticated: () => !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 5.3 Remove Supabase npm Dependencies

```bash
cd admin_root/admin_frontend
npm uninstall @supabase/supabase-js @supabase/auth-helpers-react
```

### 5.4 Remove Environment Variables

Remove from Vercel/EC2 environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend keeps `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` until the data migration (main PRD) is complete. Auth migration can happen before or after data migration.

---

## 6. Data Migration

### 6.1 RBAC State: Mechanism A Confirmed

**The production Supabase instance uses table-based RBAC (Mechanism A):**
- `public.user_roles` table: Maps `user_id` → `app_role` (one role per user)
- `public.role_permissions` table: Maps `app_role` → `app_permission[]`
- `custom_access_token_hook`: PL/pgSQL function that injects `user_role` and `permissions` into JWTs on login
- `app_metadata` is NOT used for instructor data — `instructor_id` is resolved via `instructors.auth_user_id` lookup

**This means roles must be exported from `user_roles` table, NOT from `app_metadata`.**

### 6.2 Export Existing Users from Supabase

The export must join `auth.users` with `user_roles` and `role_permissions` to get the complete user profile:

```javascript
// helper_scripts/export-supabase-auth-users.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function exportUsers() {
  // Step 1: Get all auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;

  // Step 2: Get role assignments from user_roles table
  const { data: roleAssignments, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id, role, granted_by, granted_at, notes');
  if (roleError) throw roleError;

  // Step 3: Get permission mappings from role_permissions table
  const { data: permissionMappings, error: permError } = await supabase
    .from('role_permissions')
    .select('role, permission');
  if (permError) throw permError;

  // Build lookup maps
  const roleMap = {};
  for (const r of roleAssignments) {
    roleMap[r.user_id] = r;
  }

  const permMap = {};
  for (const p of permissionMappings) {
    if (!permMap[p.role]) permMap[p.role] = [];
    permMap[p.role].push(p.permission);
  }

  // Step 4: Merge into export format
  const exportData = users.map(user => {
    const roleEntry = roleMap[user.id];
    const role = roleEntry?.role || 'viewer';
    return {
      supabase_id: user.id,
      email: user.email,
      user_role: role,
      permissions: permMap[role] || [],
      instructor_id: null, // Resolved via instructors.auth_user_id lookup, not stored in app_metadata
      granted_by: roleEntry?.granted_by || null,
      granted_at: roleEntry?.granted_at || null,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at
    };
  });

  console.log(JSON.stringify(exportData, null, 2));
  console.log(`\nExported ${exportData.length} users`);
  console.log(`  With roles: ${exportData.filter(u => u.user_role !== 'viewer').length}`);
  console.log(`  Instructors: ${exportData.filter(u => u.user_role === 'instructor').length}`);
}

exportUsers();
```

### 6.3 The Password Problem

Supabase stores password hashes internally in `auth.users.encrypted_password`. This field is **not accessible** via the Supabase Admin API — there is no way to export the raw bcrypt hashes.

**Options:**

| Option | Approach | User Impact |
|--------|----------|-------------|
| **A: Force password reset** (recommended) | Import users without passwords, set `is_active = true` but require a password reset on first login via OTP flow | One-time inconvenience |
| **B: Direct DB export** | Connect directly to Supabase PostgreSQL (`db.xxxx.supabase.co`), query `auth.users.encrypted_password`, import hashes as-is into `admin_users.password_hash` | Seamless — existing passwords work |
| **C: Shadow auth period** | Run both systems in parallel. When a user logs in via Supabase, also hash their password with bcrypt and store in RDS. After all users have logged in, cut over. | No disruption, but indeterminate timeline |

**Option B is best** if you still have direct DB access to Supabase during migration. The `encrypted_password` column contains standard bcrypt hashes that work with `bcryptjs.compare()` unchanged:

```sql
-- Run against Supabase PostgreSQL directly
-- Joins auth.users with user_roles to get the table-based role (NOT app_metadata)
-- instructor_id resolved via instructors.auth_user_id join (not from app_metadata)
SELECT
  u.id,
  u.email,
  u.encrypted_password,
  COALESCE(ur.role::TEXT, 'viewer') as user_role,
  i.id as instructor_id,
  ur.granted_by,
  ur.granted_at,
  u.created_at,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN hubspot_sync.instructors i ON i.auth_user_id = u.id
WHERE u.deleted_at IS NULL;
```

**Note:** Permissions are NOT stored per-user — they're derived from `role_permissions` at query time. In the RDS `admin_users` table, we flatten them into the `permissions` column for each user:

```sql
-- Get permissions for each role to include in import
SELECT ur.user_id, ARRAY_AGG(rp.permission::TEXT) as permissions
FROM public.user_roles ur
JOIN public.role_permissions rp ON rp.role = ur.role
GROUP BY ur.user_id;
```

Then import into RDS:

```sql
INSERT INTO admin_users (email, password_hash, user_role, permissions, instructor_id, last_sign_in, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7);
```

### 6.4 Instructor Record Re-Linking

After importing users to `admin_users`, update the `instructors.auth_user_id` to point to the new `admin_users.id` (instead of the old Supabase auth UUID):

```sql
UPDATE instructors i
SET auth_user_id = au.id
FROM admin_users au
WHERE i.email = au.email
  AND au.user_role = 'instructor';
```

### 6.5 RBAC Tables — Not Migrated

The `user_roles`, `role_permissions`, and `custom_access_token_hook` are Supabase-specific RBAC artifacts. They are **NOT migrated to RDS** because:
- The self-managed JWT system reads `user_role` and `permissions` directly from the `admin_users` table
- JWT claims are built at sign-time in `auth-service.js`, not via a database hook
- The `role_permissions` mapping is flattened into each user's `permissions` column during data migration

This simplifies the RDS schema and removes the indirection of the hook-based system.

---

## 7. Migration Phases

### Phase 1: Schema & Service Layer (1 day)
- [ ] Create `admin_users` and `refresh_tokens` tables in RDS
- [ ] Generate JWT signing keys, store in Secrets Manager
- [ ] Write `src/services/auth-service.js`
- [ ] Write `src/config/auth.js` (secrets loader)
- [ ] Unit test: `hashPassword`, `comparePassword`, `generateAccessToken`, `verifyAccessToken`
- [ ] Unit test: `generateRefreshToken`, `rotateRefreshToken`, `revokeAllTokens`

### Phase 2: Backend Endpoint Migration (1 day)
- [ ] Migrate `auth/login.js` — replace `signInWithPassword` with `findUserByEmail` + `comparePassword`
- [ ] Migrate `requireAuth` middleware — replace `getUser(token)` with `verifyAccessToken(token)`
- [ ] Migrate `auth/refresh.js` — replace `refreshSession` with `rotateRefreshToken`
- [ ] Migrate `auth/logout.js` — replace `admin.signOut` with `revokeAllTokens`
- [ ] Migrate `auth/request-otp.js` — replace `admin.listUsers` with `findUserByEmail`
- [ ] Migrate `auth/update-password.js` — replace `admin.updateUserById` with `updatePassword`
- [ ] Migrate `instructors/create.js` — replace `admin.createUser` with `createUser`
- [ ] Migrate `instructors/[id].js` — replace `admin.updateUserById` with `updateUser`
- [ ] Integration test: full login → authenticated request → refresh → logout flow

### Phase 3: Frontend Migration (0.5 day)
- [ ] Delete `utils/supabaseClient.js`
- [ ] Rewrite `contexts/AuthContext.jsx` (remove all Supabase client usage)
- [ ] Remove `@supabase/supabase-js` and `@supabase/auth-helpers-react` from `package.json`
- [ ] Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` references
- [ ] Test: login → session restore on refresh → 401 auto-refresh → logout

### Phase 4: Data Migration (0.5 day)
- [ ] Export users from Supabase (Option B: direct DB export with password hashes)
- [ ] Import into `admin_users` table in RDS
- [ ] Re-link `instructors.auth_user_id` to new `admin_users.id`
- [ ] Verify: each migrated user can log in with existing password
- [ ] Verify: instructor portal routes correctly for instructor-role users

### Phase 5: Validation & Cutover (0.5 day)
- [ ] Run parallel: old Supabase auth + new self-managed auth (feature flag)
- [ ] Smoke test all 8 auth endpoints
- [ ] Smoke test instructor CRUD with auth sync
- [ ] Smoke test OTP password reset flow
- [ ] Cut over: disable Supabase auth, go fully self-managed
- [ ] Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from backend config (after data migration PRD completes)

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|------------|
| JWT signing key compromise | Stored in AWS Secrets Manager, rotatable without code change |
| Brute force login | Existing rate limiting (5 attempts / 15 min window) preserved |
| Refresh token theft | Token rotation — each use invalidates old token, issues new one |
| Password storage | bcrypt with 12 salt rounds (same as Supabase internal) |
| Token in localStorage | Same as current behavior; HttpOnly refresh cookie for Remember Me |
| Stale tokens after password change | `revokeAllTokens()` called after every password update |
| Inactive user access | `is_active` checked at login, refresh, and user lookup |

---

## 9. Performance Comparison

| Operation | Current (Supabase) | Target (Self-Managed) |
|-----------|-------------------|----------------------|
| Login | ~300ms (network to Supabase) | ~50ms (local bcrypt + DB query) |
| Token verification | ~100ms (network to `auth.getUser`) | ~1ms (local `jwt.verify`, no network) |
| Token refresh | ~200ms (network to Supabase) | ~20ms (DB query + jwt sign) |
| User creation | ~400ms (network to Supabase) | ~60ms (bcrypt hash + DB insert) |

**Token verification drops from ~100ms to ~1ms** — this affects every single authenticated API request across the entire admin app.

---

## 10. User App Impact

**No changes required.** The user app:
- Does not use Supabase Auth (zero `supabase.auth.*` calls)
- Authenticates via `student_id` + `email` lookup against `hubspot_contact_credits` table
- The table query works identically on RDS PostgreSQL (covered by main migration PRD)
- Frontend uses cookie-based session (no JWT, no tokens)
- No `@supabase/supabase-js` dependency in user frontend

---

## 11. File Change Summary

### New Files (3)

| File | Purpose |
|------|---------|
| `src/services/auth-service.js` | Central auth service (bcrypt, JWT, refresh tokens) |
| `src/config/auth.js` | JWT signing key loader from Secrets Manager |
| `helper_scripts/export-supabase-auth-users.js` | One-time migration script |

### Modified Files — Backend (8)

| File | Change |
|------|--------|
| `api/admin/auth/login.js` | Replace `signInWithPassword` with `findUserByEmail` + `comparePassword` |
| `api/admin/auth/refresh.js` | Replace `refreshSession` with `rotateRefreshToken` |
| `api/admin/auth/logout.js` | Replace `admin.signOut` with `revokeAllTokens` |
| `api/admin/auth/request-otp.js` | Replace `admin.listUsers` with `findUserByEmail` |
| `api/admin/auth/update-password.js` | Replace `admin.listUsers` + `updateUserById` with `findUserByEmail` + `updatePassword` |
| `api/admin/middleware/requireAuth.js` | Replace `verifyToken` (Supabase) with `verifyAccessToken` (local jwt) |
| `api/admin/instructors/create.js` | Replace `admin.createUser` with `createUser` from auth-service |
| `api/admin/instructors/[id].js` | Replace `admin.updateUserById` with `updateUser` from auth-service |

### Modified Files — Frontend (2)

| File | Change |
|------|--------|
| `admin_frontend/src/contexts/AuthContext.jsx` | Remove all Supabase client usage, pure axios/localStorage |
| `admin_frontend/package.json` | Remove `@supabase/supabase-js`, `@supabase/auth-helpers-react` |

### Deleted Files (1)

| File | Reason |
|------|--------|
| `admin_frontend/src/utils/supabaseClient.js` | Entire file is Supabase auth helpers — fully replaced |

---

## 12. Dependencies

### Requires
- RDS PostgreSQL instance (from main AWS migration PRD)
- AWS Secrets Manager access (from main AWS migration PRD)
- ElastiCache Redis (from main AWS migration PRD) — for OTP storage (unchanged)
- Existing `bcryptjs` and `jsonwebtoken` npm packages (already in `admin_root/package.json`)

### Required By
- **Instructor Auth Provisioning PRD** — `createUser` call changes from Supabase to auth-service
- **Instructor Portal PRD** — JWT claims structure unchanged, middleware works the same
- **Main AWS Migration PRD** — this is the missing auth chapter
