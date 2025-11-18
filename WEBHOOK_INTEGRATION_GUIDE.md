# HubSpot Webhook Integration Guide

## Overview

Replace the current background sync (`process.nextTick`) with HubSpot webhook triggers for real-time property updates.

---

## ✅ Benefits

**Current Approach (Direct API Update):**
```javascript
// Background sync using HubSpot API
process.nextTick(async () => {
  await hubspot.updateMockExamBookings(mock_exam_id, newCount);
});
```
- ❌ Fails silently on network errors
- ❌ Requires reconciliation cron to fix drift
- ❌ Counts against API rate limits

**New Approach (Webhook Trigger):**
```javascript
// Trigger HubSpot workflow via webhook
process.nextTick(async () => {
  await HubSpotWebhookService.syncTotalBookings(mock_exam_id, newCount);
});
```
- ✅ HubSpot workflows handle retries automatically
- ✅ Asynchronous processing (doesn't count against API limits)
- ✅ More reliable delivery
- ✅ Can trigger multiple actions in workflow

---

## 🔧 Integration Steps

### 1. Update Booking Creation

**File:** `user_root/api/bookings/create.js`

**Replace this section (lines 554-571):**
```javascript
// OLD: Direct API update
const newTotalBookings = await redis.incr(`exam:${mock_exam_id}:bookings`);

process.nextTick(async () => {
  try {
    const hubspotService = new HubSpotService();
    await hubspotService.updateMockExamBookings(mock_exam_id, newTotalBookings);
    console.log(`✅ Background sync: HubSpot counter updated`);
  } catch (error) {
    console.error(`❌ Background counter sync failed:`, error.message);
  }
});
```

**With this:**
```javascript
// NEW: Webhook trigger
const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

const newTotalBookings = await redis.incr(`exam:${mock_exam_id}:bookings`);

// Trigger HubSpot workflow via webhook (non-blocking, async)
process.nextTick(async () => {
  const result = await HubSpotWebhookService.syncTotalBookings(
    mock_exam_id,
    newTotalBookings
  );

  if (result.success) {
    console.log(`✅ [WEBHOOK] HubSpot workflow triggered: ${result.message}`);
  } else {
    console.error(`❌ [WEBHOOK] Failed to trigger workflow: ${result.message}`);
    // Reconciliation cron will fix this within 1 hour
  }
});
```

---

### 2. Update Cancellation Endpoints

**Files to update:**
- `user_root/api/bookings/[id].js`
- `admin_root/api/bookings/batch-cancel.js`
- `admin_root/api/admin/mock-exams/[id]/cancel-bookings.js`

**Pattern:**
```javascript
const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');

// After decrementing Redis counter:
if (mockExamId) {
  const newCount = await redis.decr(`exam:${mockExamId}:bookings`);

  // Trigger webhook sync (non-blocking)
  process.nextTick(async () => {
    await HubSpotWebhookService.syncTotalBookings(mockExamId, newCount);
  });
}
```

---

### 3. Update Reconciliation Cron

**File:** `user_root/api/cron/reconcile-counters.js`

**After fixing drift, trigger webhook (lines 142-144):**
```javascript
// Reconcile: Update BOTH Redis and HubSpot
const TTL_90_DAYS = 90 * 24 * 60 * 60;
await redis.setex(key, TTL_90_DAYS, actualCount);

// NEW: Trigger webhook to sync HubSpot property
const { HubSpotWebhookService } = require('../_shared/hubspot-webhook');
await HubSpotWebhookService.syncTotalBookings(examId, actualCount);

// OLD: Direct API update (remove this)
// await hubspot.apiCall('PATCH', `/crm/v3/objects/2-50158913/${examId}`, {
//   properties: { total_bookings: actualCount.toString() }
// });
```

---

## 🔄 HubSpot Workflow Configuration

### Required Workflow Setup in HubSpot:

**1. Create Workflow:**
- Name: "Sync Mock Exam Booking Count"
- Type: API-triggered workflow
- Webhook ID: AIvBwN0

**2. Configure Trigger:**
- Webhook URL: `https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/AIvBwN0`
- Expected payload:
  ```json
  {
    "mock_exam_id": "40577087837",
    "total_bookings": 8
  }
  ```

**3. Add Workflow Actions:**

**Action 1: Set Variables**
- Extract `mock_exam_id` from webhook → Variable: `examId`
- Extract `total_bookings` from webhook → Variable: `bookingCount`

**Action 2: Update CRM Record**
- Object type: Mock Exams (2-50158913)
- Record ID: Use variable `{{examId}}`
- Update property: `total_bookings` = `{{bookingCount}}`

**4. Workflow Settings:**
- Re-enrollment: Allow (updates can happen multiple times)
- Error handling: Continue on errors (don't break workflow)
- Logging: Enable for debugging

---

## 📊 Monitoring & Testing

### Test the Integration:

```bash
# Run test script
cd tests
node test-hubspot-webhook.js
```

### Verify Updates:

```bash
# Check if webhook updated HubSpot
node verify-hubspot-webhook-update.js
```

### Monitor Logs:

```javascript
// Booking creation logs:
✅ Redis counter incremented: exam:40577087837:bookings = 10
📤 [WEBHOOK] Sending total_bookings sync for exam 40577087837: 10
✅ [WEBHOOK] Sync successful (189ms) - Status: 202

// If webhook fails:
❌ [WEBHOOK] Sync failed - Status: 500
// Reconciliation cron will fix this within 1 hour
```

---

## 🎯 Benefits Summary

**Reliability:**
- ✅ HubSpot workflows have built-in retry logic
- ✅ Asynchronous processing (more fault-tolerant)
- ✅ Reconciliation cron as safety net (hourly instead of 5-min)

**Performance:**
- ✅ Webhooks don't count against HubSpot API rate limits
- ✅ 202 Accepted response (non-blocking)
- ✅ Can extend reconciliation to hourly (96% API reduction)

**Maintainability:**
- ✅ Workflow can be modified in HubSpot UI (no code deploy)
- ✅ Can trigger multiple actions (email notifications, etc.)
- ✅ Easier to debug (HubSpot workflow history)

---

## 📋 Checklist

- [ ] Create HubSpot workflow with webhook trigger
- [ ] Configure workflow actions (extract variables, update record)
- [ ] Test webhook with `test-hubspot-webhook.js`
- [ ] Verify updates with `verify-hubspot-webhook-update.js`
- [ ] Update booking creation code
- [ ] Update cancellation code (3 files)
- [ ] Update reconciliation cron
- [ ] Extend reconciliation frequency to hourly
- [ ] Deploy and monitor logs
- [ ] Remove old direct API update code

---

## 🚀 Deployment

After integration:

1. **Test in development first**
2. **Monitor webhook success rate** (should be >99%)
3. **Extend reconciliation to hourly** (optional, for API savings)
4. **Remove old background sync code** (clean up)

---

## 💡 Future Enhancements

Once webhook integration is stable:

- Add webhook for other properties (capacity changes, status updates)
- Add Slack/email notifications via HubSpot workflow
- Add analytics tracking via HubSpot workflow
- Centralize all HubSpot updates via webhooks

---

**Generated:** 2025-01-18
**Webhook URL:** https://api-na1.hubapi.com/automation/v4/webhook-triggers/46814382/AIvBwN0
**Test Exam:** 40577087837
