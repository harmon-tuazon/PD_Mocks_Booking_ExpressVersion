# PRD: Scheduled Mock Exam Activation

**Status**: Draft
**Created**: 2025-01-13
**Author**: System
**Target Completion**: 2 days (12-16 hours)

---

## Executive Summary

Enable admins to schedule when mock exam sessions become active instead of requiring immediate activation. This allows admins to prepare sessions in advance and have them automatically activate at a specified date/time, reducing manual work and ensuring timely availability for students.

---

## Problem Statement

**Current Limitation:**
- Mock exam sessions have a binary `is_active` field (true/false)
- When creating a session, it's immediately active or inactive
- Admins must manually activate sessions at the right time
- No automation for making sessions available at specific dates/times

**Impact:**
- Manual overhead for admins who want to schedule sessions in advance
- Risk of forgetting to activate sessions on time
- Cannot prepare batches of sessions weeks in advance
- No "go-live" automation for exam availability

**User Story:**
> "As an admin, I want to create mock exam sessions 2 weeks in advance and schedule them to automatically become active 7 days before the exam date, so students can book exactly when registration opens without me having to manually activate dozens of sessions."

---

## Goals & Success Metrics

### Goals
1. Allow admins to choose between immediate or scheduled activation
2. Automatically activate sessions at scheduled date/time
3. Provide visibility into pending scheduled activations
4. Maintain system reliability with automated background jobs

### Success Metrics
- ✅ 100% of scheduled activations execute within 12 hours of scheduled time
- ✅ Zero manual activations required for pre-scheduled sessions
- ✅ 90% reduction in admin time spent on session activation
- ✅ Clear audit trail of scheduled vs manual activations

### Non-Goals (Out of Scope)
- ❌ Scheduled deactivation (only activation is automated)
- ❌ Recurring schedules (e.g., "activate every Monday")
- ❌ Email notifications to admins when activation occurs
- ❌ Time zone selection (all times in UTC, displayed in Toronto timezone)

---

## Solution Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin Creates Session with Schedule                      │
│    - Choose "Schedule Activation"                            │
│    - Select date/time for activation                         │
│    - Session created with is_active=false                    │
│    - scheduled_activation_datetime stored in HubSpot         │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Vercel Cron Job (Every 15 Minutes)                       │
│    - Runs: /api/admin/cron/activate-scheduled-exams         │
│    - Queries HubSpot for overdue scheduled sessions          │
│    - Filters: is_active=false AND scheduled_datetime <= now │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Batch Activation                                          │
│    - Updates is_active=true for all overdue sessions         │
│    - Uses HubSpot batch API (100 per request)                │
│    - Clears all relevant caches                              │
│    - Logs activation summary                                 │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Dashboard Updates                                         │
│    - Scheduled sessions now appear as "Active"               │
│    - Students can now book these sessions                    │
│    - Admin sees automatic activation in audit logs           │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Specification

### Phase 1: HubSpot Schema Changes

#### New Property: `scheduled_activation_datetime`
```javascript
{
  name: 'scheduled_activation_datetime',
  label: 'Scheduled Activation Date/Time',
  type: 'datetime',
  fieldType: 'datetime',
  groupName: 'mock_exam_information',
  description: 'When this session should automatically become active (UTC)',
  hasUniqueValue: false,
  hidden: false,
  formField: true
}
```

**Property Behavior:**
- `null` or empty: Session uses immediate activation (current behavior)
- Valid datetime: Session scheduled for automatic activation
- Always stored in UTC
- Frontend displays in America/Toronto timezone

---

### Phase 2: Backend - Cron Job Endpoint

#### File: `admin_root/api/admin/cron/activate-scheduled-exams.js`

**Endpoint:** `GET /api/admin/cron/activate-scheduled-exams`

**Authentication:**
```javascript
// Verify CRON_SECRET from Vercel
const authHeader = req.headers.authorization;
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Logic Flow:**
```javascript
1. Query HubSpot for sessions where:
   - is_active = "false"
   - scheduled_activation_datetime <= now()
   - scheduled_activation_datetime IS NOT NULL

2. If sessions found:
   - Batch update is_active = true (100 per batch)
   - Optionally set scheduled_activation_datetime = null (cleanup)

3. Invalidate caches:
   - admin:mock-exams:list:*
   - admin:mock-exams:aggregates:*
   - admin:metrics:*

4. Return summary:
   {
     success: true,
     activated: 15,
     failed: 0,
     timestamp: "2025-01-13T14:00:00Z",
     executionTime: 2341
   }
