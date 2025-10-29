# PRD: Password Reset Feature Using Supabase Auth OTP

## Document Information
- **Feature**: Password Reset (Forgot Password) with OTP
- **Status**: Draft
- **Priority**: High
- **Estimated Effort**: 4-5 hours
- **Confidence Score**: 9/10
- **Created**: 2025-10-29
- **Version**: 2.0.0 (Updated to OTP)
- **Authentication Provider**: Supabase Auth (Email OTP)

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
Implement a **simple 3-step password reset flow** using Supabase Auth's Email OTP (One-Time Password):

1. User enters email → Receives 6-digit code
2. User enters code → Code verified
3. User sets new password → Done

### Key Benefits
- **Simpler Implementation**: Single page with step wizard (not 2 separate pages)
- **No Redirects Needed**: User stays on same page, no URL configuration
- **Mobile Friendly**: Easy to copy 6-digit code from email
- **Familiar UX**: Users know how OTP works (like 2FA)
- **Secure**: Same security as magic links but simpler
- **No Backend Code**: Supabase handles everything
- Self-service password recovery reduces admin burden

---

## User Stories

### Primary User Story
**As an** administrator who forgot their password
**I want to** reset my password using a code sent to my email
**So that** I can regain access quickly without clicking links

### Acceptance Criteria
- [ ] "Forgot password?" link is visible on login page
- [ ] Clicking link navigates to password reset page
- [ ] User can enter email and request OTP code
- [ ] System sends 6-digit code via email (expires in 1 hour)
- [ ] User enters code on same page (no navigation needed)
- [ ] System verifies code and allows password update
- [ ] User sets new password with real-time validation
- [ ] Success message appears and redirects to login
- [ ] Old password becomes invalid after reset
- [ ] Clear error messages for invalid/expired codes
- [ ] Email not found returns generic success message (security)
- [ ] Form validation prevents weak passwords
- [ ] Works in both light and dark modes

---

## Technical Requirements

### Core Technologies
- **Frontend**: React 18, React hooks (useState for step management)
- **Backend**: Supabase Auth API (serverless)
- **Email Service**: Supabase SMTP (or custom SMTP)
- **Authentication**: Supabase Email OTP
- **State Management**: React hooks only (no router needed for steps)

### Supabase Auth Flow (OTP)
Simple 3-step flow all on one page:

```
Step 1: Request OTP
User enters email → supabase.auth.signInWithOtp() → 6-digit code sent

Step 2: Verify OTP
User enters code → supabase.auth.verifyOtp() → Session created

Step 3: Update Password
User enters new password → supabase.auth.updateUser() → Done
```

### Data Flow
```
User clicks "Forgot Password?" → /reset-password page (Step 1)
    ↓
User enters email → supabase.auth.signInWithOtp({ email, shouldCreateUser: false })
    ↓
Supabase sends email with 6-digit code (e.g., "123456")
    ↓
Page shows Step 2: "Enter the code we sent to your email"
    ↓
User enters code → supabase.auth.verifyOtp({ email, token: '123456', type: 'email' })
    ↓
If valid: Page shows Step 3: "Set New Password"
    ↓
User enters new password → supabase.auth.updateUser({ password })
    ↓
Success → Redirect to /login with success message
```

**Key Advantage**: All 3 steps happen on ONE page, no navigation between pages!

---

## Frontend Components

### 1. PasswordReset Page (New) - Single Page with 3 Steps

**Location**: `admin_frontend/src/pages/PasswordReset.jsx`

**Purpose**: All-in-one password reset wizard

**Route**: `/reset-password` (public route)

**State Management**:
```javascript
{
  step: 'email' | 'verify' | 'update',  // Current wizard step
  email: string,                        // User's email
  otpCode: string,                      // 6-digit code
  newPassword: string,                  // New password
  confirmPassword: string,              // Confirm password
  loading: boolean,                     // API call in progress
  error: string | null,                 // Error message
  showPassword: boolean,                // Toggle password visibility
}
```

