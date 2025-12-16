# Supabase Edge Function Deployment Guide

This guide walks you through deploying the `cascade-exam-updates` Supabase Edge Function for automatic booking updates when exam properties change.

## Architecture Overview

```
Admin updates exam → HubSpot update → Supabase sync → Webhook trigger
                                                            ↓
                                                    Supabase Edge Function
                                                            ↓
                                              Update all bookings in Supabase
                                                            ↓
                                                  Invalidate Redis cache
```

## Prerequisites

1. **Supabase Account**: Ensure you have access to your Supabase project
2. **Supabase CLI**: Not required - we'll deploy via Supabase Dashboard
3. **Environment Variables**: Required for webhook authentication

## Step 1: Deploy Edge Function via Supabase Dashboard

### Option A: Via Supabase Dashboard (Recommended)

1. **Navigate to Edge Functions**
   - Go to your Supabase project dashboard
   - Click "Edge Functions" in the left sidebar
   - Click "Create a new function"

2. **Create Function**
   - **Function name**: `cascade-exam-updates`
   - **Copy the code** from [`supabase/functions/cascade-exam-updates/index.ts`](./supabase/functions/cascade-exam-updates/index.ts)
   - Paste into the editor
   - Click "Deploy"

3. **Verify Deployment**
   - You should see the function listed in "Edge Functions"
   - Note the function URL (format: `https://<project-ref>.supabase.co/functions/v1/cascade-exam-updates`)

### Option B: Via Supabase CLI (Advanced)

If you prefer using CLI:

```bash
# Install Supabase CLI (Windows/macOS/Linux)
# See: https://supabase.com/docs/guides/cli/getting-started

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy cascade-exam-updates
```

## Step 2: Configure Environment Variables

### Supabase Environment Variables

In your Supabase Dashboard → Settings → Edge Functions → Environment Variables:

```bash
# Required: Webhook authentication secret
WEBHOOK_SECRET=<generate-strong-random-secret>

# Required: Supabase connection (auto-configured, but verify)
SUPABASE_URL=https://<your-project-ref>.supabase.io
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Generate `WEBHOOK_SECRET`**:
```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vercel Environment Variables (Admin App)

Add these to your Vercel project (admin_root):

```bash
# Supabase Edge Function webhook endpoint
SUPABASE_EDGE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/cascade-exam-updates

# Webhook authentication secret (MUST match Supabase WEBHOOK_SECRET)
# Note: Uses existing SHAKY_MOCKS_KEY environment variable
SHAKY_MOCKS_KEY=<same-secret-as-supabase-webhook-secret>
```

**Add via Vercel Dashboard**:
1. Go to your Vercel project → Settings → Environment Variables
2. Add `SUPABASE_EDGE_FUNCTION_URL` for Production, Preview, and Development
3. Verify `SHAKY_MOCKS_KEY` is already configured (existing variable)
4. Update `SHAKY_MOCKS_KEY` to match Supabase `WEBHOOK_SECRET` if needed
5. Redeploy your admin app

**Or via Vercel CLI**:
```bash
vercel env add SUPABASE_EDGE_FUNCTION_URL production
# SHAKY_MOCKS_KEY should already exist - verify with:
vercel env ls
```

**Note**: The code uses `SHAKY_MOCKS_KEY` (existing variable) instead of creating a new `SUPABASE_WEBHOOK_SECRET` variable.

## Step 3: Test the Integration

### Test 1: Single Exam Update

```bash
# Update an exam via admin endpoint
curl -X PATCH https://your-admin-app.vercel.app/api/admin/mock-exams/update?id=<exam-id> \
  -H "Authorization: Bearer <your-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "New Location",
    "exam_date": "2026-04-15"
  }'

# Check logs in Supabase Dashboard → Edge Functions → Logs
# You should see:
# - "🔄 Received exam update webhook for exam <exam-id>"
# - "📋 Found X bookings to update"
# - "✅ Successfully updated X bookings"
```

### Test 2: Bulk Exam Update

```bash
# Bulk update multiple exams
curl -X POST https://your-admin-app.vercel.app/api/admin/mock-exams/bulk-update \
  -H "Authorization: Bearer <your-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionIds": ["<exam-id-1>", "<exam-id-2>"],
    "updates": {
      "location": "Calgary",
      "capacity": 12
    }
  }'

# Check Supabase Edge Function logs for cascade triggers
```

