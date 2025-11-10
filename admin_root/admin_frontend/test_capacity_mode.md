# Flexible Capacity Mode Feature Test Plan

## Implementation Summary
The flexible capacity mode feature has been successfully implemented for mock exam session creation. This allows admins to either set one capacity for all time slots (global mode) or set capacity per individual time slot (per-slot mode).

## Files Modified

### 1. **MockExams.jsx** (admin_root/admin_frontend/src/pages/MockExams.jsx)
- Added `capacityMode` state to track whether capacity is global or per-slot
- Updated `timeSlots` state to include capacity field
- Added capacity mode selector UI with dropdown
- Modified `handleSubmit` to pass capacity based on selected mode
- Updated `resetForm` to reset capacity mode
- Modified `isFormValid` to validate capacity based on mode
- Passed `capacityMode` and `globalCapacity` props to TimeSlotBuilder
- Passed `capacityMode` prop to MockExamPreview

### 2. **TimeSlotBuilder.jsx** (admin_root/admin_frontend/src/components/admin/TimeSlotBuilder.jsx)
- Added `capacityMode` and `globalCapacity` props
- Updated `addTimeSlot` to include capacity field
- Modified grid layout to show capacity field when in per-slot mode
- Added Input component import for capacity field
- Implemented dynamic grid columns based on capacity mode

### 3. **MockExamPreview.jsx** (admin_root/admin_frontend/src/components/admin/MockExamPreview.jsx)
- Added `capacityMode` prop with default value
- Updated preview logic to use correct capacity based on mode
- Modified getPreviewItems to handle per-slot capacity

### 4. **adminApi.js** (admin_root/admin_frontend/src/services/adminApi.js)
- Updated `createBulk` function signature to accept capacityMode parameter
- Modified API request to include capacityMode in request body

## Testing Checklist

### UI/UX Tests
- [x] Capacity mode selector appears after Capacity field
- [x] Default mode is set to "Apply to All Time Slots" (global)
- [x] Capacity field is enabled when global mode is selected
- [x] Capacity field is disabled when per-slot mode is selected
- [x] Help text appears under capacity field when per-slot mode is selected
- [x] Help text appears under capacity mode selector when global mode is selected

### Time Slot Builder Tests
- [x] Time slot grid shows 2 columns (Start Time, End Time) in global mode
- [x] Time slot grid shows 3 columns (Start Time, End Time, Capacity) in per-slot mode
- [x] New time slots inherit global capacity value
- [x] Capacity field appears for each time slot in per-slot mode
- [x] Capacity values can be edited individually in per-slot mode

### Form Validation Tests
- [x] Form validates correctly with global capacity mode
- [x] Form validates correctly with per-slot capacity mode
- [x] Form requires all capacity fields to be filled in per-slot mode
- [x] Form accepts capacity = 0 as invalid (min is 1)

### Data Submission Tests
- [x] Single session creation uses correct capacity based on mode
- [x] Bulk creation includes capacityMode in request
- [x] Global mode sends capacity in commonProperties
- [x] Per-slot mode sends capacity in each timeSlot object
- [x] API service correctly passes capacityMode parameter

### Preview Tests
- [x] Preview shows correct capacity for single session
- [x] Preview shows correct capacity for multiple sessions
- [x] Preview displays individual capacities in per-slot mode
- [x] Preview displays global capacity in global mode

## Backend Requirements
The backend API endpoints need to be updated to handle the new capacity mode:

1. **Single Creation Endpoint** (`/admin/mock-exams/create`)
   - Already handles capacity field, no changes needed

2. **Bulk Creation Endpoint** (`/admin/mock-exams/bulk-create`)
   - Needs to handle `capacityMode` parameter
   - When `capacityMode` is 'global', use capacity from commonProperties
   - When `capacityMode` is 'per-slot', use capacity from each timeSlot object

## Sample API Requests

### Global Mode Request
```json
{
  "commonProperties": {
    "mock_type": "Situational Judgment",
    "exam_date": "2024-03-15",
    "capacity": 20,
    "location": "Mississauga",
    "is_active": true
  },
  "timeSlots": [
    { "start_time": "09:00", "end_time": "11:00", "capacity": 20 },
    { "start_time": "14:00", "end_time": "16:00", "capacity": 20 }
  ],
  "capacityMode": "global"
}
```

### Per-Slot Mode Request
```json
{
  "commonProperties": {
    "mock_type": "Clinical Skills",
    "exam_date": "2024-03-15",
    "location": "Toronto",
    "is_active": true
  },
  "timeSlots": [
    { "start_time": "09:00", "end_time": "11:00", "capacity": 15 },
    { "start_time": "14:00", "end_time": "16:00", "capacity": 25 }
  ],
  "capacityMode": "per-slot"
}
```

## Deployment Notes
1. Build successful with no compilation errors
2. All TypeScript/JavaScript syntax is valid
3. No breaking changes to existing functionality
4. Backward compatible with existing mock exam data