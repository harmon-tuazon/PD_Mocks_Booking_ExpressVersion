# Three-State Status System Test Checklist

## Summary of Changes
The frontend has been updated to support the new three-state status system where `is_active` is now a string with three possible values:
- `"active"` - Session is active and available for booking
- `"inactive"` - Session is inactive and not available for booking
- `"scheduled"` - Session will activate automatically at a scheduled time

## Changes Made

### 1. MockExams Form Component (`src/pages/MockExams.jsx`)
- ✅ Updated initial form state to use `is_active: 'active'` instead of `true`
- ✅ Updated form submission logic to set `is_active: 'scheduled'` when scheduling activation
- ✅ Updated the Active/Inactive dropdown to use string values
- ✅ Reset form now uses `is_active: 'active'` as default

### 2. SessionRow Component (`src/components/admin/SessionRow.jsx`)
- ✅ Updated nested view status indicator to handle three string states
- ✅ Updated regular view status indicator to handle three string states
- ✅ Shows appropriate icons and colors for each state:
  - Green dot + "Active" for `is_active === "active"`
  - Gray dot + "Inactive" for `is_active === "inactive"`
  - Blue clock + "Scheduled" for `is_active === "scheduled"`

### 3. FilterBar Component (`src/components/admin/FilterBar.jsx`)
- ✅ Already sending correct string values for filters ("active", "inactive", "scheduled")

### 4. BulkToggleActiveModal Component (`src/components/admin/BulkToggleActiveModal.jsx`)
- ✅ Updated to count sessions with string status values
- ✅ Maintains backward compatibility with boolean values
- ✅ Note: Scheduled sessions are not toggled (they maintain their scheduled state)

### 5. ExamDetailsForm Component (`src/components/admin/ExamDetailsForm.jsx`)
- ✅ Updated checkbox to handle string status values
- ✅ Prevents editing when status is "scheduled"
- ✅ Shows appropriate colors and labels for each state
- ✅ StatusBadge integration updated

### 6. StatusBadge Component (`src/components/admin/StatusBadge.jsx`)
- ✅ Added "scheduled" case with blue styling

### 7. Utility Files
- ✅ `examValidation.js`: Removed boolean conversion for `is_active`
- ✅ `CreateBookingButton.jsx`: Updated to check for `is_active === 'active'`
- ✅ `useExamEdit.js`: Default value changed to `'active'`

## Testing Instructions

### 1. Create New Mock Exam
1. Navigate to Mock Exams Management
2. Create a new exam with "Activate Immediately" selected
   - Verify `is_active` is set to `"active"` in the request
3. Create another exam with "Schedule Activation" selected
   - Verify `is_active` is set to `"scheduled"` in the request
   - Verify scheduled datetime is included

### 2. View Mock Exams List
1. Navigate to Mock Exams Dashboard
2. Verify status indicators display correctly:
   - Active sessions show green dot
   - Inactive sessions show gray dot
   - Scheduled sessions show blue clock icon with activation time

### 3. Filter Mock Exams
1. Use the Status filter dropdown
2. Select "Active" - should filter by `is_active === "active"`
3. Select "Inactive" - should filter by `is_active === "inactive"`
4. Select "Scheduled" - should filter by `is_active === "scheduled"`

### 4. Edit Mock Exam
1. Open exam details
2. For active/inactive exams:
   - Checkbox should be editable
   - Toggling should switch between "active" and "inactive"
3. For scheduled exams:
   - Checkbox should be disabled
   - Should show "Scheduled" label in blue

### 5. Bulk Toggle Status
1. Select multiple sessions
2. Use bulk toggle action
3. Verify:
   - Active sessions become inactive
   - Inactive sessions become active
   - Scheduled sessions are not affected

## API Contract
The backend should now return and accept:
```json
{
  "is_active": "active" | "inactive" | "scheduled",
  "scheduled_activation_datetime": "2025-01-15T10:00:00Z" // if scheduled
}
```

## Backward Compatibility
The frontend maintains backward compatibility by checking for both:
- New string format: `is_active === "active"`
- Legacy boolean format: `is_active === true`
- Legacy string boolean: `is_active === "true"`

This ensures the system works during the transition period.