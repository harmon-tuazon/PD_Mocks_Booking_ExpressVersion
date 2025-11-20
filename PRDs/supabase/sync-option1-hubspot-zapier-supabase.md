# PRD: HubSpot → Zapier → Supabase Sync (No-Code)

**Version**: 1.0
**Created**: 2025-01-20
**Complexity**: ⭐ (Easiest)
**Code Required**: None
**Monthly Cost**: $20-50+ (Zapier)

---

## Overview

Implement automatic data sync from HubSpot to Supabase using HubSpot Workflows and Zapier, requiring zero code changes to your application.

## Goals

1. Sync HubSpot Booking/Mock Exam changes to Supabase automatically
2. Zero application code required
3. Near real-time sync (< 5 minutes)
4. Reliable with automatic retries

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         HUBSPOT → ZAPIER → SUPABASE FLOW                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                                      │
│  │   HubSpot    │                                      │
│  │   Workflow   │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 1. Trigger: Booking property changed          │
│         │    or Mock Exam created/updated               │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   HubSpot    │                                      │
│  │   Webhook    │                                      │
│  │   Action     │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 2. Send webhook to Zapier                     │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   Zapier     │                                      │
│  │   Zap        │                                      │
│  └──────┬───────┘                                      │
│         │                                               │
│         │ 3. Transform data                             │
│         │ 4. Upsert to Supabase                         │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │   Supabase   │                                      │
│  │   Postgres   │                                      │
│  └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Supabase Tables (5 minutes)

Run in Supabase SQL Editor:

```sql
-- Bookings sync table
CREATE TABLE IF NOT EXISTS public.hubspot_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  booking_id TEXT,
  mock_exam_id TEXT,
  contact_id TEXT,
  student_id TEXT,
  student_name TEXT,
  student_email TEXT,
  booking_status TEXT,
  is_active TEXT,
  attendance TEXT,
  attending_location TEXT,
  exam_date TIMESTAMP,
  dominant_hand TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Mock Exams sync table
CREATE TABLE IF NOT EXISTS public.hubspot_mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id TEXT UNIQUE NOT NULL,
  mock_exam_name TEXT,
  mock_type TEXT,
  exam_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  capacity INTEGER,
  total_bookings INTEGER DEFAULT 0,
  is_active TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_bookings_hubspot_id ON public.hubspot_bookings(hubspot_id);
CREATE INDEX idx_bookings_exam_id ON public.hubspot_bookings(mock_exam_id);
CREATE INDEX idx_exams_hubspot_id ON public.hubspot_mock_exams(hubspot_id);
```

### Step 2: Create Zapier Zap - Bookings (10 minutes)

#### 2.1 Create New Zap
1. Go to zapier.com → Create Zap
2. Name it: "HubSpot Bookings → Supabase"

#### 2.2 Trigger: Webhooks by Zapier
1. Choose **Webhooks by Zapier** as trigger app
2. Event: **Catch Hook**
3. Copy the webhook URL (e.g., `https://hooks.zapier.com/hooks/catch/12345/abcdef/`)
4. Save this URL for HubSpot workflow

#### 2.3 Action: Supabase
1. Choose **Supabase** as action app
2. Event: **Create or Update Row**
3. Connect your Supabase account (need Project URL + Service Role Key)
4. Configure:
   - Table: `hubspot_bookings`
   - Lookup Column: `hubspot_id`
   - Lookup Value: `{{objectId}}` from webhook

#### 2.4 Map Fields
```
hubspot_id       → {{objectId}}
booking_id       → {{properties.booking_id}}
mock_exam_id     → {{properties.mock_exam_id}}
contact_id       → {{properties.contact_id}}
student_id       → {{properties.student_id}}
student_name     → {{properties.student_name}}
student_email    → {{properties.student_email}}
booking_status   → {{properties.booking_status}}
is_active        → {{properties.is_active}}
attendance       → {{properties.attendance}}
attending_location → {{properties.attending_location}}
exam_date        → {{properties.exam_date}}
dominant_hand    → {{properties.dominant_hand}}
synced_at        → {{current_timestamp}}
```

