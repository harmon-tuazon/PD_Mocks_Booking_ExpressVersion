# PRD: Password Reset Feature Using Custom OTP with HubSpot Email Delivery

## Document Information
- **Feature**: Password Reset (Forgot Password) with Custom OTP
- **Status**: Draft
- **Priority**: High
- **Estimated Effort**: 5-6 hours
- **Confidence Score**: 9/10
- **Created**: 2025-10-29
- **Version**: 3.0.0 (Custom OTP with HubSpot Email)
- **Authentication Provider**: Supabase Auth (Password Update via Admin API)
- **Email Delivery**: HubSpot Workflow via Webhook

## Table of Contents
1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Technical Requirements](#technical-requirements)
4. [Architecture](#architecture)
5. [Frontend Components](#frontend-components)
6. [Backend Requirements](#backend-requirements)
7. [User Flow](#user-flow)
8. [HubSpot Workflow Configuration](#hubspot-workflow-configuration)
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
Implement a **simple 3-step password reset flow** using a custom OTP system with HubSpot for email delivery:

1. User enters email → Receives 6-digit code via HubSpot email
2. User enters code → Code verified against Redis
3. User sets new password → Password updated via Supabase Admin API

### Key Benefits
- **HubSpot Email Delivery**: Branded emails via existing HubSpot workflows
- **No SMTP Configuration**: Uses HubSpot's email infrastructure
- **Full Control**: Custom OTP generation and validation logic
- **Redis Storage**: Lightweight, auto-expiring OTP storage (~100 bytes per OTP)
- **30-minute TTL**: Shorter expiry for better security
- **Single Page UX**: All 3 steps on one page, no navigation
- Self-service password recovery reduces admin burden

### Why Custom OTP Instead of Supabase OTP?
- **HubSpot Email Branding**: Use existing HubSpot email templates and workflows
- **No SMTP Setup**: Avoid configuring external SMTP servers
- **Webhook Integration**: Trigger HubSpot workflows for email delivery
- **Existing Infrastructure**: Leverages Redis already in use for booking locks

---

## User Stories

### Primary User Story
**As an** administrator who forgot their password
**I want to** reset my password using a code sent to my email via HubSpot
**So that** I can regain access quickly with branded PrepDoctors emails

### Acceptance Criteria
- [ ] "Forgot password?" link is visible on login page
- [ ] Clicking link navigates to password reset page
- [ ] User can enter email and request OTP code
- [ ] System generates 6-digit code and stores in Redis (expires in 30 minutes)
- [ ] System triggers HubSpot workflow to send branded email
- [ ] User enters code on same page (no navigation needed)
- [ ] System verifies code against Redis
- [ ] User sets new password with real-time validation
- [ ] System updates password via Supabase Admin API
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
- **Backend**: Vercel Serverless Functions
- **OTP Storage**: Redis (existing infrastructure)
- **Email Delivery**: HubSpot Workflow via Webhook
- **Password Update**: Supabase Admin API
- **State Management**: React hooks only (no router needed for steps)

### Custom OTP Flow
Simple 3-step flow all on one page:

```
Step 1: Request OTP
User enters email → API generates OTP → Redis stores OTP → HubSpot sends email

Step 2: Verify OTP
User enters code → API verifies against Redis → Returns success/failure

Step 3: Update Password
User enters new password → Supabase Admin API updates password → Done
```

### Data Flow
```
User clicks "Forgot Password?" → /reset-password page (Step 1)
    ↓
User enters email → POST /api/auth/request-otp
    ↓
API generates 6-digit OTP
    ↓
API stores in Redis: otp:{email} = {code, attempts, createdAt} (TTL: 30 min)
    ↓
API sends webhook to HubSpot workflow endpoint
    ↓
HubSpot workflow sends branded email with OTP code
    ↓
Page shows Step 2: "Enter the code we sent to your email"
    ↓
User enters code → POST /api/auth/verify-otp
    ↓
API verifies code against Redis (increments attempts on failure)
    ↓
If valid: Page shows Step 3: "Set New Password"
    ↓
User enters new password → POST /api/auth/update-password
    ↓
API uses Supabase Admin API to update password
    ↓
Success → Redirect to /login with success message
```

**Key Advantage**: All 3 steps happen on ONE page, no navigation between pages!

---

## Architecture

### System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Vercel API     │────▶│     Redis       │
│  (Frontend)     │     │  (Serverless)   │     │   (OTP Store)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ Webhook
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ HubSpot Webhook │────▶│ HubSpot Email   │
                        │    Endpoint     │     │   Workflow      │
                        └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  User's Inbox   │
                                               └─────────────────┘
```

### Redis Storage Schema

**Key**: `otp:{email}`
**Value**: JSON object
**TTL**: 1800 seconds (30 minutes)

```javascript
{
  "code": "487392",           // 6-digit OTP
  "createdAt": 1699123456789  // Timestamp for rate limiting
}
```

**Memory Usage**: ~80 bytes per OTP
**Impact on 30MB limit**: Negligible (<0.1%)

### Rate Limiting Keys

**Key**: `otp:ratelimit:{email}`
**Value**: "1"
**TTL**: 60 seconds

Used to enforce 1 OTP request per 60 seconds per email.

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

### API Endpoints

#### 1. POST /api/auth/request-otp

**Location**: `admin_root/api/auth/request-otp.js`

**Purpose**: Generate OTP, store in Redis, trigger HubSpot email

**Request**:
```javascript
{
  "email": "admin@prepdoctors.com"
}
```

**Response (Success)**:
```javascript
{
  "success": true,
  "message": "If this email exists, a code has been sent."
}
```

**Response (Rate Limited)**:
```javascript
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Please wait 60 seconds before requesting a new code."
  }
}
```

**Implementation**:
```javascript
const Joi = require('joi');
const RedisLockService = require('../_shared/redis');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Validation schema
const requestOtpSchema = Joi.object({
  email: Joi.string().email().required()
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate input
    const { error, value } = requestOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email } = value;
    const redis = new RedisLockService();

    // Check rate limit
    const rateLimitKey = `otp:ratelimit:${email}`;
    const isRateLimited = await redis.get(rateLimitKey);

    if (isRateLimited) {
      await redis.close();
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Please wait 60 seconds before requesting a new code.'
        }
      });
    }

    // Check if user exists in Supabase (optional - for security, always return success)
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = users?.users?.some(u => u.email === email);

    if (userExists) {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store in Redis with 30-minute TTL
      const otpData = {
        code: otp,
        createdAt: Date.now()
      };

      await redis.setex(`otp:${email}`, 1800, JSON.stringify(otpData));

      // Set rate limit (60 seconds)
      await redis.setex(rateLimitKey, 60, '1');

      // Trigger HubSpot workflow via webhook
      const hubspotWebhookUrl = 'https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/GC6xV7M';

      await axios.post(hubspotWebhookUrl, {
        email: email,
        otp: otp
      });

      console.log(`✅ OTP sent to ${email}`);
    }

    await redis.close();

    // Always return success (security - don't reveal if email exists)
    return res.status(200).json({
      success: true,
      message: 'If this email exists, a code has been sent.'
    });

  } catch (error) {
    console.error('❌ Error in request-otp:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' }
    });
  }
};
```

#### 2. POST /api/auth/verify-otp

**Location**: `admin_root/api/auth/verify-otp.js`

**Purpose**: Verify OTP code against Redis

**Request**:
```javascript
{
  "email": "admin@prepdoctors.com",
  "code": "487392"
}
```

**Response (Success)**:
```javascript
{
  "success": true,
  "message": "Code verified successfully."
}
```

**Response (Invalid Code)**:
```javascript
{
  "success": false,
  "error": {
    "code": "INVALID_CODE",
    "message": "Invalid code. Please check and try again."
  }
}
```

**Response (Expired)**:
```javascript
{
  "success": false,
  "error": {
    "code": "CODE_EXPIRED",
    "message": "This code has expired. Please request a new one."
  }
}
```

**Implementation**:
```javascript
const Joi = require('joi');
const RedisLockService = require('../_shared/redis');

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required()
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { error, value } = verifyOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email, code } = value;
    const redis = new RedisLockService();

    // Get OTP data from Redis
    const otpKey = `otp:${email}`;
    const otpDataStr = await redis.get(otpKey);

    if (!otpDataStr) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_EXPIRED',
          message: 'This code has expired. Please request a new one.'
        }
      });
    }

    const otpData = JSON.parse(otpDataStr);

    // Verify code
    if (otpData.code !== code) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid code. Please check and try again.'
        }
      });
    }

    // Code is valid - mark as verified (don't delete yet, need for password update)
    otpData.verified = true;
    await redis.setex(otpKey, 1800, JSON.stringify(otpData));
    await redis.close();

    return res.status(200).json({
      success: true,
      message: 'Code verified successfully.'
    });

  } catch (error) {
    console.error('❌ Error in verify-otp:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' }
    });
  }
};
```

#### 3. POST /api/auth/update-password

**Location**: `admin_root/api/auth/update-password.js`

**Purpose**: Update password via Supabase Admin API

**Request**:
```javascript
{
  "email": "admin@prepdoctors.com",
  "password": "NewSecure123!"
}
```

**Response (Success)**:
```javascript
{
  "success": true,
  "message": "Password updated successfully."
}
```

**Implementation**:
```javascript
const Joi = require('joi');
const RedisLockService = require('../_shared/redis');
const { createClient } = require('@supabase/supabase-js');

const updatePasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { error, value } = updatePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.details[0].message }
      });
    }

    const { email, password } = value;
    const redis = new RedisLockService();

    // Verify OTP was validated
    const otpKey = `otp:${email}`;
    const otpDataStr = await redis.get(otpKey);

    if (!otpDataStr) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session expired. Please start the password reset process again.'
        }
      });
    }

    const otpData = JSON.parse(otpDataStr);

    if (!otpData.verified) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: {
          code: 'CODE_NOT_VERIFIED',
          message: 'Please verify your code first.'
        }
      });
    }

    // Update password via Supabase Admin API
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      await redis.close();
      return res.status(400).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' }
      });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: password }
    );

    if (updateError) {
      await redis.close();
      console.error('❌ Supabase password update error:', updateError.message);
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Failed to update password.' }
      });
    }

    // Delete OTP from Redis (cleanup)
    await redis.del(otpKey);
    await redis.close();

    console.log(`✅ Password updated for ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('❌ Error in update-password:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.' }
    });
  }
};
```

### Environment Variables Required

```bash
# Existing
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PD_Bookings_Cache_REDIS_URL=redis://...

# No new variables needed - HubSpot webhook URL is hardcoded
```

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
7. API generates OTP, stores in Redis, triggers HubSpot webhook
8. HubSpot workflow sends branded email
9. Success: Page transitions to Step 2 (Verify Code)
10. Message: "We sent a 6-digit code to admin@prepdoctors.com"
11. Email arrives within 1-2 minutes (HubSpot delivery)
12. User opens email, sees code: "487392"
13. User enters code in 6 input boxes: 4-8-7-3-9-2
14. Inputs auto-advance between boxes
15. Clicks "Verify Code"
16. API verifies against Redis
17. Success: Page transitions to Step 3 (Set Password)
18. User enters new password: "NewSecure123!"
19. Password strength indicator shows "Strong"
20. User confirms password: "NewSecure123!"
21. All validation checks pass (✓ green checkmarks)
22. Clicks "Update Password"
23. API updates password via Supabase Admin API
24. Success message: "Password Updated!"
25. Countdown: "Redirecting to login in 3... 2... 1..."
26. Redirected to /login
27. User signs in with new password
28. Successfully authenticated → Dashboard
```

### Alternative Path: Resend OTP Code

```
1-11. [Same as happy path]
12. User didn't receive email or code expired
13. Waits 60 seconds (rate limit countdown)
14. Clicks "Resend Code"
15. New code generated, stored in Redis, HubSpot sends new email
16. Continues from step 11
```

### Alternative Path: Invalid Code

```
1-13. [Same as happy path]
14. User enters wrong code: "123456"
15. Clicks "Verify Code"
16. Error message: "Invalid code. Please check and try again. (4 attempts remaining)"
17. Input boxes turn red
18. User can try again (max 5 attempts)
19. User enters correct code
20. Continues to Step 3
```

### Alternative Path: Code Expired

```
1-13. [Same as happy path but waited 30+ minutes]
14. User enters expired code
15. Clicks "Verify Code"
16. Error message: "This code has expired. Please request a new one."
17. "Request New Code" button appears
18. User clicks button → Back to Step 1
```

---

## HubSpot Workflow Configuration

### Webhook Endpoint

**URL**: `https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/GC6xV7M`

### Webhook Payload

```javascript
{
  "email": "admin@prepdoctors.com",
  "otp": "487392"
}
```

### HubSpot Workflow Setup

1. **Trigger**: Webhook receives payload
2. **Action 1**: Look up contact by email (or create enrollment record)
3. **Action 2**: Send email using template
4. **Email Template Variables**:
   - `{{ otp }}` - The 6-digit code
   - `{{ email }}` - The recipient email

### Email Template (HubSpot)

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
        {{ otp }}
      </div>

      <p><strong>This code expires in 30 minutes.</strong></p>

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

---

## Security Considerations

### 1. OTP Security
- **Expiry**: Codes expire after 30 minutes (shorter is more secure)
- **Single Use**: Code becomes invalid after successful password update
- **Numeric Only**: 6 digits (000000-999999) = 1 million combinations
- **Secure Storage**: OTP stored in Redis, not in logs or responses

### 2. Email Enumeration Prevention
- **Generic Success**: Same message for existing and non-existing emails
- **No User Feedback**: Don't reveal if email exists in system
- **Timing Attack Prevention**: Consistent response times

### 3. Rate Limiting
- **Request Limit**: 1 OTP per 60 seconds per email
- **Auto-cleanup**: OTP deleted after password update or expiry

### 4. Password Requirements
- **Minimum Length**: 8 characters
- **Complexity**: Must include letters and numbers
- **Real-time Validation**: Check password strength before submission

### 5. Session Management
- **Verification Required**: Password update only after OTP verified
- **OTP Cleanup**: OTP deleted from Redis after password update

### 6. Redis Security
- **No Sensitive Data in Keys**: Only email in key name
- **Auto-expiration**: TTL ensures cleanup
- **Encrypted Connection**: Redis URL uses TLS

---

## Edge Cases & Error Handling

### 1. Invalid Email Format
**Scenario**: User enters malformed email
**Frontend Validation**: HTML5 email validation + custom regex
**Backend Validation**: Joi schema validation
**Error Message**: "Please enter a valid email address"
**UI Behavior**: Disable submit button, show error below input

### 2. Network Error
**Scenario**: Network timeout or offline
**Error Message**: "Network error. Please check your connection and try again."
**UI Behavior**: Show error toast, keep form populated, allow retry

### 3. Invalid OTP Code
**Scenario**: User enters wrong 6-digit code
**Backend Response**: 400 error "INVALID_CODE"
**Error Message**: "Invalid code. Please check and try again."
**UI Behavior**: Input boxes turn red, allow retry

### 4. OTP Code Expired
**Scenario**: User waits >30 minutes before entering code
**Backend Response**: 400 error "CODE_EXPIRED"
**Error Message**: "This code has expired. Please request a new one."
**UI Behavior**: Show "Request New Code" button

### 5. Rate Limit Exceeded
**Scenario**: User requests multiple codes too quickly
**Backend Response**: 429 error "RATE_LIMITED"
**Error Message**: "Please wait 60 seconds before requesting a new code."
**UI Behavior**: Show countdown timer, disable "Send Code" button

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

### 8. HubSpot Webhook Failure
**Scenario**: HubSpot webhook endpoint unavailable
**Backend Handling**: Log error, still return success (don't reveal)
**User Experience**: User won't receive email
**Fallback**: User can try again after 60 seconds

### 9. User Already Authenticated
**Scenario**: Logged-in user tries to reset password
**Detection**: Check auth state on page load
**UI Behavior**: Redirect to dashboard

### 10. Session Expired Before Password Update
**Scenario**: User verifies OTP but waits >30 minutes to set password
**Backend Response**: 400 error "SESSION_EXPIRED"
**Error Message**: "Session expired. Please start the password reset process again."
**UI Behavior**: Return to Step 1

---

## Testing Requirements

### Unit Tests

#### API Endpoint Tests
**File**: `admin_root/tests/unit/auth/request-otp.test.js`

```javascript
describe('POST /api/auth/request-otp', () => {
  test('generates OTP and stores in Redis', async () => {});
  test('triggers HubSpot webhook with correct payload', async () => {});
  test('enforces rate limiting (1 per 60 seconds)', async () => {});
  test('returns generic success for non-existent email', async () => {});
  test('validates email format', async () => {});
});
```

**File**: `admin_root/tests/unit/auth/verify-otp.test.js`

```javascript
describe('POST /api/auth/verify-otp', () => {
  test('verifies correct OTP code', async () => {});
  test('rejects incorrect OTP code', async () => {});
  test('returns expired error for missing OTP', async () => {});
});
```

**File**: `admin_root/tests/unit/auth/update-password.test.js`

```javascript
describe('POST /api/auth/update-password', () => {
  test('updates password via Supabase Admin API', async () => {});
  test('requires OTP to be verified first', async () => {});
  test('deletes OTP from Redis after success', async () => {});
  test('validates password minimum length', async () => {});
  test('returns error for non-existent user', async () => {});
});
```

#### Frontend Component Tests
**File**: `admin_frontend/src/pages/__tests__/PasswordReset.test.jsx`

```javascript
describe('PasswordReset', () => {
  describe('Step 1: Email Entry', () => {
    test('renders email input form', () => {});
    test('validates email format', () => {});
    test('disables submit for invalid email', () => {});
    test('calls request-otp API on submit', () => {});
    test('transitions to Step 2 on success', () => {});
  });

  describe('Step 2: OTP Verification', () => {
    test('renders 6 OTP input boxes', () => {});
    test('auto-advances between input boxes', () => {});
    test('handles paste of 6-digit code', () => {});
    test('calls verify-otp API on submit', () => {});
    test('shows error for invalid code', () => {});
    test('allows resend after 60 seconds', () => {});
    test('transitions to Step 3 on success', () => {});
  });

  describe('Step 3: Password Update', () => {
    test('validates password requirements', () => {});
    test('shows password strength indicator', () => {});
    test('validates passwords match', () => {});
    test('calls update-password API on submit', () => {});
    test('redirects to login on success', () => {});
  });

  test('allows navigation back to previous step', () => {});
  test('renders correctly in dark mode', () => {});
});
```

### Integration Tests

**File**: `admin_root/tests/integration/password-reset-flow.test.js`

```javascript
describe('Password Reset Flow (Integration)', () => {
  test('complete flow: request → verify → update', async () => {
    // 1. Request OTP
    // 2. Verify OTP stored in Redis
    // 3. Verify code
    // 4. Update password
    // 5. Verify can login with new password
  });

  test('HubSpot webhook is triggered with correct payload', async () => {
    // Mock HubSpot endpoint
    // Verify payload contains email and otp
  });

  test('rate limiting prevents rapid requests', async () => {
    // Request OTP
    // Immediately request again
    // Verify 429 response
  });

  test('expired OTP returns correct error', async () => {
    // Request OTP
    // Manually expire in Redis
    // Attempt to verify
    // Verify error response
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
- [ ] Rate limit message after rapid requests

**Email Delivery**:
- [ ] HubSpot workflow triggered
- [ ] Email received (check spam)
- [ ] 6-digit code displayed prominently
- [ ] Email styling renders correctly
- [ ] Expiry time mentioned (30 minutes)

**Step 2: OTP Verification**:
- [ ] 6 input boxes render
- [ ] Auto-focus between boxes works
- [ ] Paste support works
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

---

## Implementation Checklist

### Phase 1: Backend API Endpoints (2 hours)

- [ ] Create request-otp endpoint
  - [ ] OTP generation (6 digits)
  - [ ] Redis storage with 30-minute TTL
  - [ ] Rate limiting (60 seconds)
  - [ ] HubSpot webhook trigger
  - [ ] Joi validation
- [ ] Create verify-otp endpoint
  - [ ] Redis lookup
  - [ ] Verified flag setting
- [ ] Create update-password endpoint
  - [ ] Verification check
  - [ ] Supabase Admin API call
  - [ ] Redis cleanup
  - [ ] Joi validation

### Phase 2: HubSpot Workflow (30 min)

- [ ] Create or update HubSpot workflow
- [ ] Configure webhook trigger
- [ ] Create email template with OTP variable
- [ ] Test email delivery

### Phase 3: Frontend Components (2-3 hours)

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

### Phase 4: Testing (1 hour)

- [ ] Write unit tests for API endpoints
- [ ] Write component tests
- [ ] Test complete flow manually
- [ ] Test error scenarios
- [ ] Test HubSpot email delivery
- [ ] Test rate limiting
- [ ] Test in dark mode
- [ ] Test mobile responsiveness

### Phase 5: Documentation & Deployment (30 min)

- [ ] Update API documentation
- [ ] Add JSDoc comments
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor for errors

---

## Success Metrics

### Functional Metrics
- ✅ OTP request succeeds 100% of time
- ✅ HubSpot email delivered within 2 minutes
- ✅ Code verification succeeds with valid code
- ✅ Password update succeeds after verification
- ✅ Old password invalid after reset

### User Experience Metrics
- ⏱️ Reset page loads within 500ms
- ⏱️ API response times under 1 second
- ⏱️ HubSpot email arrives within 2 minutes
- ⏱️ No page navigation required (single page)
- 📊 Clear instructions at each step

### Security Metrics
- 🔒 Codes expire after 30 minutes
- 🔒 Codes cannot be reused
- 🔒 Rate limiting (1 per 60 seconds)
- 🔒 No email enumeration
- 🔒 Weak passwords rejected

### Technical Metrics
- 📊 Redis memory usage: <1KB per OTP
- 📊 99.9% HubSpot webhook delivery success
- 📊 Zero orphaned OTPs (TTL auto-cleanup)

---

## Dependencies & Constraints

### Dependencies
- Redis (existing infrastructure)
- Supabase Auth Admin API
- HubSpot Workflow API
- Existing UI components
- Axios for HTTP requests

### Constraints
- OTP rate limited to 1 per 60 seconds
- Code expires after 30 minutes
- Email delivery depends on HubSpot
- Requires SUPABASE_SERVICE_ROLE_KEY

### Assumptions
- Users have email access
- HubSpot workflow is configured and active
- Redis has sufficient memory (minimal impact)
- Supabase Admin API is available

---

## Comparison: Custom OTP vs Supabase OTP

| Feature | Custom OTP (This PRD) | Supabase OTP |
|---------|----------------------|--------------|
| **Email Delivery** | ✅ HubSpot branded | ❌ Requires SMTP setup |
| **Email Templates** | ✅ HubSpot templates | ❌ Supabase templates |
| **Infrastructure** | ✅ Uses existing Redis | ❌ Requires SMTP config |
| **Backend Code** | ❌ Need 3 endpoints | ✅ No backend needed |
| **Control** | ✅ Full control | ❌ Limited customization |
| **TTL** | ✅ Configurable (30 min) | ⚠️ Fixed options |
| **Effort** | 5-6 hours | 4-5 hours |

**Recommendation**: Use Custom OTP for HubSpot email branding and existing infrastructure.

---

## Conclusion

This PRD provides a comprehensive plan for implementing password reset using a **custom OTP system with HubSpot email delivery**.

**Key Advantages**:
- **HubSpot Branding**: Use existing email templates and workflows
- **No SMTP Setup**: Leverages HubSpot's email infrastructure
- **Existing Infrastructure**: Uses Redis already configured
- **Full Control**: Custom OTP generation, validation, and expiry
- **30-minute TTL**: Shorter expiry for better security
- **Minimal Redis Impact**: ~100 bytes per OTP

**Implementation Time**: 5-6 hours
- Backend API endpoints: 2 hours
- HubSpot workflow: 30 min
- Frontend components: 2-3 hours
- Testing: 1 hour
- Documentation and deployment: 30 min

**Confidence Score**: 9/10

---

**Document Status**: Ready for Implementation
**Next Steps**: Begin Phase 1 (Backend API Endpoints)