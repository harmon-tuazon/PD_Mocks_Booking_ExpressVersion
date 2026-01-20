# PRD: Prerequisite Exam IDs Array Column with Delta-Based Updates

## Overview

| Field | Value |
|-------|-------|
| **Feature** | Store prerequisite exam IDs in Supabase with delta-based updates |
| **Branch** | `prerequisite_exams_supabase` |
| **Priority** | High |
| **Estimated Effort** | 6-8 hours |
| **Related Feature** | Mock Discussion prerequisite validation |

---

## Problem Statement

Currently, prerequisite exam relationships are stored only in HubSpot associations (type 1340 - "requires attendance at"). This creates performance bottlenecks:

1. **Slow reads**: Each prerequisite check requires HubSpot V4 API call (~500ms)
2. **No Supabase-first pattern**: Can't leverage fast Supabase queries (~50ms)
3. **Sync dependency**: Real-time validation depends on HubSpot availability

The admin UI uses a **checkbox pattern** where:
- Already-saved prerequisites appear as checked
- Users can check new exams to add as prerequisites
- Users can uncheck existing exams to remove them
- **Unchanged values must be preserved**

This requires a **delta-based update strategy** that handles partial array modifications.

---

## Requirements

### Functional Requirements

1. **Database**: Add `prerequisite_exam_ids TEXT[]` column to `hubspot_mock_exams` table
2. **RPC Function**: Create `update_exam_prerequisites` function supporting delta-based updates
3. **Backend - Admin Write**: Create endpoint to add/remove prerequisites with delta payload
4. **Backend - Admin Read**: Include `prerequisite_exam_ids` in exam detail responses
5. **Backend - User Read**: Use Supabase array for prerequisite validation (replace HubSpot API call)
6. **Sync**: Populate array during HubSpot → Supabase exam sync cron job
7. **Frontend**: Update prerequisite management UI to use delta-based API

### Non-Functional Requirements

- Array operations must be atomic (no race conditions)
- Preserve existing values during partial updates
- Support both add and remove in single operation
- Maintain HubSpot association sync for admin visibility

---

## Technical Audit: Current State Analysis

### Database Layer

| Component | File | Current State | Action Required |
|-----------|------|---------------|-----------------|
| hubspot_mock_exams table | Supabase schema | No prerequisite column | Add `prerequisite_exam_ids TEXT[]` |
| RPC for updates | None | Does not exist | Create `update_exam_prerequisites` function |

### Backend - Write Operations

| Component | File | Current State | Action Required |
|-----------|------|---------------|-----------------|
| Admin prerequisites POST | [admin_root/api/admin/mock-exams/[id]/prerequisites/index.js](../../admin_root/api/admin/mock-exams/[id]/prerequisites/index.js) | HubSpot-only | Add Supabase array update after HubSpot |
| Admin prerequisites DELETE | Same file | HubSpot-only | Add Supabase array update after HubSpot |
| New delta endpoint | Does not exist | N/A | Create `/api/admin/mock-exams/[id]/prerequisites/delta` |

### Backend - Read Operations

| Component | File | Current State | Action Required |
|-----------|------|---------------|-----------------|
| User prerequisite check | [user_root/api/mock-discussions/create-booking.js](../../user_root/api/mock-discussions/create-booking.js) | Uses HubSpot API | Switch to Supabase array read |
| Admin prerequisites GET | [admin_root/api/admin/mock-exams/[id]/prerequisites/index.js](../../admin_root/api/admin/mock-exams/[id]/prerequisites/index.js) | HubSpot-only | Add Supabase fallback |
| Exam sync cron | [admin_root/api/cron/sync-exams-backfill-bookings-from-hubspot.js](../../admin_root/api/cron/sync-exams-backfill-bookings-from-hubspot.js) | No prerequisites | Fetch and sync prerequisite associations |

### Frontend - Admin App

| Component | File | Current State | Action Required |
|-----------|------|---------------|-----------------|
| PrerequisiteManager | [admin_root/admin_frontend/src/components/admin/PrerequisiteManager.jsx](../../admin_root/admin_frontend/src/components/admin/PrerequisiteManager.jsx) | Full replacement | Update to use delta-based API |

