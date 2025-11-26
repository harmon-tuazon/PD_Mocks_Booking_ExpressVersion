# PRD: Admin Token Editing for Trainee Dashboard

**Feature Type:** Admin Enhancement
**Priority:** High
**Estimated Effort:** 4-6 hours
**Developer Agents Required:** react-frontend-architect, express-backend-architect, hubspot-crm-specialist, security-compliance-auditor, test-validation-specialist

---

## 1. Executive Summary

Admins need the ability to edit trainee credit token balances directly from the trainee dashboard. This feature enables quick token adjustments for scenarios like refunds, corrections, or special provisions without navigating to HubSpot.

**Key Outcomes:**
- Reduce admin workflow friction by 80% (no HubSpot navigation required)
- Maintain data integrity with HubSpot → Supabase sync
- Provide immediate visual feedback via toast notifications
- Ensure all changes are auditable through HubSpot timeline

---

## 2. Current State Analysis

### Existing Architecture
**File:** `admin_root/admin_frontend/src/components/admin/TraineeInfoCard.jsx`
- Lines 112-160: Token badges display (read-only)
- Current tokens displayed:
  - Mock Discussion (`mock_discussion_token`)
  - Clinical Skills (`cs_credits`)
  - Situational Judgment (`sj_credits`)
  - Mini-mock (`sjmini_credits`)

**API Endpoint:** `admin_root/api/admin/trainees/search.js`
- Already fetches credit properties from Supabase with HubSpot fallback
- Uses Redis → Supabase → HubSpot architecture

### Existing Components to Reuse
1. **Toast System**: `react-hot-toast` (already imported in attendance hooks)
2. **UI Input Components**: `admin_root/admin_frontend/src/components/ui/input.jsx`
3. **Button Components**: `admin_root/admin_frontend/src/components/ui/button.jsx`
4. **Edit Mode Pattern**: Similar to booking cancellation flow

---

## 3. Technical Requirements

### 3.1 Frontend Changes

#### Component: TraineeInfoCard.jsx
**Location:** `admin_root/admin_frontend/src/components/admin/TraineeInfoCard.jsx`

**New State Management:**
```javascript
const [isEditMode, setIsEditMode] = useState(false);
const [editedTokens, setEditedTokens] = useState({
  mock_discussion: trainee.tokens.mock_discussion,
  clinical_skills: trainee.tokens.clinical_skills,
  situational_judgment: trainee.tokens.situational_judgment,
  mini_mock: trainee.tokens.mini_mock,
  shared_mock: trainee.tokens.shared_mock
});
const [isSubmitting, setIsSubmitting] = useState(false);
```

**UI Changes (Lines 112-160):**
1. Add "Edit Tokens" button above token badges section
2. When edit mode enabled:
   - Convert badge values to `<Input type="number">` fields
   - Add "Save Changes" and "Cancel" buttons
   - Show loading spinner during save operation
3. When edit mode disabled:
   - Display as current read-only badges

**Visual Design:**
```jsx
// Edit Mode Toggle Button
<Button
  variant="outline"
  size="sm"
  onClick={() => setIsEditMode(!isEditMode)}
  disabled={isSubmitting}
>
  {isEditMode ? 'Cancel' : 'Edit Tokens'}
</Button>

// Token Badge (Edit Mode)
<div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
    Mock Discussion:
  </label>
  <Input
    type="number"
    min="0"
    value={editedTokens.mock_discussion}
    onChange={(e) => setEditedTokens({
      ...editedTokens,
      mock_discussion: parseInt(e.target.value) || 0
    })}
    className="w-20 h-8 text-sm"
  />
</div>

// Save Button (Edit Mode)
<Button
  onClick={handleSaveTokens}
  disabled={isSubmitting || !hasChanges}
  className="mt-4"
>
  {isSubmitting ? 'Saving...' : 'Save Changes'}
</Button>
```

#### New Custom Hook: useTokenEditMutation
**File:** `admin_root/admin_frontend/src/hooks/useTokenEditMutation.js`

**Purpose:** Handle token update API calls with React Query

**Features:**
- React Query mutation for credit updates
- Optimistic UI updates
- Automatic cache invalidation
- Toast notifications (success/error)
- Rollback on failure

**Implementation Pattern:** (Similar to `useMarkAttendanceMutation.js`)
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { traineeApi } from '../services/adminApi';
import toast from 'react-hot-toast';