#### 2.5 Test & Turn On
1. Send test webhook from HubSpot
2. Verify data appears in Supabase
3. Turn on Zap

### Step 3: Create HubSpot Workflow - Bookings (10 minutes)

#### 3.1 Create Workflow
1. HubSpot → Automation → Workflows → Create workflow
2. Choose: **Custom object-based** → **Bookings**

#### 3.2 Set Enrollment Trigger
1. Trigger type: **Property value changed**
2. Properties to monitor:
   - `is_active`
   - `attendance`
   - `attending_location`
   - `booking_status`

OR for new bookings:
1. Trigger type: **Object is created**

#### 3.3 Add Webhook Action
1. Add action → **Send a webhook**
2. Method: **POST**
3. URL: Your Zapier webhook URL
4. Request body: **Customize**

```json
{
  "objectId": "{{booking.hs_object_id}}",
  "objectType": "booking",
  "properties": {
    "booking_id": "{{booking.booking_id}}",
    "mock_exam_id": "{{booking.mock_exam_id}}",
    "contact_id": "{{booking.contact_id}}",
    "student_id": "{{booking.student_id}}",
    "student_name": "{{booking.student_name}}",
    "student_email": "{{booking.student_email}}",
    "booking_status": "{{booking.booking_status}}",
    "is_active": "{{booking.is_active}}",
    "attendance": "{{booking.attendance}}",
    "attending_location": "{{booking.attending_location}}",
    "exam_date": "{{booking.exam_date}}",
    "dominant_hand": "{{booking.dominant_hand}}"
  }
}
```

#### 3.4 Activate Workflow
1. Review settings
2. Turn on workflow

### Step 4: Create Zap for Mock Exams (Repeat Steps 2-3)

Same process but for Mock Exams:
- Different Zapier webhook URL
- Table: `hubspot_mock_exams`
- Different field mappings

---

## Zapier Pricing Consideration

| Plan | Tasks/Month | Delay | Cost |
|------|-------------|-------|------|
| Free | 100 | 15 min | $0 |
| Starter | 750 | 2 min | $20 |
| Professional | 2,000 | 1 min | $50 |
| Team | 50,000 | 1 min | $400 |

**Recommendation**: Start with Starter plan ($20/month)

---

## Testing Checklist

- [ ] Create test booking in HubSpot
- [ ] Verify HubSpot workflow triggers
- [ ] Verify Zapier receives webhook
- [ ] Verify data appears in Supabase
- [ ] Update booking property in HubSpot
- [ ] Verify Supabase row updates (not duplicates)
- [ ] Check Zapier task history for errors

---

## Maintenance

### Weekly
- Check Zapier task history for failures
- Monitor Supabase table growth

### Monthly
- Review Zapier task usage vs plan limits
- Clean up old synced data if needed

---

## Pros & Cons

**Pros:**
- ✅ Zero application code
- ✅ Visual configuration
- ✅ Automatic retries
- ✅ Easy to modify mappings
- ✅ Zapier handles errors gracefully

**Cons:**
- ❌ Monthly Zapier cost
- ❌ 1-15 minute delay (depending on plan)
- ❌ One-way sync only (HubSpot → Supabase)
- ❌ Task limits on lower plans

---

## Success Criteria

- [ ] Bookings sync within 5 minutes of change
- [ ] Mock Exams sync within 5 minutes of change
- [ ] No duplicate records in Supabase
- [ ] Zero code changes to application
- [ ] Zapier error rate < 1%

---

## Related Documents

- [Alternative Sync Methods](alternative-sync-methods-no-cron-no-webhooks.md)
- [RBAC Setup Guide](rbac-step-by-step-setup-guide.md)
