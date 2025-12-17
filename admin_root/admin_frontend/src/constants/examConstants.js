/**
 * Centralized constants for mock exam related options
 * Single source of truth for dropdowns, filters, and validation
 */

// Mock Type Options
export const MOCK_TYPE_OPTIONS = [
  { value: 'Situational Judgment', label: 'Situational Judgment' },
  { value: 'Clinical Skills', label: 'Clinical Skills' },
  { value: 'Mock Discussion', label: 'Mock Discussion' },
  { value: 'Mini-mock', label: 'Mini-mock' }
];

// Location Options
export const LOCATION_OPTIONS = [
  { value: 'Mississauga', label: 'Mississauga' },
  { value: 'Mississauga - B9', label: 'Mississauga - B9' },
  { value: 'Mississauga - Lab D', label: 'Mississauga - Lab D' },
  { value: 'Vancouver', label: 'Vancouver' },
  { value: 'Montreal', label: 'Montreal' },
  { value: 'Calgary', label: 'Calgary' },
  { value: 'Richmond Hill', label: 'Richmond Hill' },
  { value: 'Online', label: 'Online' }
];

// Mock Set Options (A-H)
export const MOCK_SET_OPTIONS = [
  { value: 'A', label: 'Set A' },
  { value: 'B', label: 'Set B' },
  { value: 'C', label: 'Set C' },
  { value: 'D', label: 'Set D' },
  { value: 'E', label: 'Set E' },
  { value: 'F', label: 'Set F' },
  { value: 'G', label: 'Set G' },
  { value: 'H', label: 'Set H' }
];

// Exam types that show mock_set field
// Note: Mini-mock is explicitly excluded
export const MOCK_SET_APPLICABLE_TYPES = [
  'Clinical Skills',
  'Situational Judgment',
  'Mock Discussion'
];

// Booking Status Options
export const BOOKING_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Completed', label: 'Completed' }
];

// Exam Status Options (is_active field - stored as string in HubSpot/Supabase)
export const EXAM_STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
  { value: 'scheduled', label: 'Scheduled' }
];

// Attendance Options
export const ATTENDANCE_OPTIONS = [
  { value: 'Present', label: 'Present' },
  { value: 'Did Not Attend', label: 'Did Not Attend' },
];

// Dominant Hand Options (for Clinical Skills)
export const DOMINANT_HAND_OPTIONS = [
  { value: 'Right', label: 'Right' },
  { value: 'Left', label: 'Left' }
];

// Helper arrays for validation and simple iterations
export const MOCK_TYPES = MOCK_TYPE_OPTIONS.map(o => o.value);
export const LOCATIONS = LOCATION_OPTIONS.map(o => o.value);
export const MOCK_SETS = MOCK_SET_OPTIONS.map(o => o.value);
export const BOOKING_STATUSES = BOOKING_STATUS_OPTIONS.map(o => o.value);
export const EXAM_STATUSES = EXAM_STATUS_OPTIONS.map(o => o.value);
export const ATTENDANCE_VALUES = ATTENDANCE_OPTIONS.map(o => o.value);
export const DOMINANT_HANDS = DOMINANT_HAND_OPTIONS.map(o => o.value);

// Default values
export const DEFAULT_LOCATION = 'Mississauga';
export const DEFAULT_CAPACITY = 15;

// Export all as default for convenient imports
export default {
  MOCK_TYPE_OPTIONS,
  LOCATION_OPTIONS,
  MOCK_SET_OPTIONS,
  MOCK_SET_APPLICABLE_TYPES,
  BOOKING_STATUS_OPTIONS,
  EXAM_STATUS_OPTIONS,
  ATTENDANCE_OPTIONS,
  DOMINANT_HAND_OPTIONS,
  MOCK_TYPES,
  LOCATIONS,
  MOCK_SETS,
  BOOKING_STATUSES,
  EXAM_STATUSES,
  ATTENDANCE_VALUES,
  DOMINANT_HANDS,
  DEFAULT_LOCATION,
  DEFAULT_CAPACITY
};