**Step 1: Enter Email**
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      Reset Your Password                │
│   Enter your email to receive a code   │
│                                         │
│   Email Address:                        │
│   [____________________________]        │
│                                         │
│   [Send Code]                           │
│                                         │
│   Back to Sign In                       │
└─────────────────────────────────────────┘
```

**Step 2: Verify OTP**
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      Enter Verification Code            │
│   We sent a 6-digit code to            │
│   admin@prepdoctors.com                 │
│                                         │
│   [1] [2] [3] [4] [5] [6]              │
│   (6 individual input boxes)            │
│                                         │
│   Didn't receive code? Resend (45s)     │
│                                         │
│   [Verify Code]                         │
│                                         │
│   ← Back                                │
└─────────────────────────────────────────┘
```

**Step 3: Set New Password**
```
┌─────────────────────────────────────────┐
│         [PrepDoctors Logo]              │
│                                         │
│      Set New Password                   │
│   Create a strong password              │
│                                         │
│   New Password:                         │
│   [____________________________] [👁]   │
│   [====================] Strong         │
│   ✓ At least 8 characters               │
│   ✓ Include numbers                     │
│   ✓ Include letters                     │
│                                         │
│   Confirm Password:                     │
│   [____________________________] [👁]   │
│   ✓ Passwords match                     │
│                                         │
│   [Update Password]                     │
└─────────────────────────────────────────┘
```

### 2. OTPInput Component (New)

**Location**: `admin_frontend/src/components/shared/OTPInput.jsx`

**Purpose**: 6-digit code input with auto-focus

**Features**:
- 6 individual input boxes
- Auto-focus next box on input
- Auto-focus previous box on backspace
- Paste support (paste "123456" fills all boxes)
- Only accepts numbers
- Visual feedback (border highlight on focus)
- Dark mode support

**Props**:
```javascript
{
  value: string,              // Current OTP value
  onChange: (value) => void,  // Callback when OTP changes
  disabled: boolean,          // Disable inputs during verification
  error: boolean              // Show error state (red borders)
}
```

### 3. Update Login Page

**Location**: `admin_frontend/src/pages/Login.jsx`

**Changes Required**:
- Add "Forgot password?" link below password field
- Link navigates to `/reset-password`

**Updated Layout**:
```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center">
    <Checkbox ... />
    <label ...>Remember me for 7 days</label>
  </div>

  <div className="text-sm">
    <Link
      to="/reset-password"
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
- Add route for `/reset-password` (public)

**New Route**:
```jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/reset-password" element={<PasswordReset />} />

  <Route path="/" element={<ProtectedAdminRoute>...</ProtectedAdminRoute>}>
    {/* Existing protected routes */}
  </Route>
</Routes>
```

### 5. Shared Components

**PasswordStrengthIndicator** (Reuse/Create)
- Visual bar showing weak/medium/strong
- Color coded: red/yellow/green

**PasswordRequirements** (Reuse/Create)
- Checklist component showing validation rules
- Checkmarks turn green when met

---

## Backend Requirements

### Supabase Configuration (Dashboard)

**1. Enable Email OTP**

Navigate to: **Authentication → Providers → Email**

- ✅ Enable "Email OTP"
- Set OTP expiration: `3600` seconds (1 hour)
- Rate limit: Default (1 request per 60 seconds per email)

**2. Email Template**

Navigate to: **Authentication → Email Templates → Magic Link**

**Update template to show OTP code** (use `{{ .Token }}` variable):

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0660B2; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; text-align: center; }
    .code {
      font-size: 42px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #0660B2;
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      font-family: monospace;
    }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PrepDoctors Admin</h1>
    </div>
    <div class="content">
      <h2>Your Password Reset Code</h2>

      <p>Enter this code to reset your password:</p>

      <div class="code">
        {{ .Token }}
      </div>

      <p><strong>This code expires in 1 hour.</strong></p>

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
- `{{ .Token }}` - The 6-digit OTP code (e.g., "123456")
- `{{ .SiteURL }}` - Your site URL (not needed for OTP, but available)

**3. Email Settings**

Navigate to: **Authentication → Email → SMTP Settings**

**For Development** (use Supabase default):
- Supabase provides built-in SMTP
- Limited to 2 emails per hour
- Suitable for testing only

**For Production** (configure custom SMTP):
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: [Your SendGrid API Key]
Sender Email: noreply@prepdoctors.com
Sender Name: PrepDoctors Admin
```