```

**Error Handling:**
- Partial failures: Continue processing remaining sessions
- HubSpot rate limits: Use exponential backoff
- Timeout protection: Log warning at 55 seconds
- Return detailed error summary for failed activations

**Idempotency:**
- Safe to run multiple times
- Already-active sessions are ignored
- No duplicate activations possible

---

### Phase 3: Vercel Configuration

#### File: `admin_root/vercel.json`

```json
{
  "crons": [{
    "path": "/api/admin/cron/activate-scheduled-exams",
    "schedule": "0 5,17 * * *"
  }]
}
```

**Schedule Rationale:**
- `0 5,17 * * *` = Twice daily at 5:00 AM UTC and 5:00 PM UTC
  - **5:00 AM UTC** = 12:00 AM EST / 1:00 AM EDT (midnight Toronto time)
  - **5:00 PM UTC** = 12:00 PM EST / 1:00 PM EDT (noon Toronto time)
- Maximum 12-hour delay for scheduled activations
- Covers both morning and afternoon activation needs
- Twice-daily execution balances timely activation with API efficiency
- Reduces API usage while supporting same-day noon activations

**Environment Variable:**
- Add `CRON_SECRET` in Vercel dashboard
- Generate secure random token (e.g., 32-character hex)
- Target: Production only

---

### Phase 4: Frontend - Creation Form

#### File: `admin_root/admin_frontend/src/pages/MockExams.jsx`

**Form State Update:**
```javascript
const [formData, setFormData] = useState({
  mock_type: 'Situational Judgment',
  exam_date: '',
  capacity: 15,
  location: 'Mississauga',
  is_active: true,
  activation_mode: 'immediate',  // NEW: 'immediate' | 'scheduled'
  scheduled_activation_datetime: null  // NEW: ISO datetime string
});
```

**UI Components:**

**1. Activation Mode Toggle**
```jsx
<div className="form-group">
  <label>Activation</label>

  <div className="radio-group">
    <label>
      <input
        type="radio"
        value="immediate"
        checked={formData.activation_mode === 'immediate'}
        onChange={(e) => setFormData({
          ...formData,
          activation_mode: 'immediate',
          is_active: true,
          scheduled_activation_datetime: null
        })}
      />
      Activate Immediately
      <span className="help-text">Session becomes active as soon as it's created</span>
    </label>

    <label>
      <input
        type="radio"
        value="scheduled"
        checked={formData.activation_mode === 'scheduled'}
        onChange={(e) => setFormData({
          ...formData,
          activation_mode: 'scheduled',
          is_active: false
        })}
      />
      Schedule Activation
      <span className="help-text">Session activates automatically at scheduled time</span>
    </label>
  </div>
</div>
```

**2. DateTime Picker (Conditional)**
```jsx
{formData.activation_mode === 'scheduled' && (
  <div className="form-group">
    <label htmlFor="scheduled_activation_datetime">
      Activation Date & Time
      <span className="required">*</span>
    </label>

    <input
      type="datetime-local"
      id="scheduled_activation_datetime"
      value={formData.scheduled_activation_datetime || ''}
      min={new Date().toISOString().slice(0, 16)}  // Prevent past dates
      onChange={(e) => setFormData({
        ...formData,
        scheduled_activation_datetime: e.target.value
      })}
      className="form-control"
    />

    <span className="help-text">
      Time zone: America/Toronto (EST/EDT)
    </span>
  </div>
)}
```

---

### Phase 5: Frontend - Dashboard Indicators

#### Status Badge Component
```jsx
// Show activation status on session cards
{!session.is_active && session.scheduled_activation_datetime && (
  <div className="badge badge-scheduled">
    <ClockIcon className="h-4 w-4" />
    Scheduled: {formatDateTime(session.scheduled_activation_datetime)}
  </div>
)}

{!session.is_active && !session.scheduled_activation_datetime && (
  <div className="badge badge-inactive">
    <XCircleIcon className="h-4 w-4" />
    Inactive
  </div>
)}
```

#### Filter Enhancement
```javascript
// Add "Scheduled" filter option
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' }  // NEW
];