### Test 3: Verify Booking Updates

```sql
-- Run in Supabase SQL Editor
SELECT
  id,
  associated_mock_exam,
  exam_date,
  attending_location,
  updated_at
FROM hubspot_bookings
WHERE associated_mock_exam = '<exam-id>'
ORDER BY updated_at DESC;

-- Verify `updated_at` reflects recent cascade
-- Verify `attending_location` matches new exam location
```

## Step 4: Monitor and Debug

### Supabase Edge Function Logs

View logs in Supabase Dashboard:
1. Navigate to Edge Functions → `cascade-exam-updates`
2. Click "Logs" tab
3. Filter by time range to see recent executions

**Expected log output**:
```
🔄 Received exam update webhook for exam 123456789
Properties to update: { location: "New Location", exam_date: "2026-04-15" }
📋 Found 15 bookings to update
✅ Successfully updated 15 bookings
```

### Admin Endpoint Logs

Check Vercel logs for admin endpoints:
```bash
vercel logs admin-app --follow

# Expected output:
# 🔔 Triggering booking cascade for properties: [ 'location', 'exam_date' ]
# ✅ Cascade webhook triggered: 15 bookings updated
```

### Common Issues

**Issue 1: 401 Unauthorized**
- **Cause**: `WEBHOOK_SECRET` (Supabase) doesn't match `SHAKY_MOCKS_KEY` (Vercel)
- **Fix**: Verify both secrets match exactly

**Issue 2: No bookings updated**
- **Cause**: Webhook not configured or Edge Function not deployed
- **Fix**: Verify `SUPABASE_EDGE_FUNCTION_URL` is correct and Edge Function is deployed

## Step 5: Performance Considerations

### Scalability

- **Small batch** (<50 bookings): ~300ms per cascade
- **Medium batch** (50-200 bookings): ~800ms per cascade
- **Large batch** (>200 bookings): Consider chunking or async processing

### Rate Limits

Supabase Edge Functions:
- **Concurrent executions**: Unlimited (scales automatically)
- **Timeout**: 60 seconds per invocation
- **Memory**: 512MB per invocation

### Cost Optimization

- **Free tier**: 500,000 Edge Function invocations/month
- **Fire-and-forget**: Non-blocking webhook calls don't slow down admin operations
- **Batch updates**: Single query updates all bookings efficiently

## Architecture Decisions

### Why Supabase Edge Function over Vercel Function?

1. **Colocation**: Edge Function runs closer to Supabase database (lower latency)
2. **Separation of Concerns**: Keeps cascade logic separate from admin API
3. **Scalability**: Supabase handles scaling automatically
4. **Observability**: Dedicated logs for cascade operations

### Why Fire-and-Forget Webhook?

1. **Non-blocking**: Admin operations complete immediately
2. **Resilience**: Webhook failures don't affect admin operations
3. **Retry logic**: Can add retry mechanism in Edge Function itself

### Why Not Database Triggers?

1. **Complexity**: Database triggers harder to debug and maintain
2. **Flexibility**: Edge Functions allow custom logic (cache invalidation, webhooks)
3. **Portability**: Easier to disable or modify behavior without schema changes

## Rollback Plan

If you need to disable the cascade feature:

### Option 1: Remove Environment Variable
```bash
# In Vercel Dashboard, delete:
SUPABASE_EDGE_FUNCTION_URL

# This will cause `triggerExamCascade()` to skip webhook calls
```

### Option 2: Disable Edge Function
- In Supabase Dashboard → Edge Functions
- Delete or disable `cascade-exam-updates` function

### Option 3: Remove Integration Code
```bash
# Revert admin endpoint changes
git revert <commit-hash>
vercel --prod
```

## Future Enhancements

1. **Retry Logic**: Add exponential backoff for failed cascades
2. **Batch Optimization**: Chunk large booking updates (>1000)
3. **Audit Trail**: Log cascade operations to Supabase audit table
4. **Notification**: Alert admins when cascade affects >100 bookings

## Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Getting Started](https://supabase.com/docs/guides/cli/getting-started)
- [Deno Deploy (Edge Function Runtime)](https://deno.com/deploy)

## Support

For issues or questions:
1. Check Supabase Edge Function logs
2. Check Vercel admin endpoint logs
3. Verify environment variables are set correctly
4. Test webhook manually using curl (see Test section)