**4. Site URL Configuration**

Navigate to: **Settings → General → Site URL**

```
Production: https://admin.prepdoctors.com
Development: http://localhost:5173
```

**5. Rate Limiting (Automatic)**

- Default: 1 OTP request per 60 seconds per email
- Code expires after 1 hour
- Maximum 86,400 seconds (1 day) expiration

### No Backend Endpoints Needed

Supabase Auth handles all backend operations:
- ✅ OTP generation and email sending
- ✅ Code verification
- ✅ Password hashing and storage
- ✅ Token expiry management
- ✅ Rate limiting
- ✅ Security best practices

**Our frontend only needs 3 API calls**:
1. `supabase.auth.signInWithOtp()` - Send OTP code
2. `supabase.auth.verifyOtp()` - Verify code
3. `supabase.auth.updateUser()` - Update password

### NO Redirect URL Configuration Needed!

Unlike magic links, OTP doesn't require redirect URL configuration. Users stay on the same page throughout the entire flow.

---

## User Flow

### Happy Path: Successful Password Reset

```
1. User on login page, forgot password
2. Clicks "Forgot password?" link
3. Navigates to /reset-password page (Step 1: Email)
4. Enters email: admin@prepdoctors.com
5. Clicks "Send Code"
6. Loading spinner appears
7. Success: Page transitions to Step 2 (Verify Code)
8. Message: "We sent a 6-digit code to admin@prepdoctors.com"
9. Email arrives within 1 minute
10. User opens email, sees code: "487392"
11. User enters code in 6 input boxes: 4-8-7-3-9-2
12. Inputs auto-advance between boxes
13. Clicks "Verify Code" (or auto-submits after 6 digits)
14. Loading spinner appears
15. Success: Page transitions to Step 3 (Set Password)
16. User enters new password: "NewSecure123!"
17. Password strength indicator shows "Strong"
18. User confirms password: "NewSecure123!"
19. All validation checks pass (✓ green checkmarks)
20. Clicks "Update Password"
21. Loading spinner appears
22. Success message: "Password Updated!"
23. Countdown: "Redirecting to login in 3... 2... 1..."
24. Redirected to /login
25. User signs in with new password
26. Successfully authenticated → Dashboard
```

### Alternative Path: Resend OTP Code

```
1-11. [Same as happy path]
12. User didn't receive email or code expired
13. Waits 60 seconds (rate limit countdown)
14. Clicks "Resend Code"
15. New code sent
16. Continues from step 11
```

### Alternative Path: Invalid Code

```
1-13. [Same as happy path]
14. User enters wrong code: "123456"
15. Clicks "Verify Code"
16. Error message: "Invalid code. Please check and try again."
17. Input boxes turn red
18. User can try again (3-5 attempts before lockout)
19. User enters correct code
20. Continues to Step 3
```

### Alternative Path: Code Expired

```
1-13. [Same as happy path but waited 1+ hour]
14. User enters expired code
15. Clicks "Verify Code"
16. Error message: "This code has expired. Please request a new one."
17. "Request New Code" button appears
18. User clicks button → Back to Step 1
```

### Alternative Path: User Goes Back

```
At any step, user can click "← Back" or "Back to Sign In"
- From Step 2 → Returns to Step 1 (can change email)
- From Step 1 → Returns to /login
```

---

## Security Considerations

### 1. OTP Security
- **Expiry**: Codes expire after 1 hour
- **Single Use**: Code becomes invalid after successful verification
- **Numeric Only**: 6 digits (000000-999999) = 1 million combinations
- **Brute Force Protection**: Rate limiting prevents automated attempts
- **Secure Transmission**: Codes sent via email, not SMS (no SIM swapping risk)

### 2. Email Enumeration Prevention
- **Generic Success**: Same message for existing and non-existing emails
- **No User Feedback**: Don't reveal if email exists in system
- **Timing Attack Prevention**: Consistent response times

### 3. Rate Limiting
- **Request Limit**: 1 OTP per 60 seconds per email (Supabase default)
- **Verification Attempts**: Limited failed attempts before lockout
- **Email Limit**: SMTP rate limits apply