---

## Implementation Plan

### Phase 1: Database Schema

#### Task 1.1: Add Column to Supabase

```sql
-- Run in Supabase SQL Editor

-- Step 1: Add prerequisite_exam_ids array column
-- Uses TEXT[] to store HubSpot exam IDs (numeric strings)
ALTER TABLE hubspot_sync.hubspot_mock_exams
ADD COLUMN IF NOT EXISTS prerequisite_exam_ids TEXT[] DEFAULT '{}';

-- Step 2: Add comment explaining the column purpose
COMMENT ON COLUMN hubspot_sync.hubspot_mock_exams.prerequisite_exam_ids IS
  'Array of HubSpot mock exam IDs that are prerequisites for this exam (Mock Discussions only). Synced from HubSpot association type 1340.';

-- Step 3: Create GIN index for efficient array operations
-- GIN indexes are optimized for array containment queries (@>, &&, etc.)
CREATE INDEX IF NOT EXISTS idx_hubspot_mock_exams_prerequisite_ids
ON hubspot_sync.hubspot_mock_exams USING GIN (prerequisite_exam_ids)
WHERE prerequisite_exam_ids IS NOT NULL AND array_length(prerequisite_exam_ids, 1) > 0;

-- Step 4: Verify the column was added correctly
SELECT column_name, data_type, udt_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'hubspot_sync'
  AND table_name = 'hubspot_mock_exams'
  AND column_name = 'prerequisite_exam_ids';
```

#### Task 1.2: Create Delta-Based Update RPC Function

```sql
-- =========================================================================
-- RPC Function: update_exam_prerequisites
-- =========================================================================
-- Supports delta-based updates for checkbox UI pattern:
-- - add_ids: Array of exam IDs to add as prerequisites
-- - remove_ids: Array of exam IDs to remove from prerequisites
-- - Preserves existing values not in add/remove lists
-- - Returns the updated array after modification
-- =========================================================================

CREATE OR REPLACE FUNCTION hubspot_sync.update_exam_prerequisites(
  p_exam_id TEXT,                    -- HubSpot ID of the exam to update
  p_add_ids TEXT[] DEFAULT '{}',     -- IDs to add (newly checked)
  p_remove_ids TEXT[] DEFAULT '{}'   -- IDs to remove (newly unchecked)
)
RETURNS JSONB AS $$
DECLARE
  v_result TEXT[];
  v_previous TEXT[];
  v_added_count INTEGER := 0;
  v_removed_count INTEGER := 0;
BEGIN
  -- Get current prerequisites for logging
  SELECT COALESCE(prerequisite_exam_ids, '{}')
  INTO v_previous
  FROM hubspot_sync.hubspot_mock_exams
  WHERE hubspot_id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam % not found in Supabase', p_exam_id;
  END IF;

  -- Perform atomic update with add and remove operations
  UPDATE hubspot_sync.hubspot_mock_exams
  SET
    prerequisite_exam_ids = (
      SELECT COALESCE(array_agg(DISTINCT elem ORDER BY elem), '{}')
      FROM (
        -- Start with existing prerequisites
        SELECT unnest(COALESCE(prerequisite_exam_ids, '{}')) AS elem
        -- Exclude items being removed
        EXCEPT
        SELECT unnest(p_remove_ids)
        -- Union with items being added
        UNION
        SELECT unnest(p_add_ids)
      ) sub
      WHERE elem IS NOT NULL AND elem != ''
    ),
    updated_at = NOW()
  WHERE hubspot_id = p_exam_id
  RETURNING prerequisite_exam_ids INTO v_result;

  -- Calculate what was actually added/removed
  v_added_count := (
    SELECT COUNT(*) FROM unnest(v_result) AS elem
    WHERE elem = ANY(p_add_ids) AND NOT elem = ANY(v_previous)
  );

  v_removed_count := (
    SELECT COUNT(*) FROM unnest(v_previous) AS elem
    WHERE elem = ANY(p_remove_ids) AND NOT elem = ANY(v_result)
  );

  -- Return detailed result
  RETURN jsonb_build_object(
    'success', true,
    'exam_id', p_exam_id,
    'prerequisite_exam_ids', v_result,
    'previous_count', array_length(v_previous, 1),
    'current_count', array_length(v_result, 1),
    'added_count', v_added_count,
    'removed_count', v_removed_count,
    'requested_add', p_add_ids,
    'requested_remove', p_remove_ids
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION hubspot_sync.update_exam_prerequisites(TEXT, TEXT[], TEXT[]) TO service_role;

```