export const useTokenEditMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokens) => {
      return traineeApi.updateTokens(contactId, tokens);
    },
    onMutate: async (tokens) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['trainee-search']);

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['trainee-search']);

      // Optimistically update UI
      queryClient.setQueryData(['trainee-search'], (old) => ({
        ...old,
        data: {
          ...old.data,
          contacts: old.data.contacts.map(contact =>
            contact.id === contactId
              ? { ...contact, tokens }
              : contact
          )
        }
      }));

      return { previousData };
    },
    onError: (error, tokens, context) => {
      // Rollback to previous state
      queryClient.setQueryData(['trainee-search'], context.previousData);

      toast.error(
        error.message || 'Failed to update tokens. Please try again.',
        { duration: 4000 }
      );
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['trainee-search']);

      toast.success('Tokens updated successfully!', {
        duration: 3000,
        icon: '✅'
      });
    }
  });
};
```

#### API Service Update
**File:** `admin_root/admin_frontend/src/services/adminApi.js`

**Add new method:**
```javascript
export const traineeApi = {
  search: async (query) => { /* existing */ },
  getBookings: async (contactId) => { /* existing */ },

  // NEW METHOD
  updateTokens: async (contactId, tokens) => {
    const response = await fetch(`/api/admin/trainees/${contactId}/tokens`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ tokens })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update tokens');
    }

    return response.json();
  }
};
```

---

### 3.2 Backend Changes

#### New API Endpoint
**File:** `admin_root/api/admin/trainees/[contactId]/tokens.js` (NEW FILE)

**Route:** `PATCH /api/admin/trainees/:contactId/tokens`

**Architecture:** Write to HubSpot → Immediate sync to Supabase → Invalidate Redis cache

**Request Schema (Joi Validation):**
```javascript
const updateTokensSchema = Joi.object({
  tokens: Joi.object({
    mock_discussion: Joi.number().integer().min(0).required(),
    clinical_skills: Joi.number().integer().min(0).required(),
    situational_judgment: Joi.number().integer().min(0).required(),
    mini_mock: Joi.number().integer().min(0).required(),
    shared_mock: Joi.number().integer().min(0).optional().default(0)
  }).required()
});
```

**Implementation Flow:**
```javascript
const { requirePermission } = require('../../middleware/requirePermission');
const { validationMiddleware } = require('../../../_shared/validation');
const hubspot = require('../../../_shared/hubspot');
const { getCache } = require('../../../_shared/cache');
const { syncContactCreditsToSupabase } = require('../../../_shared/supabaseSync');

