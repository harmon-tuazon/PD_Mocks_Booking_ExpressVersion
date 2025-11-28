# sync_metadata Permission Fix Guide

## Problem
The cron job `/api/admin/cron/sync-supabase` is getting "permission denied for table sync_metadata" errors when trying to track incremental sync timestamps.

## Current Behavior
✅ **The sync is still working!** The code has graceful degradation that falls back to full sync when it can't access sync_metadata.

⚠️ **Performance impact**: Without incremental sync tracking, every sync fetches ALL recent data instead of just what changed.

## Why This Matters
- **With sync_metadata**: ~5-10 records synced per run (~3-8 seconds)
- **Without sync_metadata**: ~50-100 records synced per run (~15-30 seconds)

## Root Cause
The `sync_metadata` table has RLS (Row Level Security) enabled, but the service role doesn't have the proper policy attached.

## Solution Options

### Option 1: Fix RLS Policy (Recommended)

Run this SQL in your Supabase SQL Editor:

```sql
-- Ensure service_role has full access to sync_metadata
GRANT ALL ON public.sync_metadata TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- Create a simple policy that allows all operations
DROP POLICY IF EXISTS "service_role_all_access" ON public.sync_metadata;

CREATE POLICY "service_role_all_access"
  ON public.sync_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

Or run the complete fix script:
```bash
# From project root
psql $SUPABASE_CONNECTION_STRING < PRDs/supabase/sync-metadata-fix.sql
```

### Option 2: Disable RLS on sync_metadata (Quick Fix)

If you want to quickly fix this and don't need RLS on this table:

```sql
ALTER TABLE public.sync_metadata DISABLE ROW LEVEL SECURITY;
```

This is safe because:
- The table only stores sync timestamps (not sensitive data)
- Only the cron job accesses it
- It's not exposed to frontend

### Option 3: Verify Service Role Key (If Above Don't Work)

Check your Vercel environment variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. The key should start with `eyJ...` (it's a JWT)
4. Make sure it's the **service_role** key, not the **anon** key

Get the correct key from:
Supabase Dashboard → Project Settings → API → service_role secret

## How to Verify the Fix

After applying one of the solutions:

1. Wait for the next cron execution (runs every 2 hours)
2. Check Vercel logs for:
   ```
   ✅ Updated mock_exams sync timestamp to 2025-11-28T16:00:00.000Z
   ```
3. You should NO LONGER see:
   ```
   ⚠️ Permission denied for sync_metadata table
   ```

## Test Manually

Trigger the cron job manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/admin/cron/sync-supabase
```

Check response for:
```json
{
  "success": true,
  "summary": {
    "mockExams": { "synced": 5, "errors": 0 },
    // ...
  }
}
```

## Current Status (Before Fix)

❌ Permission denied → Falls back to full sync
✅ Sync still works, just slower
⏱️ ~15-30 seconds per sync instead of ~3-8 seconds

## Expected Status (After Fix)

✅ Incremental sync enabled
✅ Much faster syncs
⏱️ ~3-8 seconds per sync
📊 Only 5-10 records synced per run (just what changed)

## Related Files
- `admin_root/api/admin/cron/sync-supabase.js` - Cron job handler
- `admin_root/api/_shared/supabaseSync.optimized.js` - Sync logic
- `PRDs/supabase/sync-metadata-table.sql` - Original table creation
- `PRDs/supabase/sync-metadata-fix.sql` - Fix script

## Questions?

The code is already handling the permission error gracefully, so this is a **performance optimization**, not a critical bug fix. The sync will work either way!