---

### Phase 2: Backend Write Operations

#### Task 2.1: Create Delta Update Endpoint

**File**: `admin_root/api/admin/mock-exams/[id]/prerequisites/delta.js` (NEW)

```javascript
/**
 * PATCH /api/admin/mock-exams/[id]/prerequisites/delta
 * Delta-based update for prerequisite exam IDs
 *
 * Request Body:
 * {
 *   add_prerequisites: ['123', '456'],      // IDs to add (newly checked)
 *   remove_prerequisites: ['789']           // IDs to remove (newly unchecked)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     prerequisite_exam_ids: ['123', '456', '999'],
 *     added_count: 2,
 *     removed_count: 1,
 *     total_count: 3
 *   }
 * }
 */

const { requireAdmin } = require('../../../middleware/requireAdmin');
const { supabaseAdmin } = require('../../../../_shared/supabase');
const hubspot = require('../../../../_shared/hubspot');

// HubSpot Object Type IDs
const HUBSPOT_OBJECTS = {
  mock_exams: '2-50158913'
};

// Association type for "requires attendance at"
const PREREQUISITE_ASSOCIATION_TYPE = 1340;

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Verify admin authentication
    await requireAdmin(req);

    const examId = req.query.id;
    const { add_prerequisites = [], remove_prerequisites = [] } = req.body;

    if (!examId) {
      return res.status(400).json({
        success: false,
        error: 'Exam ID is required'
      });
    }

    // Validate arrays
    if (!Array.isArray(add_prerequisites) || !Array.isArray(remove_prerequisites)) {
      return res.status(400).json({
        success: false,
        error: 'add_prerequisites and remove_prerequisites must be arrays'
      });
    }

    // No changes requested
    if (add_prerequisites.length === 0 && remove_prerequisites.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No changes requested. Provide add_prerequisites or remove_prerequisites.'
      });
    }

    console.log(`📝 [PREREQUISITES DELTA] Exam ${examId}: +${add_prerequisites.length} / -${remove_prerequisites.length}`);

    // Step 1: Update Supabase array (atomic operation)
    const { data: supabaseResult, error: supabaseError } = await supabaseAdmin
      .rpc('update_exam_prerequisites', {
        p_exam_id: examId,
        p_add_ids: add_prerequisites,
        p_remove_ids: remove_prerequisites
      });

    if (supabaseError) {
      console.error('❌ [SUPABASE] Failed to update prerequisites:', supabaseError);
      throw new Error(`Supabase update failed: ${supabaseError.message}`);
    }

    console.log(`✅ [SUPABASE] Prerequisites updated:`, supabaseResult);

    // Step 2: Sync to HubSpot associations (fire-and-forget for resilience)
    // This keeps HubSpot in sync for admin visibility in HubSpot UI
    syncToHubSpot(examId, add_prerequisites, remove_prerequisites).catch(err => {
      console.error('⚠️ [HUBSPOT SYNC] Non-blocking error:', err.message);
    });

    return res.status(200).json({
      success: true,
      data: {
        prerequisite_exam_ids: supabaseResult.prerequisite_exam_ids,
        added_count: supabaseResult.added_count,
        removed_count: supabaseResult.removed_count,
        total_count: supabaseResult.current_count || 0
      },
      meta: {
        previous_count: supabaseResult.previous_count,
        requested_add: add_prerequisites,
        requested_remove: remove_prerequisites
      }
    });

  } catch (error) {
    console.error('❌ [PREREQUISITES DELTA] Error:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update prerequisites'
    });
  }
};

/**
 * Sync prerequisite changes to HubSpot associations
 * Fire-and-forget - doesn't block the response
 */
async function syncToHubSpot(examId, addIds, removeIds) {
  // Add new associations
  for (const prereqId of addIds) {
    try {
      await hubspot.apiCall('PUT',
        `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${prereqId}`,
        [{
          associationCategory: 'USER_DEFINED',
          associationTypeId: PREREQUISITE_ASSOCIATION_TYPE
        }]
      );
      console.log(`✅ [HUBSPOT] Added association: ${examId} → ${prereqId}`);
    } catch (err) {
      console.error(`⚠️ [HUBSPOT] Failed to add association ${examId} → ${prereqId}:`, err.message);
    }
  }

  // Remove associations
  for (const prereqId of removeIds) {
    try {
      await hubspot.apiCall('DELETE',
        `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${examId}/associations/${HUBSPOT_OBJECTS.mock_exams}/${prereqId}`
      );
      console.log(`✅ [HUBSPOT] Removed association: ${examId} → ${prereqId}`);
    } catch (err) {
      console.error(`⚠️ [HUBSPOT] Failed to remove association ${examId} → ${prereqId}:`, err.message);
    }
  }
}
```