// Backend filtering logic
if (status === 'scheduled') {
  filters.push({
    propertyName: 'is_active',
    operator: 'EQ',
    value: 'false'
  });
  filters.push({
    propertyName: 'scheduled_activation_datetime',
    operator: 'HAS_PROPERTY'
  });
}
```

---

### Phase 6: Validation Updates

#### File: `admin_root/api/_shared/validation.js`

```javascript
mockExamCreation: Joi.object({
  mock_type: Joi.string()
    .valid('Situational Judgment', 'Clinical Skills', 'Mini-mock', 'Mock Discussion')
    .required(),
  exam_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  capacity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .required(),
  location: Joi.string()
    .valid('Mississauga', 'Mississauga - B9', /* ... */)
    .required(),
  start_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required(),
  end_time: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .required(),

  // NEW: Activation mode and scheduling
  activation_mode: Joi.string()
    .valid('immediate', 'scheduled')
    .optional()
    .default('immediate'),

  is_active: Joi.boolean()
    .optional()
    .default(true),

  scheduled_activation_datetime: Joi.date()
    .iso()
    .min('now')  // Must be in future
    .when('activation_mode', {
      is: 'scheduled',
      then: Joi.required()
        .messages({
          'any.required': 'Scheduled activation date/time is required when using scheduled activation mode',
          'date.min': 'Scheduled activation must be in the future'
        }),
      otherwise: Joi.optional().allow(null)
    })
    .messages({
      'date.iso': 'Invalid datetime format',
      'date.min': 'Scheduled activation date must be in the future'
    })
}).required();
```

**Validation Rules:**
- ✅ `scheduled_activation_datetime` required when `activation_mode = 'scheduled'`
- ✅ Must be valid ISO datetime
- ✅ Must be in the future (min: 'now')
- ✅ Optional/null when `activation_mode = 'immediate'`
- ✅ Automatically sets `is_active = false` when scheduling

---

## Data Flow Diagrams

### Create Session Flow

```
Admin Form
    ↓
[Select "Schedule Activation"]
    ↓
[Pick datetime: 2025-01-20 09:00:00 EST]
    ↓
Frontend converts to UTC: 2025-01-20T14:00:00Z
    ↓
POST /api/admin/mock-exams/create
{
  mock_type: "Situational Judgment",
  exam_date: "2025-01-20",
  start_time: "09:00",
  end_time: "12:00",
  capacity: 20,
  location: "Mississauga",
  activation_mode: "scheduled",
  is_active: false,
  scheduled_activation_datetime: "2025-01-20T14:00:00Z"
}
    ↓
Backend validates
    ↓
Creates HubSpot object with properties:
- is_active: false
- scheduled_activation_datetime: 1737385200000 (Unix timestamp)
    ↓
Response: Session created successfully
    ↓
Dashboard shows: "Scheduled: Jan 20, 2025 9:00 AM"
```

### Cron Activation Flow

```
Time: 2025-01-20 14:00:00 UTC
    ↓
Vercel triggers cron job
    ↓
GET /api/admin/cron/activate-scheduled-exams
Authorization: Bearer {CRON_SECRET}
    ↓
Query HubSpot:
  filterGroups: [{
    filters: [
      { propertyName: "is_active", operator: "EQ", value: "false" },
      { propertyName: "scheduled_activation_datetime", operator: "LTE", value: "1737385200000" },
      { propertyName: "scheduled_activation_datetime", operator: "HAS_PROPERTY" }
    ]
  }]
    ↓
Found 5 sessions to activate
    ↓
Batch update (HubSpot batch API):
  inputs: [
    { id: "123", properties: { is_active: true } },
    { id: "124", properties: { is_active: true } },
    { id: "125", properties: { is_active: true } },
    { id: "126", properties: { is_active: true } },
    { id: "127", properties: { is_active: true } }
  ]
    ↓
Clear caches:
- admin:mock-exams:list:*
- admin:mock-exams:aggregates:*
- admin:metrics:*
    ↓
Log result:
✅ [CRON] Activated 5 sessions at 2025-01-20T14:00:32Z
    ↓