### 4. Password Requirements
- **Minimum Length**: 8 characters
- **Complexity**: Must include letters and numbers
- **Real-time Validation**: Check password strength before submission
- **No Common Passwords**: Supabase has built-in checking

### 5. Session Management
- **Auto Logout**: Old sessions invalidated after password change
- **Force Re-login**: User must sign in with new password

---

## Edge Cases & Error Handling

### 1. Invalid Email Format
**Scenario**: User enters malformed email
**Frontend Validation**: HTML5 email validation + custom regex
**Error Message**: "Please enter a valid email address"
**UI Behavior**: Disable submit button, show error below input

### 2. Network Error
**Scenario**: Network timeout or offline
**Error Message**: "Network error. Please check your connection and try again."
**UI Behavior**: Show error toast, keep form populated, allow retry

### 3. Invalid OTP Code
**Scenario**: User enters wrong 6-digit code
**Supabase Response**: 400 error "Invalid token"
**Error Message**: "Invalid code. Please check and try again."
**UI Behavior**: Input boxes turn red, allow retry (max 3-5 attempts)

### 4. OTP Code Expired
**Scenario**: User waits >1 hour before entering code
**Supabase Response**: 400 error "Token has expired"
**Error Message**: "This code has expired. Please request a new one."
**UI Behavior**: Show "Request New Code" button

### 5. Rate Limit Exceeded
**Scenario**: User requests multiple codes too quickly
**Supabase Response**: 429 error "Too many requests"
**Error Message**: "Please wait 60 seconds before requesting a new code."
**UI Behavior**: Show countdown timer, disable "Resend" button

### 6. Weak Password
**Scenario**: Password doesn't meet requirements
**Frontend Validation**: Real-time checking
**Error Message**: "Password must meet all requirements"
**UI Behavior**: Disable submit, show failed requirements in red

### 7. Passwords Don't Match
**Scenario**: New password ≠ confirm password
**Frontend Validation**: Compare on change
**Error Message**: "Passwords do not match"
**UI Behavior**: Disable submit, show error

### 8. Email Service Down
**Scenario**: SMTP server unavailable
**Supabase Behavior**: Queues email, retries automatically
**User Experience**: Success message shown, email may be delayed
**Fallback**: User can request again

### 9. User Already Authenticated
**Scenario**: Logged-in user tries to reset password
**Detection**: Check auth state on page load
**UI Behavior**: Redirect to dashboard

---

## Testing Requirements

### Unit Tests

#### PasswordReset Component Tests
**File**: `admin_frontend/src/pages/__tests__/PasswordReset.test.jsx`

```javascript
describe('PasswordReset', () => {
  describe('Step 1: Email Entry', () => {
    test('renders email input form', () => {});
    test('validates email format', () => {});
    test('disables submit for invalid email', () => {});
    test('sends OTP on submit', () => {});
    test('transitions to Step 2 on success', () => {});
  });

  describe('Step 2: OTP Verification', () => {
    test('renders 6 OTP input boxes', () => {});
    test('auto-advances between input boxes', () => {});
    test('handles paste of 6-digit code', () => {});
    test('shows error for invalid code', () => {});
    test('allows resend after 60 seconds', () => {});
    test('transitions to Step 3 on success', () => {});
  });

  describe('Step 3: Password Update', () => {
    test('validates password requirements', () => {});
    test('shows password strength indicator', () => {});
    test('validates passwords match', () => {});
    test('updates password on submit', () => {});
    test('redirects to login on success', () => {});
  });

  test('allows navigation back to previous step', () => {});
  test('renders correctly in dark mode', () => {});
});
```

#### OTPInput Component Tests
**File**: `admin_frontend/src/components/__tests__/OTPInput.test.jsx`

```javascript
describe('OTPInput', () => {
  test('renders 6 input boxes', () => {});
  test('only accepts numeric input', () => {});
  test('auto-focuses next box on digit entry', () => {});
  test('auto-focuses previous box on backspace', () => {});
  test('handles paste of 6-digit code', () => {});
  test('shows error state with red borders', () => {});
  test('calls onChange with complete code', () => {});
});
```

### Integration Tests

**File**: `admin_root/tests/integration/test-password-reset-otp.js`