#### Task 2.2: Update Existing Prerequisites Endpoint

**File**: `admin_root/api/admin/mock-exams/[id]/prerequisites/index.js`

Add Supabase array sync after successful HubSpot operations:

```javascript
// After successful HubSpot association creation (in handlePostRequest)
// Add this sync to Supabase array:

// Sync to Supabase array (fire-and-forget)
supabaseAdmin.rpc('update_exam_prerequisites', {
  p_exam_id: mock_exam_id,
  p_add_ids: [prerequisite_exam_id],
  p_remove_ids: []
}).then(result => {
  console.log(`✅ [SUPABASE SYNC] Added prerequisite to array:`, result.data);
}).catch(err => {
  console.error(`⚠️ [SUPABASE SYNC] Failed to sync prerequisite add:`, err.message);
});
```

```javascript
// After successful HubSpot association deletion (in handleDeleteRequest)
// Add this sync to Supabase array:

// Sync to Supabase array (fire-and-forget)
supabaseAdmin.rpc('update_exam_prerequisites', {
  p_exam_id: mock_exam_id,
  p_add_ids: [],
  p_remove_ids: [prerequisite_exam_id]
}).then(result => {
  console.log(`✅ [SUPABASE SYNC] Removed prerequisite from array:`, result.data);
}).catch(err => {
  console.error(`⚠️ [SUPABASE SYNC] Failed to sync prerequisite remove:`, err.message);
});
```

---

### Phase 3: Backend Read Operations

#### Task 3.1: Update User Prerequisite Validation

**File**: `user_root/api/mock-discussions/create-booking.js`

Replace the HubSpot API call with Supabase array read:

```javascript
// BEFORE (HubSpot API call - ~500ms):
// const prerequisiteExamIds = await hubspot.getMockExamPrerequisites(mock_exam_id);

// AFTER (Supabase array read - ~50ms):
const { data: examData, error: examError } = await supabaseAdmin
  .from('hubspot_mock_exams')
  .select('prerequisite_exam_ids')
  .eq('hubspot_id', mock_exam_id)
  .single();

if (examError) {
  console.error('⚠️ [SUPABASE] Failed to fetch prerequisites:', examError.message);
  // Fallback to HubSpot if Supabase fails
  prerequisiteExamIds = await hubspot.getMockExamPrerequisites(mock_exam_id);
} else {
  prerequisiteExamIds = examData?.prerequisite_exam_ids || [];
}

if (prerequisiteExamIds.length > 0) {
  console.log(`📋 [PREREQUISITE CHECK] Mock Discussion ${mock_exam_id} requires ${prerequisiteExamIds.length} prerequisite exam(s)`);
  // ... rest of validation logic remains the same
}
```

#### Task 3.2: Update Admin Prerequisites GET

**File**: `admin_root/api/admin/mock-exams/[id]/prerequisites/index.js`

Add Supabase-first pattern to `handleGetRequest`:

```javascript
async function handleGetRequest(req, res, mock_exam_id) {
  try {
    // Try Supabase first (fast path ~50ms)
    const { data: examData, error: supabaseError } = await supabaseAdmin
      .from('hubspot_mock_exams')
      .select('prerequisite_exam_ids')
      .eq('hubspot_id', mock_exam_id)
      .single();

    if (!supabaseError && examData?.prerequisite_exam_ids?.length > 0) {
      console.log(`✅ [SUPABASE HIT] Found ${examData.prerequisite_exam_ids.length} prerequisites`);

      // Fetch prerequisite exam details from Supabase
      const { data: prereqExams } = await supabaseAdmin
        .from('hubspot_mock_exams')
        .select('hubspot_id, mock_exam_name, mock_type, exam_date, start_time, end_time')
        .in('hubspot_id', examData.prerequisite_exam_ids);

      return res.status(200).json({
        success: true,
        data: {
          prerequisite_exam_ids: examData.prerequisite_exam_ids,
          prerequisites: prereqExams || []
        },
        meta: { source: 'supabase' }
      });
    }

    // Fallback to HubSpot if not in Supabase
    console.log(`📭 [SUPABASE MISS] Falling back to HubSpot for prerequisites`);
    // ... existing HubSpot logic ...
  } catch (error) {
    // ... error handling
  }
}
```

---

### Phase 4: Sync Integration

#### Task 4.1: Update Exam Sync Cron Job

**File**: `admin_root/api/cron/sync-exams-backfill-bookings-from-hubspot.js`

Add prerequisite fetching to the exam sync:

```javascript
// After fetching exam batch from HubSpot, fetch prerequisites for Mock Discussions

// Filter Mock Discussions from the batch
const mockDiscussions = examsBatch.filter(exam =>
  exam.properties.mock_type === 'Mock Discussion'
);

// Fetch prerequisites for each Mock Discussion
for (const discussion of mockDiscussions) {
  try {
    // Use V4 associations API
    const response = await hubspot.apiCall(
      'GET',
      `/crm/v4/objects/${HUBSPOT_OBJECTS.mock_exams}/${discussion.id}/associations/${HUBSPOT_OBJECTS.mock_exams}`
    );

    // Filter for type 1340 (requires attendance at)
    const prerequisiteIds = (response.results || [])
      .filter(assoc => assoc.associationTypes?.some(t => t.typeId === 1340))
      .map(a => String(a.toObjectId));

    // Add to exam record for upsert
    discussion.prerequisite_exam_ids = prerequisiteIds;

    console.log(`📋 [SYNC] Discussion ${discussion.id} has ${prerequisiteIds.length} prerequisites`);
  } catch (err) {
    console.error(`⚠️ [SYNC] Failed to fetch prerequisites for ${discussion.id}:`, err.message);
    discussion.prerequisite_exam_ids = [];
  }
}

// In the upsert, include prerequisite_exam_ids:
const examRecord = {
  hubspot_id: exam.id,
  // ... other fields ...
  prerequisite_exam_ids: exam.prerequisite_exam_ids || []
};
```

---

### Phase 5: Frontend Updates

#### Task 5.1: Update PrerequisiteManager Component

**File**: `admin_root/admin_frontend/src/components/admin/PrerequisiteManager.jsx`

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/adminApi';
import toast from 'react-hot-toast';

/**
 * PrerequisiteManager Component
 * Checkbox-based UI for managing prerequisite exams with delta-based updates
 */