Return response:
{
  success: true,
  activated: 5,
  failed: 0,
  timestamp: "2025-01-20T14:00:32Z",
  executionTime: 2145
}
```

---

## User Flows

### Flow 1: Create Scheduled Session

1. Admin navigates to **Create Mock Exam**
2. Fills in session details (type, date, time, location, capacity)
3. Under "Activation", selects **"Schedule Activation"** radio button
4. DateTime picker appears
5. Selects date/time: **"Jan 20, 2025 9:00 AM"**
6. Frontend shows timezone: **"America/Toronto (EST/EDT)"**
7. Clicks **"Create Session"**
8. System validates: datetime is in future ✓
9. Session created with `is_active: false`
10. Dashboard shows badge: **"Scheduled: Jan 20, 2025 9:00 AM"** with clock icon
11. Session appears in "Scheduled" filter

### Flow 2: Automatic Activation

1. Cron runs at **9:00 AM Toronto time** (2:00 PM UTC in winter)
2. Detects session with `scheduled_activation_datetime <= now()`
3. Updates `is_active: true` in HubSpot
4. Clears dashboard caches
5. Admin refreshes dashboard
6. Session now shows **green "Active" badge**
7. Students can now see and book the session

### Flow 3: Manual Override (Quick Activate)

1. Admin sees scheduled session on dashboard
2. Clicks **"Activate Now"** button
3. Confirmation modal: *"This session is scheduled to activate on Jan 20. Activate now instead?"*
4. Admin confirms
5. System updates `is_active: true` immediately
6. `scheduled_activation_datetime` cleared (optional)
7. Session immediately available to students

---

## Error Scenarios & Handling

### Scenario 1: Cron Job Fails
**Problem:** HubSpot API returns 500 error
**Handling:**
- Log error details
- Return 500 response
- Cron will retry on next scheduled run (up to 12 hours later)
- Sessions eventually activate (self-healing)

### Scenario 2: Partial Batch Failure
**Problem:** 5 sessions to activate, 3 succeed, 2 fail
**Handling:**
- Process each batch independently
- Log successful activations: `✅ Activated 3 sessions`
- Log failures: `❌ Failed to activate 2 sessions: [ids]`
- Return partial success response
- Failed sessions retry on next cron run

### Scenario 3: Timezone Confusion
**Problem:** Admin selects wrong time due to timezone confusion
**Prevention:**
- Always show timezone label: "America/Toronto (EST/EDT)"
- Frontend converts local time to UTC before sending
- Backend stores UTC, displays Toronto time
- Help text: "Session will activate at this time in Toronto timezone"

### Scenario 4: Past Date Selected
**Problem:** Admin accidentally selects date in past
**Prevention:**
- Frontend: `min={new Date().toISOString()}` on datetime input
- Backend: Joi validation `.min('now')`
- Clear error message: "Scheduled activation date must be in the future"

---

## Testing Strategy

### Unit Tests
- ✅ Validation: Future date required, past date rejected
- ✅ Timezone conversion: Toronto → UTC → Toronto
- ✅ Cron authentication: Valid/invalid CRON_SECRET
- ✅ Query logic: Correct HubSpot filters
- ✅ Batch processing: 100-item chunks

### Integration Tests
- ✅ End-to-end: Create scheduled session → Wait → Verify activation
- ✅ HubSpot API: Create property, query, update
- ✅ Cache invalidation: Verify all patterns cleared
- ✅ Cron execution: Mock Vercel cron request

### Manual Testing
1. Create session scheduled for 5 minutes from now
2. Wait for cron execution
3. Verify session activated
4. Check dashboard shows "Active"
5. Verify students can book

---

## Rollout Plan

### Phase 1: Infrastructure (Day 1)
- [ ] Add `scheduled_activation_datetime` property to HubSpot
- [ ] Create cron endpoint with authentication
- [ ] Add `CRON_SECRET` environment variable
- [ ] Update `vercel.json` with cron configuration
- [ ] Deploy to production
- [ ] Verify cron executes every 15 minutes

### Phase 2: Backend Logic (Day 1)
- [ ] Implement HubSpot query logic
- [ ] Implement batch activation logic
- [ ] Add cache invalidation
- [ ] Add comprehensive logging
- [ ] Test with manual API calls

### Phase 3: Frontend Form (Day 2)
- [ ] Add activation mode toggle
- [ ] Add datetime picker (conditional)
- [ ] Add timezone help text
- [ ] Update validation
- [ ] Test form submission

### Phase 4: Dashboard Updates (Day 2)
- [ ] Add "Scheduled" badge component
- [ ] Add "Scheduled" filter option
- [ ] Add countdown/time display
- [ ] Update status indicators
- [ ] Test filtering

### Phase 5: Testing & Launch (Day 2)
- [ ] Run all automated tests
- [ ] Manual end-to-end testing
- [ ] Create test sessions for various future times
- [ ] Monitor first 24 hours of cron executions
- [ ] Document any issues/improvements

---

## Monitoring & Observability

### Metrics to Track
- **Activation Success Rate**: % of scheduled sessions activated on time
- **Activation Lag**: Average time difference between scheduled vs actual activation
- **Cron Execution Time**: Track performance, ensure under 60s
- **Failure Rate**: % of failed activations per cron run

### Logging
```javascript
// Every cron execution
console.log(`[CRON-ACTIVATE] Starting check at ${timestamp}`);
console.log(`[CRON-ACTIVATE] Found ${count} sessions to activate`);
console.log(`[CRON-ACTIVATE] Successfully activated ${success} sessions`);
console.log(`[CRON-ACTIVATE] Failed ${failed} sessions`);
console.log(`[CRON-ACTIVATE] Completed in ${executionTime}ms`);
```

### Alerts (Future Enhancement)
- Email admin if cron fails 3 times in a row
- Slack notification for bulk activation (>50 sessions)
- Warning if execution time > 45 seconds

---

## Edge Cases

### Case 1: Session Already Active
**Scenario:** Cron tries to activate session that's already active (manual override happened)
**Handling:** Query filters `is_active = false`, so already-active sessions ignored

### Case 2: Two Crons Run Simultaneously
**Scenario:** Vercel runs cron twice due to infrastructure issue
**Handling:** Idempotent operation, safe to run multiple times, no duplicate activations

### Case 3: DateTime Exactly at Cron Execution
**Scenario:** Session scheduled for 9:00:00, cron runs at 9:00:00
**Handling:** Query uses `<=` operator, session activated (not missed)

### Case 4: Bulk Scheduling (100+ Sessions)
**Scenario:** Admin schedules 200 sessions for same time
**Handling:** Cron processes in batches of 100, all activate within single execution

### Case 5: Scheduled Time in Past (Edge)
**Scenario:** Session created with validation bypass, scheduled time already passed
**Handling:** Next cron run detects and activates immediately (self-correcting)

---

## Dependencies

### HubSpot
- Custom object: `mock_exams` (2-50158913) ✓ Exists
- New property: `scheduled_activation_datetime` ❌ To be created
- Batch API: Update endpoint ✓ Available
- Search API: Filter by datetime ✓ Supported

### Vercel
- Cron jobs feature ✓ Available
- Environment variables ✓ Available
- Serverless function timeout (60s default) ✓ Sufficient

### Frontend
- `<input type="datetime-local">` ✓ Supported (all modern browsers)
- React state management ✓ Exists
- Timezone handling ✓ Utilities exist

---

## Security Considerations

1. **CRON_SECRET Validation**
   - Every cron endpoint MUST verify secret
   - Return 401 for invalid/missing secret
   - Use strong random token (32+ chars)

2. **Authorization**
   - Cron endpoint accessible only via Vercel scheduler
   - No public access to cron endpoint
   - Admin UI requires authentication

3. **Input Validation**
   - Prevent SQL injection via Joi validation
   - Prevent XSS in datetime display
   - Validate timezone conversions

4. **Rate Limiting**
   - Respect HubSpot API limits
   - Batch operations to minimize calls
   - Exponential backoff on failures

---

## Future Enhancements (V2)

1. **Scheduled Deactivation**
   - Add `scheduled_deactivation_datetime`
   - Auto-deactivate past exams

2. **Email Notifications**
   - Notify admin when sessions activate
   - Weekly summary of upcoming activations

3. **Recurring Schedules**
   - "Activate every Monday at 9 AM"
   - Template-based scheduling

4. **Bulk Scheduling UI**
   - Select multiple sessions
   - Apply same schedule to all

5. **Manual Activation History**
   - Track who activated manually
   - Distinguish auto vs manual activation

---

## Appendix

### Cron Expression Reference
```
*/15 * * * *    Every 15 minutes
*/5 * * * *     Every 5 minutes
0 */6 * * *     Every 6 hours
0 9 * * *       Daily at 9:00 AM UTC
0 9 * * 1       Every Monday at 9:00 AM UTC
```

### Timezone Conversion Table (Toronto)
| Toronto Time | UTC (Winter/EST) | UTC (Summer/EDT) |
|--------------|------------------|------------------|
| 9:00 AM      | 2:00 PM          | 1:00 PM          |
| 12:00 PM     | 5:00 PM          | 4:00 PM          |
| 5:00 PM      | 10:00 PM         | 9:00 PM          |

### HubSpot Property Type: DateTime
- Stored as Unix timestamp (milliseconds)
- API accepts ISO string or timestamp
- Queryable with comparison operators (GT, LT, EQ)
- Supports `HAS_PROPERTY` and `NOT_HAS_PROPERTY`

---

## Sign-off

- [ ] Technical Review: Backend Lead
- [ ] UX Review: Product Designer
- [ ] Security Review: Security Team
- [ ] Stakeholder Approval: Admin Team Lead

**Estimated Effort**: 12-16 hours over 2 days
**Risk Level**: Low (non-breaking change, additive feature)
**Priority**: Medium (improves admin efficiency, not critical)