module.exports = async (req, res) => {
  try {
    // Step 1: Verify admin authentication and permission
    const user = await requirePermission(req, 'credits.edit');

    // Step 2: Validate request body
    const validator = validationMiddleware('updateTraineeTokens');
    await new Promise((resolve, reject) => {
      validator(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const { contactId } = req.params;
    const { tokens } = req.validatedData;

    // Step 3: Update HubSpot (source of truth)
    console.log(`🔄 [HUBSPOT] Updating tokens for contact ${contactId}`);

    const hubspotProperties = {
      mock_discussion_token: tokens.mock_discussion.toString(),
      cs_credits: tokens.clinical_skills.toString(),
      sj_credits: tokens.situational_judgment.toString(),
      sjmini_credits: tokens.mini_mock.toString(),
      shared_mock_credits: (tokens.shared_mock || 0).toString()
    };

    await hubspot.apiCall('PATCH', `/crm/v3/objects/contacts/${contactId}`, {
      properties: hubspotProperties
    });

    console.log(`✅ [HUBSPOT] Tokens updated successfully`);

    // Step 4: Immediate sync to Supabase (non-blocking, fire-and-forget)
    // Fetch full contact data for sync
    const updatedContact = await hubspot.apiCall('GET',
      `/crm/v3/objects/contacts/${contactId}?properties=student_id,email,firstname,lastname,${Object.keys(hubspotProperties).join(',')},ndecc_exam_date,hs_lastmodifieddate`
    );

    syncContactCreditsToSupabase(updatedContact).catch(err => {
      console.error(`⚠️ [SUPABASE SYNC] Failed to sync contact credits (non-blocking):`, err.message);
    });

    console.log(`🗄️ [SUPABASE] Sync initiated for contact ${contactId}`);

    // Step 5: Invalidate Redis cache
    const cacheService = getCache();
    const cacheKeys = [
      `trainee:search:*${contactId}*`,
      `trainee:credits:${contactId}`,
      `admin:trainees:search:*`
    ];

    for (const pattern of cacheKeys) {
      try {
        await cacheService.del(pattern);
      } catch (cacheError) {
        console.error(`⚠️ [REDIS] Failed to invalidate cache (non-blocking):`, cacheError.message);
      }
    }

    console.log(`💾 [REDIS] Cache invalidated for contact ${contactId}`);

    // Step 6: Return success response
    res.status(200).json({
      success: true,
      message: 'Tokens updated successfully',
      data: {
        contactId,
        tokens: {
          mock_discussion: tokens.mock_discussion,
          clinical_skills: tokens.clinical_skills,
          situational_judgment: tokens.situational_judgment,
          mini_mock: tokens.mini_mock,
          shared_mock: tokens.shared_mock || 0
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        updated_by: user.email
      }
    });

  } catch (error) {
    // Auth errors
    if (error.message.includes('authorization') || error.message.includes('token')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: error.message }
      });
    }

    // Permission errors
    if (error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions to edit tokens' }
      });
    }

    // Validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message }
      });
    }

    console.error('Error updating tokens:', error);

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update tokens',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};
```

#### Validation Schema
**File:** `admin_root/api/_shared/validation.js`

**Add new schema:**
```javascript
const updateTraineeTokensSchema = Joi.object({
  tokens: Joi.object({
    mock_discussion: Joi.number().integer().min(0).max(9999).required()
      .messages({
        'number.min': 'Mock Discussion tokens must be at least 0',
        'number.max': 'Mock Discussion tokens cannot exceed 9999'
      }),
    clinical_skills: Joi.number().integer().min(0).max(9999).required()
      .messages({
        'number.min': 'Clinical Skills tokens must be at least 0',
        'number.max': 'Clinical Skills tokens cannot exceed 9999'
      }),
    situational_judgment: Joi.number().integer().min(0).max(9999).required()
      .messages({
        'number.min': 'Situational Judgment tokens must be at least 0',
        'number.max': 'Situational Judgment tokens cannot exceed 9999'
      }),
    mini_mock: Joi.number().integer().min(0).max(9999).required()
      .messages({
        'number.min': 'Mini-mock tokens must be at least 0',
        'number.max': 'Mini-mock tokens cannot exceed 9999'
      }),
    shared_mock: Joi.number().integer().min(0).max(9999).optional().default(0)
      .messages({
        'number.min': 'Shared Mock tokens must be at least 0',
        'number.max': 'Shared Mock tokens cannot exceed 9999'
      })
  }).required()
});

// Register in schemas object
schemas.updateTraineeTokens = updateTraineeTokensSchema;
```

---

### 3.3 Permission Requirements

**New Permission:** `credits.edit`

**Location:** `admin_root/api/admin/middleware/requirePermission.js`

**Add to permission definitions:**
```javascript
const PERMISSIONS = {
  'exams.view': 'View mock exams',
  'exams.edit': 'Edit mock exams',
  'exams.delete': 'Delete mock exams',
  'bookings.view': 'View bookings',
  'bookings.edit': 'Edit bookings',
  'credits.edit': 'Edit trainee credit tokens', // NEW
  // ... other permissions
};
```

---

## 4. Data Flow Architecture

### Write Operation Flow
```
User Edits Token → Frontend Validation → API Request
                                              ↓
                                    [Authentication Check]
                                              ↓
                                    [Permission Check: credits.edit]
                                              ↓
                                    [Joi Schema Validation]
                                              ↓
                          ┌─────────────────────────────────┐
                          │  HubSpot (Source of Truth)      │
                          │  PATCH /contacts/:id            │
                          │  Update credit properties       │
                          └─────────────────────────────────┘
                                              ↓
                          ┌─────────────────────────────────┐
                          │  Supabase Sync (Fire-and-Forget)│
                          │  Update hubspot_contact_credits │
                          │  Non-blocking operation         │
                          └─────────────────────────────────┘
                                              ↓
                          ┌─────────────────────────────────┐
                          │  Redis Cache Invalidation       │
                          │  Clear trainee search cache     │
                          │  Clear credit cache             │
                          └─────────────────────────────────┘
                                              ↓
                          ┌─────────────────────────────────┐
                          │  Frontend Response              │
                          │  - Optimistic UI update         │
                          │  - Toast notification           │
                          │  - Cache invalidation           │
                          └─────────────────────────────────┘