const PrerequisiteManager = ({ examId, examType, examDate }) => {
  const queryClient = useQueryClient();

  // Track original state for delta calculation
  const [originalPrereqs, setOriginalPrereqs] = useState([]);
  const [checkedPrereqs, setCheckedPrereqs] = useState([]);

  // Fetch current prerequisites
  const { data: prereqData, isLoading } = useQuery({
    queryKey: ['prerequisites', examId],
    queryFn: () => adminApi.getExamPrerequisites(examId),
    enabled: !!examId && examType === 'Mock Discussion'
  });

  // Fetch available exams (SJ and CS only, before this exam's date)
  const { data: availableExams } = useQuery({
    queryKey: ['available-prerequisites', examDate],
    queryFn: () => adminApi.getAvailablePrerequisiteExams(examDate),
    enabled: !!examDate && examType === 'Mock Discussion'
  });

  // Initialize state when data loads
  useEffect(() => {
    if (prereqData?.data?.prerequisite_exam_ids) {
      const ids = prereqData.data.prerequisite_exam_ids;
      setOriginalPrereqs(ids);
      setCheckedPrereqs(ids);
    }
  }, [prereqData]);

  // Calculate delta for save
  const delta = useMemo(() => {
    const added = checkedPrereqs.filter(id => !originalPrereqs.includes(id));
    const removed = originalPrereqs.filter(id => !checkedPrereqs.includes(id));
    return { added, removed, hasChanges: added.length > 0 || removed.length > 0 };
  }, [checkedPrereqs, originalPrereqs]);

  // Delta update mutation
  const updateMutation = useMutation({
    mutationFn: ({ add, remove }) =>
      adminApi.updatePrerequisitesDelta(examId, add, remove),
    onSuccess: (data) => {
      toast.success(`Prerequisites updated (+${delta.added.length}/-${delta.removed.length})`);
      // Update original state to reflect saved state
      setOriginalPrereqs(data.data.prerequisite_exam_ids);
      // Invalidate related queries
      queryClient.invalidateQueries(['prerequisites', examId]);
      queryClient.invalidateQueries(['mockExamDetails', examId]);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    }
  });

  // Handle checkbox toggle
  const handleToggle = (prereqId) => {
    setCheckedPrereqs(prev => {
      if (prev.includes(prereqId)) {
        return prev.filter(id => id !== prereqId);
      }
      return [...prev, prereqId];
    });
  };

  // Handle save
  const handleSave = () => {
    if (!delta.hasChanges) {
      toast.info('No changes to save');
      return;
    }
    updateMutation.mutate({
      add: delta.added,
      remove: delta.removed
    });
  };

  // Handle reset
  const handleReset = () => {
    setCheckedPrereqs(originalPrereqs);
  };

  if (examType !== 'Mock Discussion') {
    return null; // Only show for Mock Discussions
  }

  return (
    <div className="bg-white dark:bg-dark-card rounded-lg p-4 border border-gray-200 dark:border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Prerequisite Exams</h3>

      {isLoading ? (
        <div className="animate-pulse">Loading prerequisites...</div>
      ) : (
        <>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableExams?.data?.map(exam => (
              <label
                key={exam.hubspot_id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checkedPrereqs.includes(exam.hubspot_id)}
                  onChange={() => handleToggle(exam.hubspot_id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="font-medium">{exam.mock_exam_name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({exam.mock_type} - {exam.exam_date})
                  </span>
                </div>
              </label>
            ))}
          </div>

          {/* Delta indicator */}
          {delta.hasChanges && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
              <span className="text-blue-700 dark:text-blue-300">
                Pending changes: +{delta.added.length} / -{delta.removed.length}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={!delta.hasChanges || updateMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              disabled={!delta.hasChanges}
              className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PrerequisiteManager;
```

#### Task 5.2: Add API Methods

**File**: `admin_root/admin_frontend/src/services/adminApi.js`

```javascript
// Add these methods to adminApi:

/**
 * Get exam prerequisites
 */
getExamPrerequisites: async (examId) => {
  const response = await fetch(`/api/admin/mock-exams/${examId}/prerequisites`);
  if (!response.ok) throw new Error('Failed to fetch prerequisites');
  return response.json();
},

/**
 * Update prerequisites using delta-based approach
 */
updatePrerequisitesDelta: async (examId, addIds, removeIds) => {
  const response = await fetch(`/api/admin/mock-exams/${examId}/prerequisites/delta`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      add_prerequisites: addIds,
      remove_prerequisites: removeIds
    })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update prerequisites');
  }
  return response.json();
},

/**
 * Get available exams that can be prerequisites (SJ/CS before given date)
 */
getAvailablePrerequisiteExams: async (beforeDate) => {
  const response = await fetch(`/api/admin/mock-exams/available-prerequisites?before_date=${beforeDate}`);
  if (!response.ok) throw new Error('Failed to fetch available exams');
  return response.json();
}
```

---

## Testing Checklist

### Database
- [ ] Column exists in hubspot_mock_exams table
- [ ] GIN index created for array operations
- [ ] RPC functions created and accessible

### Backend - Write Operations
- [ ] Delta endpoint accepts add/remove arrays
- [ ] Empty arrays handled correctly (no-op)
- [ ] Duplicate adds are ignored (no duplicates in array)
- [ ] Remove of non-existent ID is safe
- [ ] HubSpot associations sync correctly

### Backend - Read Operations
- [ ] Supabase-first pattern works for prerequisite check
- [ ] HubSpot fallback works when Supabase empty
- [ ] Admin GET returns prerequisites from Supabase

### Sync
- [ ] Cron job populates prerequisite_exam_ids for Mock Discussions
- [ ] Only type 1340 associations are synced
- [ ] Empty arrays for non-Discussion exams

### Frontend
- [ ] Checkboxes reflect saved state on load
- [ ] Delta calculated correctly (added vs removed)
- [ ] Save only enabled when changes exist
- [ ] Reset restores to saved state
- [ ] Toast shows add/remove counts

### Performance
- [ ] Supabase read < 100ms (vs ~500ms HubSpot)
- [ ] Array update is atomic (no race conditions)

---

## Rollback Plan

If issues occur:
1. **Frontend**: Revert to full replacement API (send all checked IDs)
2. **Backend**: Fallback to HubSpot API for prerequisite reads
3. **Database**: Column can remain (harmless if unused)
4. **RPC**: Functions can be dropped without data loss

---

## Migration Strategy

### Initial Backfill

Run once after column is created to populate existing Mock Discussions:

```sql
-- Backfill script (run manually or via one-time cron)
-- This populates prerequisite_exam_ids from HubSpot for existing Mock Discussions

-- Note: This requires a backend script to fetch HubSpot associations
-- and call set_exam_prerequisites for each Mock Discussion
```

**Backend Backfill Script**: `admin_root/scripts/backfill-prerequisites.js`

```javascript
// One-time script to backfill prerequisites from HubSpot to Supabase
const { supabaseAdmin } = require('../api/_shared/supabase');
const hubspot = require('../api/_shared/hubspot');

async function backfillPrerequisites() {
  // Get all Mock Discussions from Supabase
  const { data: discussions } = await supabaseAdmin
    .from('hubspot_mock_exams')
    .select('hubspot_id')
    .eq('mock_type', 'Mock Discussion');

  console.log(`Found ${discussions.length} Mock Discussions to backfill`);

  for (const discussion of discussions) {
    try {
      // Fetch prerequisites from HubSpot
      const prereqIds = await hubspot.getMockExamPrerequisites(discussion.hubspot_id);

      if (prereqIds.length > 0) {
        // Set in Supabase
        await supabaseAdmin.rpc('set_exam_prerequisites', {
          p_exam_id: discussion.hubspot_id,
          p_prerequisite_ids: prereqIds
        });
        console.log(`✅ ${discussion.hubspot_id}: ${prereqIds.length} prerequisites`);
      }
    } catch (err) {
      console.error(`❌ ${discussion.hubspot_id}: ${err.message}`);
    }
  }

  console.log('Backfill complete');
}

backfillPrerequisites();
```

---

## Dependencies

1. SQL scripts must be run before backend changes
2. RPC functions must exist before backend uses them
3. Backend changes must be deployed before frontend changes
4. Backfill should run after backend is deployed

---

## Acceptance Criteria

1. ✅ `prerequisite_exam_ids` column exists in `hubspot_mock_exams`
2. ✅ Delta-based update endpoint works with add/remove arrays
3. ✅ Unchanged prerequisites are preserved during partial updates
4. ✅ User booking validation reads from Supabase (10x faster)
5. ✅ HubSpot associations stay in sync (fire-and-forget)
6. ✅ Admin checkbox UI correctly calculates delta
7. ✅ Cron job populates prerequisites during exam sync