```javascript
describe('Password Reset OTP Flow', () => {
  test('complete flow: request → verify → update', async () => {
    // 1. Navigate to reset password
    // 2. Enter email and send OTP
    // 3. Get OTP code from Supabase test helpers
    // 4. Verify OTP code
    // 5. Set new password
    // 6. Verify redirect to login
    // 7. Login with new password
    // 8. Verify authenticated
  });

  test('expired code handling', async () => {
    // 1. Generate OTP
    // 2. Wait for expiration
    // 3. Try to verify
    // 4. Verify error message
    // 5. Request new code
  });

  test('invalid code handling', async () => {
    // 1. Request OTP
    // 2. Enter wrong code
    // 3. Verify error message
    // 4. Enter correct code
    // 5. Verify success
  });

  test('resend code flow', async () => {
    // 1. Request OTP
    // 2. Wait 60 seconds
    // 3. Click resend
    // 4. Verify new code sent
    // 5. Verify old code invalid
  });
});
```

### Manual Testing Checklist

**Step 1: Email Entry**:
- [ ] Page renders correctly
- [ ] Email validation works
- [ ] Submit button disabled for invalid email
- [ ] Loading state shows during request
- [ ] Transitions to Step 2 on success
- [ ] Error shown for network issues

**Email**:
- [ ] OTP email received (check spam)
- [ ] 6-digit code displayed prominently
- [ ] Email styling renders correctly
- [ ] Expiry time mentioned

**Step 2: OTP Verification**:
- [ ] 6 input boxes render
- [ ] Auto-focus between boxes works
- [ ] Paste support works (try pasting "123456")
- [ ] Only accepts numbers
- [ ] Resend button disabled for 60 seconds
- [ ] Countdown timer shows correctly
- [ ] Invalid code shows error
- [ ] Expired code shows error with "Request New" button
- [ ] Transitions to Step 3 on success

**Step 3: Password Update**:
- [ ] Password requirements show
- [ ] Strength indicator updates in real-time
- [ ] Password visibility toggle works
- [ ] Validation checks update as user types
- [ ] Submit disabled until valid
- [ ] Success message shows
- [ ] Countdown and redirect work
- [ ] Can log in with new password
- [ ] Old password doesn't work

**General**:
- [ ] "Back" button works at each step
- [ ] "Back to Sign In" link works
- [ ] Dark mode styling correct
- [ ] Mobile responsive
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

---

## Implementation Checklist

### Phase 1: Supabase Configuration (30 min)

- [ ] Enable Email OTP in Supabase Dashboard
  - [ ] Navigate to Auth → Providers → Email
  - [ ] Enable "Email OTP"
  - [ ] Set expiration to 3600 seconds
- [ ] Update email template to show OTP code
  - [ ] Use `{{ .Token }}` variable
  - [ ] Style code prominently
  - [ ] Test template
- [ ] Configure SMTP (if production)
  - [ ] Set up SendGrid
  - [ ] Configure in Supabase
  - [ ] Send test email
- [ ] Set site URL

### Phase 2: Frontend Components (2-3 hours)

- [ ] Create PasswordReset page with step wizard
  - [ ] Step 1: Email input
  - [ ] Step 2: OTP verification
  - [ ] Step 3: Password update
  - [ ] Step navigation logic
  - [ ] Loading states
  - [ ] Error handling
  - [ ] Dark mode styling
- [ ] Create OTPInput component
  - [ ] 6 individual input boxes
  - [ ] Auto-focus logic
  - [ ] Paste support
  - [ ] Numeric-only validation
  - [ ] Error state styling
- [ ] Reuse/create PasswordStrengthIndicator
- [ ] Reuse/create PasswordRequirements
- [ ] Update Login page
  - [ ] Add "Forgot password?" link
- [ ] Update App routing
  - [ ] Add /reset-password route

### Phase 3: Integration & Testing (1 hour)

- [ ] Test complete OTP flow
  - [ ] Email sent and received
  - [ ] Code verification works
  - [ ] Password update succeeds
- [ ] Test error scenarios
  - [ ] Invalid code
  - [ ] Expired code
  - [ ] Weak password
  - [ ] Rate limiting