```

### Read Operation Flow (Unchanged)
```
Frontend Request → Redis Cache → Supabase → HubSpot Fallback
```

---

## 5. Security Considerations

### Input Validation
1. ✅ **Server-Side Validation**: Joi schema with min/max constraints
2. ✅ **Client-Side Validation**: HTML5 number input with `min="0"` attribute
3. ✅ **Type Safety**: Explicitly parse to integer with fallback to 0
4. ✅ **Injection Prevention**: No raw SQL or unsanitized HubSpot API calls

### Authentication & Authorization
1. ✅ **JWT Token Required**: All requests must include valid admin token
2. ✅ **Permission Check**: `credits.edit` permission required
3. ✅ **Audit Trail**: Log admin email in response metadata

### Rate Limiting
1. ✅ **Existing Middleware**: HubSpot API rate limiting already in place
2. ✅ **Client-Side Debounce**: Disable save button during submission

---

## 6. Error Handling

### Frontend Error States
| Error Type | UI Behavior | Toast Message |
|------------|-------------|---------------|
| Network Error | Rollback optimistic update | "Failed to update tokens. Please check your connection." |
| Validation Error | Show field-specific error | "Invalid token value. Must be between 0 and 9999." |
| Permission Error | Disable edit mode | "You don't have permission to edit tokens." |
| Server Error | Rollback optimistic update | "Server error. Please try again later." |

### Backend Error Responses
```javascript
// 400 - Validation Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mock Discussion tokens must be at least 0"
  }
}

// 401 - Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

// 403 - Forbidden
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to edit tokens"
  }
}

