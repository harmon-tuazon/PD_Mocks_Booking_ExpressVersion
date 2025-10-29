# PRD: Password Reset Feature Using Supabase Auth

## Document Information
- **Feature**: Password Reset (Forgot Password)
- **Status**: Draft
- **Priority**: High
- **Estimated Effort**: 6-8 hours
- **Confidence Score**: 9/10
- **Created**: 2025-10-29
- **Version**: 1.0.0
- **Authentication Provider**: Supabase Auth (Implicit Flow)

## Table of Contents
1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Technical Requirements](#technical-requirements)
4. [Frontend Components](#frontend-components)
5. [Backend Requirements](#backend-requirements)
6. [User Flow](#user-flow)
7. [Supabase Configuration](#supabase-configuration)
8. [Email Templates](#email-templates)
9. [Security Considerations](#security-considerations)
10. [Edge Cases & Error Handling](#edge-cases--error-handling)
11. [Testing Requirements](#testing-requirements)
12. [Implementation Checklist](#implementation-checklist)
13. [Success Metrics](#success-metrics)

---

## Overview

### Problem Statement
Currently, administrators who forget their passwords have no way to recover access to the admin dashboard. This creates support overhead and potential security risks if users resort to sharing credentials or using weak passwords.

### Solution
Implement a complete password reset flow using Supabase Auth's implicit flow, which includes:
1. "Forgot Password" link on login page
2. Password reset request page (email submission)
3. Email with secure reset link
4. Password update page with new password form
5. Success confirmation and redirect to login

### Key Benefits
- Self-service password recovery reduces admin burden
- Secure token-based reset flow prevents unauthorized access
- Improves user experience and reduces friction
- Follows security best practices with Supabase Auth
- No custom backend authentication logic needed

---

## User Stories

### Primary User Story
**As an** administrator who forgot their password
**I want to** reset my password via email
**So that** I can regain access to the admin dashboard without contacting support

### Acceptance Criteria
- [ ] "Forgot password?" link is visible on login page
- [ ] Clicking link navigates to password reset request page
- [ ] User can enter email address to request password reset
- [ ] System sends reset email with secure link (valid for 1 hour)
- [ ] Reset link redirects to password update page
- [ ] User can set new password (with validation)
- [ ] Success message appears after password update
- [ ] User is redirected to login page to sign in with new password
- [ ] Old password becomes invalid after reset
- [ ] Clear error messages for invalid/expired tokens
- [ ] Email not found returns generic success message (security)
- [ ] Form validation prevents weak passwords
- [ ] Works in both light and dark modes

---

## Technical Requirements

### Core Technologies
- **Frontend**: React 18, React Router, Supabase JS Client
- **Backend**: Supabase Auth API (serverless)
- **Email Service**: Supabase SMTP (or custom SMTP)
- **Authentication**: Supabase JWT tokens
- **State Management**: React hooks, React Router navigation

### Supabase Auth Flow (Implicit)
The implicit flow is ideal for our client-side admin application:

```
Step 1: Request Reset
User submits email → Supabase sends email with token → User receives email

Step 2: Verify Token
User clicks link → Redirects to update password page → Supabase validates token

Step 3: Update Password
User enters new password → Supabase updates password → User redirected to login
```

### Data Flow
```
User clicks "Forgot Password?" → /forgot-password page
    ↓
User enters email → supabase.auth.resetPasswordForEmail()
    ↓
Supabase sends email with reset link:
  https://admin.prepdoctors.com/update-password?access_token=xxx&...
    ↓
User clicks link → /update-password page (authenticated session)
    ↓
User enters new password → supabase.auth.updateUser({ password })
    ↓
Success → Redirect to /login with success message
```

---

## Frontend Components

### 1. ForgotPassword Page (New)

**Location**: `admin_frontend/src/pages/ForgotPassword.jsx`

**Purpose**: Allow users to request password reset email

**Route**: `/forgot-password` (public route)

**UI Design**:
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      Reset Your Password                │
│   Enter your email to receive a reset  │
│   link                                  │
│                                         │
│   Email Address:                        │
│   [____________________________]        │
│                                         │
│   [Send Reset Link]                     │
│                                         │
│   Back to Sign In                       │
└─────────────────────────────────────────┘
```

**State**:
```javascript
{
  email: string,              // User's email input
  loading: boolean,           // Sending reset email
  submitted: boolean,         // Email sent successfully
  error: string | null        // Error message
}
```

**Features**:
- Email input with validation
- Submit button with loading state
- Success message after submission
- "Back to Sign In" link
- Error handling for network issues
- Generic success message (security: don't reveal if email exists)
- Same visual styling as Login page
- Dark mode support

**API Call**:
```javascript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/update-password`,
});
```

**Success State UI**:
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      ✓ Check Your Email                │
│                                         │
│   If an account exists with that email,│
│   we've sent a password reset link.    │
│                                         │
│   The link will expire in 1 hour.      │
│                                         │
│   [Back to Sign In]                     │
└─────────────────────────────────────────┘
```

### 2. UpdatePassword Page (New)

**Location**: `admin_frontend/src/pages/UpdatePassword.jsx`

**Purpose**: Allow users to set new password after clicking reset link

**Route**: `/update-password` (public but requires valid token)

**UI Design**:
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      Set New Password                   │
│   Create a strong password for your    │
│   account                               │
│                                         │
│   New Password:                         │
│   [____________________________] [👁]   │
│   • At least 8 characters               │
│   • Include numbers and letters         │
│                                         │
│   Confirm Password:                     │
│   [____________________________] [👁]   │
│                                         │
│   [Update Password]                     │
└─────────────────────────────────────────┘
```

**State**:
```javascript
{
  newPassword: string,        // New password input
  confirmPassword: string,    // Confirm password input
  showPassword: boolean,      // Toggle password visibility
  loading: boolean,           // Updating password
  error: string | null,       // Error message
  success: boolean,           // Password updated successfully
  passwordStrength: 'weak' | 'medium' | 'strong',
  validationErrors: {
    minLength: boolean,
    hasNumber: boolean,
    hasLetter: boolean,
    passwordsMatch: boolean
  }
}
```

**Features**:
- Two password inputs (new password, confirm password)
- Password visibility toggle (eye icon)
- Real-time password strength indicator
- Password validation requirements checklist:
  - ✓/✗ At least 8 characters
  - ✓/✗ Contains numbers
  - ✓/✗ Contains letters
  - ✓/✗ Passwords match
- Submit button (disabled until valid)
- Loading state during update
- Success message with countdown to login redirect
- Error handling for invalid/expired tokens
- Dark mode support

**API Call**:
```javascript
const { error } = await supabase.auth.updateUser({
  password: newPassword
});
```

**Success State UI**:
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      ✓ Password Updated!                │
│                                         │
│   Your password has been successfully   │
│   updated.                              │
│                                         │
│   Redirecting to login in 3 seconds... │
│                                         │
│   [Sign In Now]                         │
└─────────────────────────────────────────┘
```

**Token Expired Error UI**:
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      ⚠️ Link Expired                    │
│                                         │
│   This password reset link has expired  │
│   or is invalid.                        │
│                                         │
│   [Request New Reset Link]              │
│                                         │
│   [Back to Sign In]                     │
└─────────────────────────────────────────┘
```

### 3. Update Login Page

**Location**: `admin_frontend/src/pages/Login.jsx`

**Changes Required**:
- Add "Forgot password?" link below password field
- Link navigates to `/forgot-password`
- Show success message if redirected from password reset

**Updated Layout** (after password field, before remember me):
```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center">
    <Checkbox ... />
    <label ...>Remember me for 7 days</label>
  </div>

  <div className="text-sm">
    <Link
      to="/forgot-password"
      className="font-medium text-primary-600 hover:text-primary-500"
    >
      Forgot password?
    </Link>
  </div>
</div>
```

### 4. Update App Routing

**Location**: `admin_frontend/src/App.jsx`

**Changes Required**:
- Add route for `/forgot-password` (public)
- Add route for `/update-password` (public but token-protected)

**New Routes**:
```jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/update-password" element={<UpdatePassword />} />

  <Route path="/" element={<ProtectedAdminRoute>...</ProtectedAdminRoute>}>
    {/* Existing protected routes */}
  </Route>
</Routes>
```

### 5. Shared Components

**PasswordStrengthIndicator** (New)
- Visual bar showing weak/medium/strong
- Color coded: red/yellow/green
- Used in UpdatePassword page

**PasswordRequirements** (New)
- Checklist component showing validation rules
- Checkmarks turn green when met
- Used in UpdatePassword page

---

## Backend Requirements

### Supabase Configuration (Dashboard)

**1. Redirect URLs (CRITICAL)**

Navigate to: **Authentication → URL Configuration → Redirect URLs**

Add these URLs:
```
# Production
https://admin.prepdoctors.com/update-password

# Development
http://localhost:5173/update-password
```

**Why**: Supabase only allows redirects to pre-configured URLs for security.

**2. Email Templates**

Navigate to: **Authentication → Email Templates → Reset Password**

**Default Template** (modify if needed):
```html
<h2>Reset Your Password</h2>

<p>Follow this link to reset your password:</p>

<p><a href="{{ .SiteURL }}/update-password?access_token={{ .Token }}&type=recovery">Reset Password</a></p>

<p>Or copy and paste this URL into your browser:</p>

<p>{{ .SiteURL }}/update-password?access_token={{ .Token }}&type=recovery</p>

<p>This link will expire in 1 hour.</p>

<p>If you didn't request this, you can safely ignore this email.</p>
```

**Custom Template** (recommended for branding):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0660B2; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background: #0660B2;
              color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PrepDoctors Admin</h1>
    </div>
    <div class="content">
      <h2>Reset Your Password</h2>

      <p>We received a request to reset your password for the PrepDoctors Admin Dashboard.</p>

      <p>Click the button below to set a new password:</p>

      <p style="text-align: center;">
        <a href="{{ .SiteURL }}/update-password?access_token={{ .Token }}&type=recovery" class="button">
          Reset Password
        </a>
      </p>

      <p><strong>This link will expire in 1 hour.</strong></p>

      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break: break-all; background: white; padding: 10px; border-radius: 3px;">
        {{ .SiteURL }}/update-password?access_token={{ .Token }}&type=recovery
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

      <p style="font-size: 14px; color: #666;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      <p>&copy; 2025 PrepDoctors. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**Template Variables**:
- `{{ .SiteURL }}` - Your site URL (configured in Supabase)
- `{{ .Token }}` - Secure reset token
- `{{ .TokenHash }}` - Token hash (for PKCE flow, not needed for implicit)

**3. Email Settings**

Navigate to: **Authentication → Email → SMTP Settings**

**For Development** (use Supabase default):
- Supabase provides built-in SMTP
- Limited to 2 emails per hour
- Suitable for testing only

**For Production** (configure custom SMTP):
```
SMTP Host: smtp.sendgrid.net (or your provider)
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@prepdoctors.com
Sender Name: PrepDoctors Admin
```

**Popular SMTP Providers**:
- SendGrid (recommended, 100 emails/day free)
- AWS SES (cost-effective for high volume)
- Mailgun (developer-friendly)
- Postmark (high deliverability)

**4. Site URL Configuration**

Navigate to: **Settings → General → Site URL**

```
Production: https://admin.prepdoctors.com
Development: http://localhost:5173
```

**5. Token Expiry**

Navigate to: **Authentication → Email → Password Recovery**

```
Recovery Token Lifetime: 3600 seconds (1 hour)
```

**Recommendation**: Keep default 1 hour for security.

### No Backend Endpoints Needed

Supabase Auth handles all backend operations:
- ✅ Token generation and validation
- ✅ Email sending
- ✅ Password hashing and storage
- ✅ Token expiry management
- ✅ Rate limiting
- ✅ Security best practices

**Our frontend only needs**:
1. `supabase.auth.resetPasswordForEmail()` - Request reset
2. `supabase.auth.updateUser()` - Update password
3. Supabase automatically validates tokens via URL parameters

---

## User Flow

### Happy Path: Successful Password Reset

```
1. User on login page, forgot password
2. Clicks "Forgot password?" link
3. Navigates to /forgot-password page
4. Enters email address: admin@prepdoctors.com
5. Clicks "Send Reset Link"
6. Loading spinner appears
7. Success message: "Check your email"
8. Email arrives in inbox (within 1 minute)
9. User clicks "Reset Password" button in email
10. Browser opens /update-password?access_token=xxx&type=recovery
11. Supabase validates token automatically
12. Update password form appears
13. User enters new password: "NewSecure123!"
14. User confirms password: "NewSecure123!"
15. Password strength indicator shows "Strong"
16. All validation checks pass (✓ green checkmarks)
17. Clicks "Update Password"
18. Loading spinner appears
19. Success message: "Password Updated!"
20. Countdown: "Redirecting to login in 3... 2... 1..."
21. Redirected to /login
22. Success banner: "Password updated. Please sign in."
23. User signs in with new password
24. Successfully authenticated → Dashboard
```

### Alternative Path: Email Not Found

```
1-5. [Same as happy path]
6. Loading spinner appears
7. Success message: "Check your email" (generic, for security)
8. No email sent (but user doesn't know)
9. User waits for email
10. Email never arrives
11. User can request again or contact support
```

**Security Note**: We show the same success message whether email exists or not to prevent email enumeration attacks.

### Alternative Path: Token Expired

```
1-9. [Same as happy path]
10. Browser opens /update-password?access_token=xxx&type=recovery
11. Supabase validates token → EXPIRED
12. Error message: "Link Expired"
13. "Request New Reset Link" button appears
14. User clicks button → Redirected to /forgot-password
15. User can request new reset email
```

### Alternative Path: User Cancels

```
1-4. [Same as happy path]
5. User clicks "Back to Sign In"
6. Navigated back to /login
7. No changes made
```

---

## Security Considerations

### 1. Token Security
- **Expiry**: Tokens expire after 1 hour (configurable)
- **Single Use**: Token becomes invalid after password update
- **Secure Transmission**: Tokens sent via HTTPS only
- **No Token Storage**: Tokens passed via URL, not stored in localStorage

### 2. Email Enumeration Prevention
- **Generic Success**: Same message for existing and non-existing emails
- **No User Feedback**: Don't reveal if email exists in system
- **Timing Attack Prevention**: Consistent response times

### 3. Password Requirements
- **Minimum Length**: 8 characters
- **Complexity**: Must include letters and numbers
- **No Common Passwords**: Supabase has built-in password strength checking
- **Real-time Validation**: Check password strength before submission

### 4. Rate Limiting
- **Request Limit**: Supabase limits reset requests (60/hour per IP)
- **Email Limit**: SMTP rate limits apply
- **Prevents Abuse**: Can't spam reset emails

### 5. HTTPS Only
- **Production**: Must use HTTPS for all password operations
- **Development**: Use `localhost` (secure context in browsers)

### 6. CSRF Protection
- **Supabase Handles**: Built-in CSRF protection
- **Token-Based**: Reset requires valid token from email

### 7. Session Management
- **Auto Logout**: Old sessions invalidated after password change
- **Force Re-login**: User must sign in with new password

---

## Edge Cases & Error Handling

### 1. Invalid Email Format
**Scenario**: User enters malformed email
**Frontend Validation**: HTML5 email validation + custom regex
**Error Message**: "Please enter a valid email address"
**UI Behavior**: Disable submit button, show error below input

### 2. Network Error During Request
**Scenario**: Network timeout or offline
**Error Message**: "Network error. Please check your connection and try again."
**UI Behavior**: Show error toast, keep form populated, allow retry

### 3. Token Missing from URL
**Scenario**: User navigates to /update-password without token
**Detection**: Check URL parameters on page load
**Error Message**: "Invalid or missing reset link. Please request a new one."
**UI Behavior**: Show error with "Request New Link" button

### 4. Token Expired
**Scenario**: User clicks link after 1 hour
**Supabase Response**: 400 error "Token has expired"
**Error Message**: "This reset link has expired. Please request a new one."
**UI Behavior**: Show error with "Request New Link" button

### 5. Token Already Used
**Scenario**: User clicks same link twice
**Supabase Response**: 400 error "Token invalid"
**Error Message**: "This link has already been used. Please request a new one."
**UI Behavior**: Show error with "Request New Link" button

### 6. Weak Password
**Scenario**: User enters password that doesn't meet requirements
**Frontend Validation**: Check requirements in real-time
**Error Message**: "Password must meet all requirements"
**UI Behavior**: Disable submit, show failed requirements in red

### 7. Passwords Don't Match
**Scenario**: New password ≠ confirm password
**Frontend Validation**: Compare on change
**Error Message**: "Passwords do not match"
**UI Behavior**: Disable submit, show error below confirm input

### 8. User Already Authenticated
**Scenario**: Logged-in user tries to reset password
**Detection**: Check auth state on page load
**UI Behavior**: Redirect to dashboard (they can change password in settings)

### 9. Email Service Down
**Scenario**: SMTP server unavailable
**Supabase Behavior**: Queues email, retries automatically
**User Experience**: Success message shown, email may be delayed
**Fallback**: User can request again if email doesn't arrive

### 10. Browser Blocks Redirect
**Scenario**: Browser popup blocker prevents redirect
**UI Behavior**: Show manual link: "Click here if not redirected automatically"

---

## Testing Requirements

### Unit Tests

#### ForgotPassword Component Tests
**File**: `admin_frontend/src/pages/__tests__/ForgotPassword.test.jsx`

```javascript
describe('ForgotPassword', () => {
  test('renders forgot password form', () => {});
  test('validates email format', () => {});
  test('disables submit for invalid email', () => {});
  test('shows loading state during submission', () => {});
  test('shows success message after submission', () => {});
  test('handles network errors gracefully', () => {});
  test('"Back to Sign In" link navigates to login', () => {});
  test('renders correctly in dark mode', () => {});
});
```

#### UpdatePassword Component Tests
**File**: `admin_frontend/src/pages/__tests__/UpdatePassword.test.jsx`

```javascript
describe('UpdatePassword', () => {
  test('renders update password form', () => {});
  test('validates password requirements', () => {});
  test('shows password strength indicator', () => {});
  test('toggles password visibility', () => {});
  test('validates passwords match', () => {});
  test('disables submit until valid', () => {});
  test('shows loading state during update', () => {});
  test('shows success message after update', () => {});
  test('redirects to login after countdown', () => {});
  test('handles expired token error', () => {});
  test('handles invalid token error', () => {});
  test('renders correctly in dark mode', () => {});
});
```

### Integration Tests

**File**: `admin_root/tests/integration/test-password-reset-flow.js`

```javascript
describe('Password Reset Flow', () => {
  test('complete flow: request → email → update → login', async () => {
    // 1. Navigate to forgot password
    // 2. Submit email
    // 3. Verify success message
    // 4. Simulate email click (get token from Supabase)
    // 5. Navigate to update password with token
    // 6. Enter new password
    // 7. Submit update
    // 8. Verify redirect to login
    // 9. Login with new password
    // 10. Verify authenticated
  });

  test('expired token flow', async () => {
    // 1. Generate expired token
    // 2. Navigate to update password with expired token
    // 3. Verify error message
    // 4. Verify "Request New Link" button works
  });

  test('invalid token flow', async () => {
    // 1. Navigate to update password with invalid token
    // 2. Verify error message
    // 3. Verify user can navigate back
  });
});
```

### Manual Testing Checklist

**Forgot Password Page**:
- [ ] Page renders correctly in light mode
- [ ] Page renders correctly in dark mode
- [ ] Email input accepts valid email
- [ ] Email validation prevents invalid formats
- [ ] Submit button shows loading state
- [ ] Success message appears after submission
- [ ] "Back to Sign In" link works
- [ ] Network error shows appropriate message
- [ ] Form is keyboard accessible
- [ ] Screen reader announces form labels

**Email**:
- [ ] Reset email is received (check spam)
- [ ] Email template renders correctly
- [ ] Reset link works when clicked
- [ ] Reset link contains valid token
- [ ] Email subject is clear
- [ ] Sender name is "PrepDoctors Admin"

**Update Password Page**:
- [ ] Page renders with token in URL
- [ ] Password requirements list appears
- [ ] Password strength indicator updates in real-time
- [ ] Password visibility toggle works
- [ ] Validation checks update as user types
- [ ] Submit disabled until all requirements met
- [ ] Submit button shows loading state
- [ ] Success message appears after update
- [ ] Countdown timer works
- [ ] Auto-redirect happens after countdown
- [ ] "Sign In Now" button works
- [ ] Expired token shows error
- [ ] Invalid token shows error
- [ ] "Request New Link" button works

**Login Integration**:
- [ ] "Forgot password?" link appears on login
- [ ] Link navigates to forgot password page
- [ ] User can log in with new password after reset
- [ ] Old password no longer works

---

## Implementation Checklist

### Phase 1: Supabase Configuration (1 hour)

- [ ] Configure redirect URLs in Supabase Dashboard
  - [ ] Add production URL
  - [ ] Add development URL
- [ ] Customize email template
  - [ ] Update branding
  - [ ] Test template variables
  - [ ] Verify links work
- [ ] Configure SMTP settings (if using custom)
  - [ ] Set up SendGrid account
  - [ ] Get API key
  - [ ] Configure in Supabase
  - [ ] Send test email
- [ ] Set site URL
- [ ] Verify token expiry settings

### Phase 2: Frontend Components (3-4 hours)

- [ ] Create ForgotPassword page
  - [ ] Email input with validation
  - [ ] Submit button with loading state
  - [ ] Success message UI
  - [ ] Error handling
  - [ ] "Back to Sign In" link
  - [ ] Dark mode styling
- [ ] Create UpdatePassword page
  - [ ] Password inputs (new + confirm)
  - [ ] Password visibility toggle
  - [ ] Password strength indicator
  - [ ] Requirements checklist
  - [ ] Submit button with validation
  - [ ] Loading state
  - [ ] Success message with countdown
  - [ ] Error handling (expired/invalid token)
  - [ ] Dark mode styling
- [ ] Create PasswordStrengthIndicator component
  - [ ] Visual strength bar
  - [ ] Color coding (weak/medium/strong)
- [ ] Create PasswordRequirements component
  - [ ] Checklist with checkmarks
  - [ ] Real-time validation feedback
- [ ] Update Login page
  - [ ] Add "Forgot password?" link
  - [ ] Show success message from URL param
- [ ] Update App routing
  - [ ] Add /forgot-password route
  - [ ] Add /update-password route

### Phase 3: Integration & Testing (1-2 hours)

- [ ] Test forgot password flow
  - [ ] Email validation works
  - [ ] Email is sent
  - [ ] Email received in inbox
  - [ ] Email links to correct URL
- [ ] Test update password flow
  - [ ] Token validated by Supabase
  - [ ] Password requirements enforced
  - [ ] Success message appears
  - [ ] Redirect works
- [ ] Test error scenarios
  - [ ] Invalid email format
  - [ ] Network errors
  - [ ] Expired token
  - [ ] Invalid token
  - [ ] Weak password
  - [ ] Passwords don't match
- [ ] Test dark mode
- [ ] Test keyboard navigation
- [ ] Test with screen reader

### Phase 4: Code Review & Polish (0.5 hours)

- [ ] Review component code
- [ ] Check for accessibility (ARIA labels, focus management)
- [ ] Verify error messages are user-friendly
- [ ] Check console for warnings/errors
- [ ] Verify no sensitive data in logs
- [ ] Test performance

### Phase 5: Documentation & Deployment (1 hour)

- [ ] Update component documentation
- [ ] Add JSDoc comments
- [ ] Update README with password reset info
- [ ] Document Supabase configuration steps
- [ ] Create deployment checklist
- [ ] Build and test production build
- [ ] Deploy to staging
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Send test reset email in production

---

## Success Metrics

### Functional Metrics
- ✅ Reset request succeeds 100% of time for valid emails
- ✅ Emails delivered within 2 minutes (95th percentile)
- ✅ Password update succeeds 100% of time with valid tokens
- ✅ Expired tokens properly rejected with clear error messages
- ✅ Users successfully login with new password after reset
- ✅ Old password no longer works after reset

### User Experience Metrics
- ⏱️ Forgot password page loads within 500ms
- ⏱️ Email arrives within 2 minutes
- ⏱️ Password update completes within 2 seconds
- ⏱️ Auto-redirect happens after 3 second countdown
- 📊 Clear error messages for all failure scenarios
- 📊 Password requirements visible and helpful
- 📊 No confusion about whether email was sent

### Security Metrics
- 🔒 Tokens expire after exactly 1 hour
- 🔒 Tokens cannot be reused
- 🔒 No email enumeration possible
- 🔒 All operations over HTTPS in production
- 🔒 Weak passwords rejected
- 🔒 No password visible in URL or logs
- 🔒 Rate limiting prevents abuse

### Technical Metrics
- 📊 Zero console errors or warnings
- 📊 Passes all unit and integration tests
- 📊 Accessible (WCAG 2.1 AA compliant)
- 📊 Works in light and dark modes
- 📊 Mobile responsive
- 📊 Works in all modern browsers

---

## Dependencies & Constraints

### Dependencies
- Supabase Auth service availability
- SMTP service availability (for email sending)
- Existing authentication system (AuthContext)
- React Router for navigation
- Existing UI components (Input, Button, Label)

### Constraints
- Must use Supabase Auth (no custom backend)
- Email delivery depends on SMTP configuration
- Token expiry set at Supabase level (not configurable per request)
- Redirect URLs must be pre-configured in Supabase
- Supabase default SMTP limited to 2 emails/hour (dev only)

### Assumptions
- Users have access to email
- Email service is reliable
- Users' email addresses are valid
- Users understand password reset process
- HTTPS is enabled in production

---

## Risk Assessment

### High Risk
❌ **None** - Supabase Auth is battle-tested and reliable

### Medium Risk
⚠️ **Email Deliverability** - Emails might go to spam or be delayed
*Mitigation*:
- Use reputable SMTP provider (SendGrid)
- Configure SPF/DKIM records
- Use branded sender address
- Monitor email delivery rates

⚠️ **Token Expiry Too Short** - 1 hour might not be enough for some users
*Mitigation*:
- Default 1 hour is industry standard
- Users can request new link if expired
- Clear messaging about expiry time

### Low Risk
✅ **User Confusion** - Users might not check email
*Mitigation*: Clear success message tells users to check email

✅ **Browser Compatibility** - Older browsers might have issues
*Mitigation*: Use widely supported React features, test in major browsers

✅ **Dark Mode Issues** - Styling might break in dark mode
*Mitigation*: Test thoroughly in both modes during development

---

## Post-Launch Monitoring

### Week 1 After Launch
- Monitor password reset request rate
- Check email delivery success rate
- Track token expiry vs successful resets
- Monitor error logs for unexpected issues
- Collect user feedback
- Check email spam rates

### Week 2-4 After Launch
- Analyze completion rate (request → successful reset)
- Identify common failure points
- Optimize error messages based on feedback
- Consider adjusting token expiry if needed
- Monitor support tickets related to password reset

---

## Future Enhancements (Out of Scope)

### Phase 2 Potential Features
- **Password Reset History**: Log all reset attempts
- **Multi-Factor Authentication**: Require 2FA for password reset
- **Security Questions**: Additional verification before reset
- **SMS Reset**: Alternative to email reset
- **Password Policy Enforcement**: Configurable complexity rules
- **Breached Password Detection**: Check against known breaches (Have I Been Pwned)
- **Session Invalidation Notification**: Email when password changed
- **Account Activity Log**: Show recent password changes

---

## Reference Documentation

### Supabase Documentation
- Main Password Reset Guide: https://supabase.com/docs/guides/auth/passwords?queryGroups=flow&flow=implicit
- Auth API Reference: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Update User: https://supabase.com/docs/reference/javascript/auth-updateuser
- Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- SMTP Configuration: https://supabase.com/docs/guides/auth/auth-smtp

### Existing Files (Reference)
- `admin_frontend/src/pages/Login.jsx` - Login page for UI patterns
- `admin_frontend/src/contexts/AuthContext.jsx` - Authentication context
- `admin_frontend/src/utils/supabaseClient.js` - Supabase client setup
- `admin_frontend/src/components/ui/input.jsx` - Input component
- `admin_frontend/src/components/ui/button.jsx` - Button component
- `admin_frontend/src/components/ui/label.jsx` - Label component

---

## Implementation Notes

### Supabase Client Usage

The Supabase client is already configured in the application. Import and use:

```javascript
import { supabase } from '../utils/supabaseClient';

// Request password reset
const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: `${window.location.origin}/update-password`,
});

// Update password (after token validation)
const { error } = await supabase.auth.updateUser({
  password: 'new_password'
});
```

### Token Validation

Supabase automatically validates tokens when users access `/update-password` with the token in the URL. You don't need to manually validate - just check if there's a valid session:

```javascript
useEffect(() => {
  // Check for valid session (indicates valid token)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      // Token is valid, show password update form
      setHasValidToken(true);
    } else {
      // No session means invalid/expired token
      setError('Invalid or expired reset link');
    }
  });
}, []);
```

### Password Validation Regex

```javascript
const passwordValidation = {
  minLength: (password) => password.length >= 8,
  hasNumber: (password) => /\d/.test(password),
  hasLetter: (password) => /[a-zA-Z]/.test(password),
  isStrong: (password) => {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLong = password.length >= 12;

    if (hasUpper && hasLower && hasNumber && hasSpecial && isLong) return 'strong';
    if (hasUpper && hasLower && hasNumber && password.length >= 8) return 'medium';
    return 'weak';
  }
};
```

---

## Conclusion

This PRD provides a comprehensive plan for implementing password reset functionality using Supabase Auth's implicit flow. The implementation leverages Supabase's built-in authentication features, requiring no custom backend code.

**Key Advantages**:
- No backend code needed (Supabase handles everything)
- Industry-standard security practices
- Reliable email delivery with custom SMTP
- Clean, intuitive user experience
- Comprehensive error handling
- Mobile responsive and accessible

**Implementation Time**: 6-8 hours
- Supabase configuration: 1 hour
- Frontend components: 3-4 hours
- Integration and testing: 1-2 hours
- Code review and polish: 0.5 hours
- Documentation and deployment: 1 hour

**Confidence Score**: 9/10
- High confidence due to Supabase's reliable auth system
- Clear documentation and examples
- Proven pattern (implicit flow)
- Minimal backend complexity
- Comprehensive error handling planned

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 (Supabase Configuration)