- [ ] Test resend functionality
- [ ] Test in dark mode
- [ ] Test mobile responsiveness

### Phase 4: Code Review & Polish (30 min)

- [ ] Review code for best practices
- [ ] Check accessibility
- [ ] Verify error messages
- [ ] Test performance
- [ ] Remove console logs

### Phase 5: Documentation & Deployment (1 hour)

- [ ] Update component documentation
- [ ] Add JSDoc comments
- [ ] Update README
- [ ] Build and test production
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor for errors

---

## Success Metrics

### Functional Metrics
- ✅ OTP request succeeds 100% of time
- ✅ Emails delivered within 2 minutes
- ✅ Code verification succeeds with valid code
- ✅ Password update succeeds after verification
- ✅ Old password invalid after reset

### User Experience Metrics
- ⏱️ Reset page loads within 500ms
- ⏱️ Email arrives within 2 minutes
- ⏱️ Code verification completes within 1 second
- ⏱️ Password update completes within 2 seconds
- ⏱️ No page navigation required (single page)
- 📊 Clear instructions at each step

### Security Metrics
- 🔒 Codes expire after 1 hour
- 🔒 Codes cannot be reused
- 🔒 Rate limiting prevents abuse
- 🔒 No email enumeration
- 🔒 Weak passwords rejected

---

## Dependencies & Constraints

### Dependencies
- Supabase Auth service
- SMTP service for email
- Existing AuthContext
- Existing UI components

### Constraints
- Must use Supabase Auth (no custom backend)
- OTP rate limited to 1 per 60 seconds
- Code expires after 1 hour (configurable)
- Email delivery depends on SMTP

### Assumptions
- Users have email access
- Users can copy 6 digits accurately
- Email service is reliable

---

## Comparison: OTP vs Magic Link

| Feature | OTP (This PRD) | Magic Link (Alternative) |
|---------|----------------|--------------------------|
| **Simplicity** | ✅ Simpler (1 page) | ❌ More complex (2 pages) |
| **User Steps** | 3 steps on 1 page | 2 pages with navigation |
| **Configuration** | ✅ No redirect URLs | ❌ Must configure redirects |
| **Code** | 6-digit number | Long token in URL |
| **Mobile UX** | ✅ Easy to copy code | ❌ Must click link |
| **URL Safety** | ✅ No tokens in URL | ⚠️ Token visible in URL |
| **Effort** | 4-5 hours | 6-8 hours |

**Recommendation**: Use OTP for simpler, more maintainable implementation.

---

## Implementation Notes

### API Usage Examples

**Step 1: Send OTP**
```javascript
const { error } = await supabase.auth.signInWithOtp({
  email: email,
  options: {
    shouldCreateUser: false  // Don't create new users during reset
  }
});

if (error) {
  setError(error.message);
} else {
  setStep('verify');  // Move to Step 2
}
```

**Step 2: Verify OTP**
```javascript
const { data: { session }, error } = await supabase.auth.verifyOtp({
  email: email,
  token: otpCode,  // '123456'
  type: 'email'
});

if (error) {
  setError('Invalid code. Please try again.');
} else {
  setStep('update');  // Move to Step 3, session is now active
}
```

**Step 3: Update Password**
```javascript
const { error } = await supabase.auth.updateUser({
  password: newPassword
});

if (error) {
  setError(error.message);
} else {
  navigate('/login?reset=success');
}
```

---

## Conclusion

This PRD provides a comprehensive plan for implementing password reset using Supabase Auth's **Email OTP**, which is **significantly simpler** than magic link approaches.

**Key Advantages**:
- **Simpler**: Single page with step wizard (not 2 pages)
- **No Redirects**: No URL configuration needed
- **Mobile Friendly**: Easy to copy 6-digit code
- **Familiar**: Users know OTP from 2FA
- **Secure**: Same security as magic links
- **No Backend**: Supabase handles everything
- **Faster Implementation**: 4-5 hours vs 6-8 hours

**Implementation Time**: 4-5 hours
- Supabase configuration: 30 min
- Frontend components: 2-3 hours
- Integration and testing: 1 hour
- Code review and polish: 30 min
- Documentation and deployment: 1 hour

**Confidence Score**: 9/10

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 (Supabase Configuration)