// 500 - Server Error
{
  "success": false,
  "error": {
    "code": "SERVER_ERROR",
    "message": "Failed to update tokens"
  }
}
```

---

## 7. Testing Requirements

### Unit Tests
**File:** `tests/unit/trainee-tokens.test.js`

**Coverage:**
1. Joi validation schema (valid/invalid inputs)
2. Token transformation logic (display names ↔ API property names)
3. Permission checks (authorized/unauthorized users)

### Integration Tests
**File:** `tests/integration/trainee-token-edit.test.js`

**Coverage:**
1. Complete edit flow (HubSpot → Supabase → Redis)
2. Concurrent edit detection
3. Rollback on HubSpot failure
4. Cache invalidation verification

### Manual Testing Checklist
- [ ] Edit mode toggle works
- [ ] Input fields accept valid values (0-9999)
- [ ] Input fields reject negative values
- [ ] Save button disabled when no changes
- [ ] Save button shows loading state
- [ ] Success toast displays on successful save
- [ ] Error toast displays on failure
- [ ] Optimistic update visible immediately
- [ ] Data persists after page refresh
- [ ] HubSpot contact properties updated
- [ ] Supabase `hubspot_contact_credits` table synced
- [ ] Redis cache cleared

---

## 8. Performance Considerations

### Frontend Optimizations
1. **Optimistic Updates**: UI reflects changes immediately
2. **Debouncing**: Prevent rapid API calls during input
3. **Conditional Rendering**: Only render edit UI when needed

### Backend Optimizations
1. **Fire-and-Forget Sync**: Supabase sync doesn't block response
2. **Batch Cache Invalidation**: Clear multiple cache keys efficiently
3. **Minimal HubSpot Properties**: Only fetch/update required fields

### Expected Performance
- **Frontend Response Time**: < 100ms (optimistic update)
- **API Response Time**: 200-500ms (HubSpot write)
- **Total User Experience**: < 1s including toast notification

---

## 9. Rollout Plan

### Phase 1: Development (4 hours)
1. ✅ Backend endpoint implementation
2. ✅ Frontend component updates
3. ✅ Custom hook creation
4. ✅ Validation schemas

### Phase 2: Testing (1 hour)
1. ✅ Unit tests
2. ✅ Integration tests
3. ✅ Manual QA testing

### Phase 3: Deployment (1 hour)
1. ✅ Deploy to staging
2. ✅ Verify HubSpot sync
3. ✅ Verify Supabase sync
4. ✅ Deploy to production

---

## 10. Success Metrics

### Quantitative Metrics
- **Admin Workflow Time**: Reduce by 80% (from 2 min in HubSpot to 20 sec)
- **Error Rate**: < 1% failed token updates
- **API Response Time**: < 500ms for 95th percentile

### Qualitative Metrics
- ✅ Admins can edit tokens without leaving trainee dashboard
- ✅ Toast notifications provide clear feedback
- ✅ Data integrity maintained across HubSpot and Supabase
- ✅ All changes auditable through HubSpot timeline

---

## 11. Future Enhancements

### Phase 2 Considerations (Not in Current Scope)
1. **Bulk Token Editing**: Edit multiple trainees at once
2. **Token History View**: Show token balance changes over time
3. **Approval Workflow**: Require supervisor approval for large changes
4. **Reason for Change**: Optional notes field explaining token adjustment

---

## 12. Files to Create/Modify

### New Files
1. `admin_root/api/admin/trainees/[contactId]/tokens.js` - PATCH endpoint
2. `admin_root/admin_frontend/src/hooks/useTokenEditMutation.js` - React Query hook

### Modified Files
1. `admin_root/admin_frontend/src/components/admin/TraineeInfoCard.jsx` - Add edit mode UI
2. `admin_root/admin_frontend/src/services/adminApi.js` - Add updateTokens method
3. `admin_root/api/_shared/validation.js` - Add validation schema
4. `admin_root/api/admin/middleware/requirePermission.js` - Add credits.edit permission

### Test Files
1. `tests/unit/trainee-tokens.test.js`
2. `tests/integration/trainee-token-edit.test.js`

---

## 13. Confidence Score: 9/10

**Rationale:**
- ✅ Clear requirements and user stories
- ✅ Existing architecture (HubSpot → Supabase → Redis) well-defined
- ✅ Similar patterns already implemented (attendance editing, booking cancellation)
- ✅ All dependencies identified and available
- ✅ Security and validation requirements specified
- ✅ Error handling comprehensive
- ⚠️ Minor risk: Concurrent edit scenario needs careful handling

**Risk Mitigation:**
- Use optimistic locking or last-write-wins pattern
- Clear error messages if HubSpot API fails
- Comprehensive integration tests for edge cases

---

## 14. Developer Agent Assignments

### react-frontend-architect
**Responsibilities:**
- Modify `TraineeInfoCard.jsx` component
- Create `useTokenEditMutation.js` hook
- Update `adminApi.js` service
- Implement toast notifications
- Handle optimistic UI updates

**Files:**
- `admin_root/admin_frontend/src/components/admin/TraineeInfoCard.jsx`
- `admin_root/admin_frontend/src/hooks/useTokenEditMutation.js`
- `admin_root/admin_frontend/src/services/adminApi.js`

### express-backend-architect
**Responsibilities:**
- Create PATCH endpoint for token updates
- Implement HubSpot API calls
- Handle Supabase sync coordination
- Manage Redis cache invalidation

**Files:**
- `admin_root/api/admin/trainees/[contactId]/tokens.js`
- `admin_root/api/_shared/validation.js`

### hubspot-crm-specialist
**Responsibilities:**
- Verify HubSpot property mapping
- Ensure credit property updates work correctly
- Test HubSpot API error scenarios

**Files:**
- `admin_root/api/admin/trainees/[contactId]/tokens.js`

### security-compliance-auditor
**Responsibilities:**
- Review permission implementation
- Validate Joi schema security
- Ensure no injection vulnerabilities
- Verify audit trail completeness

**Files:**
- `admin_root/api/_shared/validation.js`
- `admin_root/api/admin/middleware/requirePermission.js`
- `admin_root/api/admin/trainees/[contactId]/tokens.js`

### test-validation-specialist
**Responsibilities:**
- Write unit tests for validation
- Write integration tests for full flow
- Create manual QA checklist
- Verify test coverage > 70%

**Files:**
- `tests/unit/trainee-tokens.test.js`
- `tests/integration/trainee-token-edit.test.js`

---

## 15. API Specification

### Request
```http
PATCH /api/admin/trainees/41459711858/tokens
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "tokens": {
    "mock_discussion": 5,
    "clinical_skills": 3,
    "situational_judgment": 2,
    "mini_mock": 1,
    "shared_mock": 0
  }
}
```

### Response (Success)
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Tokens updated successfully",
  "data": {
    "contactId": "41459711858",
    "tokens": {
      "mock_discussion": 5,
      "clinical_skills": 3,
      "situational_judgment": 2,
      "mini_mock": 1,
      "shared_mock": 0
    }
  },
  "meta": {
    "timestamp": "2025-01-26T10:30:00.000Z",
    "updated_by": "admin@prepdoctors.com"
  }
}
```

### Response (Error)
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mock Discussion tokens must be at least 0"
  }
}
```

---

**END OF PRD**

*This PRD follows the PrepDoctors HubSpot Automation Framework and ensures 9/10 confidence score for one-pass implementation.*
