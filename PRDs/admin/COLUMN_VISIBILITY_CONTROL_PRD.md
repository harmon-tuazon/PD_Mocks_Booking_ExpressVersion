# PRD: Dynamic Column Visibility Control for Mock Exam Details Bookings Table

**Feature Name**: Dynamic Column Visibility Control
**Module**: Admin Dashboard - Mock Exam Details View
**Priority**: Medium
**Status**: Draft
**Created**: 2025-01-04
**Author**: System Generated PRD
**Framework Version**: 2.0.0

---

## 📋 Executive Summary

Enable admin users to customize which columns are visible in the bookings table within the mock exam details view. This feature provides a dropdown checklist menu allowing dynamic show/hide control of columns, improving data visibility and user experience for admins managing exam bookings.

### Key Benefits
- **Improved UX**: Admins can focus on relevant data by hiding unnecessary columns
- **Flexibility**: Customize view based on current task (e.g., attendance marking vs. general review)
- **Performance**: Reduce visual clutter and cognitive load
- **Client-Side Only**: Zero additional API calls - all data already fetched

---

## 🎯 Problem Statement

### Current State
The mock exam details view displays a bookings table with 12 columns (when in admin mode with `hideTraineeInfo=false`). All columns are always visible, leading to:
- Information overload when only specific data is needed
- Horizontal scrolling on smaller screens
- Difficulty focusing on specific data points during targeted tasks
- Fixed column/row sizing regardless of data density
- Duplicate "Dominant Hand" column display bug

### Desired State
Admins can selectively show/hide columns (except fixed columns) via an intuitive dropdown checklist, with:
- Only 3 columns visible by default (Time, Token Used, Booking Date)
- Persistent column preferences (session-based)
- Dynamic column reordering based on selection order
- **Adaptive sizing based on visible column count**
- **Sticky positioning for fixed columns during horizontal scroll**
- No impact on existing functionality (sorting, pagination, search)
- Single instance of Dominant Hand column (duplicate bug fixed)

### Success Criteria
- ✅ Admins can toggle column visibility via dropdown menu
- ✅ Fixed columns (Name, Email, Student ID) always visible and sticky during horizontal scroll
- ✅ Default view shows only 3 columns: Time, Token Used, Booking Date
- ✅ Column order matches selection order in dropdown
- ✅ Column preferences persist during session
- ✅ No additional API calls required
- ✅ **Dynamic sizing adapts based on column count (large/medium/small)**
- ✅ **Horizontal scroll enabled for 7+ columns**
- ✅ Dark mode fully supported
- ✅ Responsive design maintained

---

## 📊 Current Implementation Analysis

### Existing Bookings Table Columns

**Location**: `admin_root/admin_frontend/src/components/admin/BookingsTable.jsx`

#### Fixed Columns (Always Visible)
| Column | Property | Sortable | Notes |
|--------|----------|----------|-------|
| Name | `first_name`, `last_name`, `name` | ✅ Yes | Core identifier |
| Email | `email` | ✅ Yes | Core identifier |
| Student ID | `student_id` | ✅ Yes | Core identifier |

#### Dynamic Columns (Toggleable)
| # | Column | Property | Sortable | Default Visible | Notes |
|---|--------|----------|----------|----------------|-------|
| 1 | Dominant Hand | `dominant_hand` | ✅ Yes | ❌ No | Hidden by default |
| 2 | Mock Type | `mock_exam_type` | ✅ Yes | ❌ No | Hidden by default |
| 3 | Exam Date | `exam_date` | ✅ Yes | ❌ No | Hidden by default |
| 4 | Time | `start_time`, `end_time` | ❌ No | ✅ Yes | Visible by default |
| 5 | Location | `attending_location` | ✅ Yes | ❌ No | Hidden by default |
| 6 | Attendance | `attendance` | ❌ No | ❌ No | Hidden by default |
| 7 | Status | `is_active` (computed) | ❌ No | ❌ No | Hidden by default |
| 8 | Token Used | `token_used` | ✅ Yes | ✅ Yes | Visible by default |
| 9 | Booking Date | `booking_date` | ✅ Yes | ✅ Yes | Visible by default |

**Note**: Duplicate "Dominant Hand" column bug has been resolved. Only one instance of this column will be displayed.

### Data Fetching Analysis

**API Endpoint**: `admin_root/api/admin/mock-exams/[id]/bookings.js`
**Batch Properties Fetched** (lines 173-188):
```javascript
properties: [
  'booking_id',
  'name',
  'email',
  'student_id',
  'dominant_hand',
  'contact_id',
  'booking_status',
  'attendance',
  'attending_location',
  'token_used',
  'ndecc_exam_date',
  'is_active',
  'hs_createdate',
  'hs_lastmodifieddate'
]
```

**✅ Confirmation**: All properties needed for column display are already fetched in the initial batch API call. No additional API calls required for this feature.

---

## 🎨 Feature Design

### User Interface Components

#### 1. Column Visibility Dropdown
**Location**: Above the bookings table, aligned right next to search bar

**Design Specifications**:
```
┌─────────────────────────────────────────────────┐
│  Search Bar                   [Columns ▼]       │
└─────────────────────────────────────────────────┘
```

**Dropdown Opened**:
```
┌─────────────────────────────────────────────────┐
│  Search Bar                   [Columns ▲]       │
│                               ┌─────────────────┤
│                               │ ☑ Dominant Hand │
│                               │ ☑ Mock Type     │
│                               │ ☑ Exam Date     │
│                               │ ☑ Time          │
│                               │ ☑ Location      │
│                               │ ☑ Attendance    │
│                               │ ☑ Status        │
│                               │ ☑ Token Used    │
│                               │ ☑ Booking Date  │
│                               │                 │
│                               │ [Reset Defaults]│
│                               └─────────────────┘
└─────────────────────────────────────────────────┘
```

#### 2. Column Toggle Behavior

**Selection Logic**:
- Click checkbox to toggle column visibility
- Columns appear in order of selection (first selected = leftmost)
- Unselecting removes column from view
- Fixed columns (Name, Email, Student ID) always shown first, not in dropdown

**Default State**:
- Only 3 dynamic columns visible by default: **Token Used**, **Booking Date**, and **Time**
- All other dynamic columns hidden by default (user must manually enable)
- This provides a clean, focused initial view with essential booking information

#### 3. Persistence Strategy

**Session Storage** (Client-Side Only):
```javascript
// Storage key format
const STORAGE_KEY = 'admin:mock-exam-detail:column-visibility';

// Storage value format
{
  visibleColumns: ['time', 'token_used', 'booking_date'],
  columnOrder: ['time', 'token_used', 'booking_date'],
  timestamp: 1704398400000
}
```

**Persistence Behavior**:
- Save on every column toggle
- Load on component mount
- Clear on logout (handled by existing auth flow)
- Per-user session (tied to browser session)

#### 4. Dynamic Sizing Behavior

**Adaptive Column and Row Sizing**:
The table dynamically adjusts column widths, row heights, and font sizes based on the number of visible columns to optimize readability and information density.

**Sizing Logic**:
```javascript
// Calculate total dynamic columns (excluding fixed Name, Email, Student ID)
const dynamicColumnCount = visibleColumns.length;

// Determine size class based on column count
const getSizeClass = () => {
  if (dynamicColumnCount <= 3) return 'size-large';      // 3 or fewer: Large
  if (dynamicColumnCount <= 6) return 'size-medium';     // 4-6: Medium
  return 'size-small';                                    // 7+: Small
};
```

**Size Classes**:

| Columns Visible | Size Class | Row Height | Font Size | Column Padding | Behavior |
|----------------|------------|------------|-----------|----------------|----------|
| 3 or fewer | `size-large` | `py-4` (1rem) | `text-sm` (0.875rem) | `px-6` (1.5rem) | Spacious, easy to read |
| 4-6 | `size-medium` | `py-3` (0.75rem) | `text-xs` (0.75rem) | `px-4` (1rem) | Balanced density |
| 7+ | `size-small` | `py-2` (0.5rem) | `text-xs` (0.75rem) | `px-3` (0.75rem) | Compact, horizontal scroll OK |

**Horizontal Scroll**:
- When 7+ columns are visible, horizontal scrolling is acceptable and expected
- Table container uses `overflow-x-auto` for smooth scrolling
- Fixed columns (Name, Email, Student ID) remain visible during horizontal scroll (sticky positioning)

---

## 🔧 Technical Implementation

### Component Architecture

#### New Component: `ColumnVisibilityControl.jsx`

**Purpose**: Standalone dropdown component for column visibility management

**Location**: `admin_root/admin_frontend/src/components/admin/ColumnVisibilityControl.jsx`

**Props Interface**:
```typescript
interface ColumnVisibilityControlProps {
  availableColumns: ColumnDefinition[];
  visibleColumns: string[];
  onToggleColumn: (columnId: string) => void;
  onResetDefaults: () => void;
  disabled?: boolean;
}

interface ColumnDefinition {
  id: string;           // e.g., 'dominant_hand'
  label: string;        // e.g., 'Dominant Hand'
  sortable: boolean;
  defaultVisible: boolean;
}
```

**Key Features**:
- Dropdown built with shadcn/ui `DropdownMenu` component
- Checkbox list using shadcn/ui `Checkbox` component
- "Reset Defaults" button to restore original state
- Dark mode support via Tailwind CSS
- Disabled state during attendance/cancellation modes

#### Modified Component: `BookingsTable.jsx`

**Changes Required**:
1. **Add Column Visibility State**
   ```javascript
   const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
   const [columnOrder, setColumnOrder] = useState([]);
   ```

2. **Add Column Definitions**
   ```javascript
   const COLUMN_DEFINITIONS = [
     { id: 'dominant_hand', label: 'Dominant Hand', sortable: true, defaultVisible: false },
     { id: 'mock_type', label: 'Mock Type', sortable: true, defaultVisible: false },
     { id: 'exam_date', label: 'Exam Date', sortable: true, defaultVisible: false },
     { id: 'time', label: 'Time', sortable: false, defaultVisible: true },
     { id: 'location', label: 'Location', sortable: true, defaultVisible: false },
     { id: 'attendance', label: 'Attendance', sortable: false, defaultVisible: false },
     { id: 'status', label: 'Status', sortable: false, defaultVisible: false },
     { id: 'token_used', label: 'Token Used', sortable: true, defaultVisible: true },
     { id: 'booking_date', label: 'Booking Date', sortable: true, defaultVisible: true }
   ];
   ```

3. **Add Persistence Hook**
   ```javascript
   useEffect(() => {
     // Load from session storage on mount
     const savedPreferences = sessionStorage.getItem(STORAGE_KEY);
     if (savedPreferences) {
       const { visibleColumns, columnOrder } = JSON.parse(savedPreferences);
       setVisibleColumns(visibleColumns);
       setColumnOrder(columnOrder);
     }
   }, []);

   useEffect(() => {
     // Save to session storage on change
     sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
       visibleColumns,
       columnOrder,
       timestamp: Date.now()
     }));
   }, [visibleColumns, columnOrder]);
   ```

4. **Render Control Component**
   ```javascript
   {!hideSearch && !isSelectionMode && (
     <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <div className="flex items-center justify-between">
         {/* Search Bar */}
         <div className="relative md:w-80">
           {/* ... existing search bar ... */}
         </div>

         {/* Column Visibility Control */}
         <ColumnVisibilityControl
           availableColumns={COLUMN_DEFINITIONS}
           visibleColumns={visibleColumns}
           onToggleColumn={handleToggleColumn}
           onResetDefaults={handleResetDefaults}
           disabled={isSelectionMode}
         />
       </div>
     </div>
   )}
   ```

5. **Dynamic Column Rendering with Adaptive Sizing**
   ```javascript
   {/* Calculate size class based on visible column count */}
   const sizeClass = (() => {
     const count = visibleColumns.length;
     if (count <= 3) return 'size-large';
     if (count <= 6) return 'size-medium';
     return 'size-small';
   })();

   const getCellPadding = () => {
     switch (sizeClass) {
       case 'size-large': return 'px-6 py-4';
       case 'size-medium': return 'px-4 py-3';
       case 'size-small': return 'px-3 py-2';
       default: return 'px-4 py-3';
     }
   };

   const getFontSize = () => {
     return sizeClass === 'size-large' ? 'text-sm' : 'text-xs';
   };

   {/* Render columns based on visibility and order */}
   {columnOrder
     .filter(colId => visibleColumns.includes(colId))
     .map(colId => {
       const column = COLUMN_DEFINITIONS.find(c => c.id === colId);
       const cellClasses = `${getCellPadding()} ${getFontSize()} text-center`;

       if (column.sortable) {
         return <SortableHeader
           key={colId}
           column={colId}
           align="center"
           className={cellClasses}
         >
           {column.label}
         </SortableHeader>;
       } else {
         return <th key={colId} scope="col" className={cellClasses}>
           {column.label}
         </th>;
       }
     })}
   ```

#### Modified Component: `BookingRow.jsx`

**Changes Required**:
1. **Add Props**
   ```javascript
   const BookingRow = ({
     booking,
     visibleColumns = [],  // NEW
     columnOrder = [],     // NEW
     sizeClass = 'size-medium',  // NEW - size class from parent
     // ... existing props
   }) => {
   ```

2. **Dynamic Cell Rendering with Adaptive Sizing**
   ```javascript
   // Get dynamic sizing classes based on size class
   const getCellClasses = () => {
     const baseClasses = 'whitespace-nowrap text-center';
     switch (sizeClass) {
       case 'size-large':
         return `${baseClasses} px-6 py-4 text-sm`;
       case 'size-medium':
         return `${baseClasses} px-4 py-3 text-xs`;
       case 'size-small':
         return `${baseClasses} px-3 py-2 text-xs`;
       default:
         return `${baseClasses} px-4 py-3 text-xs`;
     }
   };

   const cellClasses = getCellClasses();

   {/* Render cells based on visibility and order */}
   {columnOrder
     .filter(colId => visibleColumns.includes(colId))
     .map(colId => renderCell(colId, booking, cellClasses))}
   ```

3. **Cell Renderer Function with Dynamic Sizing**
   ```javascript
   const renderCell = (columnId, booking, cellClasses) => {
     switch (columnId) {
       case 'dominant_hand':
         return <td key={columnId} className={cellClasses}>
           <div className="text-gray-900 dark:text-gray-100">
             {formatDominantHand(booking.dominant_hand)}
           </div>
         </td>;
       case 'mock_type':
         return <td key={columnId} className={cellClasses}>
           <div className="text-gray-900 dark:text-gray-100">
             {booking.mock_exam_type || '-'}
           </div>
         </td>;
       case 'time':
         return <td key={columnId} className={cellClasses}>
           <div className="text-gray-900 dark:text-gray-100">
             {booking.start_time && booking.end_time
               ? `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`
               : '-'}
           </div>
         </td>;
       case 'token_used':
         return <td key={columnId} className={cellClasses}>
           <div className="text-gray-900 dark:text-gray-100">
             {booking.token_used || '-'}
           </div>
         </td>;
       case 'booking_date':
         return <td key={columnId} className={cellClasses}>
           <div className="text-gray-500 dark:text-gray-400">
             {formatBookingDate(booking.booking_date)}
           </div>
           {booking.booking_date && (
             <div className="text-gray-400 dark:text-gray-500 mt-1">
               {new Date(booking.booking_date).toLocaleDateString('en-US', {
                 month: 'short',
                 day: 'numeric',
                 year: 'numeric',
                 hour: '2-digit',
                 minute: '2-digit'
               })}
             </div>
           )}
         </td>;
       // ... cases for remaining columns (exam_date, location, attendance, status)
       default:
         return null;
     }
   };
   ```

**Note**: Fixed columns (Name, Email, Student ID) should use sticky positioning:
```javascript
<td className="sticky left-0 bg-white dark:bg-dark-card z-10 px-6 py-4">
  {/* Fixed column content */}
</td>
```

### Custom Hook: `useColumnVisibility`

**Purpose**: Encapsulate column visibility logic and persistence

**Location**: `admin_root/admin_frontend/src/hooks/useColumnVisibility.js`

**Implementation**:
```javascript
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'admin:mock-exam-detail:column-visibility';

const DEFAULT_COLUMNS = [
  'time',
  'token_used',
  'booking_date'
];

export const useColumnVisibility = (columnDefinitions) => {
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);

  // Load from session storage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { visibleColumns, columnOrder } = JSON.parse(saved);
        setVisibleColumns(visibleColumns);
        setColumnOrder(columnOrder);
      }
    } catch (error) {
      console.error('Failed to load column preferences:', error);
    }
  }, []);

  // Save to session storage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        visibleColumns,
        columnOrder,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save column preferences:', error);
    }
  }, [visibleColumns, columnOrder]);

  // Toggle column visibility
  const toggleColumn = useCallback((columnId) => {
    setVisibleColumns(prev => {
      const isVisible = prev.includes(columnId);

      if (isVisible) {
        // Remove from visible columns
        const updated = prev.filter(id => id !== columnId);
        // Also remove from order
        setColumnOrder(order => order.filter(id => id !== columnId));
        return updated;
      } else {
        // Add to visible columns
        const updated = [...prev, columnId];
        // Add to end of order
        setColumnOrder(order => [...order, columnId]);
        return updated;
      }
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setVisibleColumns(DEFAULT_COLUMNS);
    setColumnOrder(DEFAULT_COLUMNS);
  }, []);

  // Check if column is visible
  const isColumnVisible = useCallback((columnId) => {
    return visibleColumns.includes(columnId);
  }, [visibleColumns]);

  return {
    visibleColumns,
    columnOrder,
    toggleColumn,
    resetToDefaults,
    isColumnVisible
  };
};
```

---

## 🎯 Implementation Plan

### Phase 1: Core Component Development (4 hours)

**Tasks**:
1. Create `ColumnVisibilityControl.jsx` component
   - Dropdown UI with shadcn/ui components
   - Checkbox list for columns
   - Reset defaults button
   - Dark mode styling

2. Create `useColumnVisibility` custom hook
   - State management
   - Session storage persistence
   - Toggle/reset logic

3. Add column definitions to `BookingsTable.jsx`
   - Define `COLUMN_DEFINITIONS` array
   - Add storage key constant

**Deliverables**:
- `ColumnVisibilityControl.jsx` component
- `useColumnVisibility.js` hook
- Column definitions in `BookingsTable.jsx`

**Testing**:
- Component renders correctly
- Dropdown opens/closes properly
- Checkboxes toggle correctly
- Reset button works

### Phase 2: BookingsTable Integration (5 hours)

**Tasks**:
1. Integrate `useColumnVisibility` hook in `BookingsTable.jsx`
   - Initialize hook with column definitions
   - Wire up toggle handlers
   - Add control component to UI

2. Implement dynamic sizing logic
   - Calculate size class based on visible column count
   - Apply size classes to table headers and rows
   - Add getCellPadding() and getFontSize() helper functions

3. Modify table header rendering
   - Dynamic column rendering based on visibility
   - Maintain sortable header functionality
   - Apply adaptive sizing classes
   - Implement sticky positioning for fixed columns

4. Update `BookingRow.jsx` component
   - Accept `visibleColumns`, `columnOrder`, and `sizeClass` props
   - Implement dynamic cell rendering with adaptive sizing
   - Create cell renderer function with size-aware classes
   - Add sticky positioning for fixed columns

**Deliverables**:
- Updated `BookingsTable.jsx` with dynamic headers and sizing
- Updated `BookingRow.jsx` with dynamic cells and sizing
- Integrated `ColumnVisibilityControl` component
- Sticky column positioning for fixed columns

**Testing**:
- Columns show/hide correctly
- Column order matches selection order
- Sorting still works on visible columns
- Fixed columns always visible
- **Sizing adapts correctly (large/medium/small)**
- **Horizontal scroll works with 7+ columns**
- **Fixed columns remain visible during horizontal scroll**

### Phase 3: Polish & Edge Cases (3 hours)

**Tasks**:
1. Handle edge cases
   - All columns hidden scenario (show only fixed columns with message)
   - Selection/cancellation mode compatibility
   - Responsive behavior on mobile
   - Horizontal scroll with sticky columns

2. Add visual polish
   - Loading states
   - Smooth transitions for size changes
   - Tooltips for column controls
   - Accessibility (ARIA labels)
   - Visual indicator for horizontal scrollability

3. Performance optimization
   - Memoize column rendering
   - Memoize size class calculation
   - Optimize re-renders with useCallback
   - Debounce storage writes if needed

4. Dynamic sizing refinements
   - Test with various column combinations
   - Ensure smooth transitions between size classes
   - Verify sticky column behavior
   - Test horizontal scroll on different browsers

**Deliverables**:
- Edge case handling
- Visual polish and transitions
- Performance optimizations
- Refined dynamic sizing behavior

**Testing**:
- Test on mobile viewport
- Test in attendance mode
- Test in cancellation mode
- Test with all columns hidden
- **Test with 3, 6, and 9+ columns visible**
- **Test horizontal scroll with sticky columns**
- **Verify smooth size transitions**

### Phase 4: Testing & Documentation (2 hours)

**Tasks**:
1. Manual testing
   - Full user flow testing
   - Cross-browser testing
   - Dark mode testing
   - Responsive design testing

2. Documentation
   - Update component JSDoc comments
   - Add usage examples
   - Document storage format
   - Update README if needed

3. Code cleanup
   - Remove console logs
   - Format code
   - Add TypeScript types (if using TS)
   - Final review

**Deliverables**:
- Tested feature
- Updated documentation
- Clean, production-ready code

**Testing**:
- All manual test cases passed
- No console errors
- Dark mode fully functional
- Responsive on all viewports

---

## 📐 Design Specifications

### Visual Design

#### Dropdown Button
```css
/* Light Mode */
.column-control-button {
  background: white;
  border: 1px solid #e5e7eb; /* gray-200 */
  color: #374151; /* gray-700 */
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  hover: {
    background: #f9fafb; /* gray-50 */
    border-color: #d1d5db; /* gray-300 */
  }
}

/* Dark Mode */
.dark .column-control-button {
  background: #1f2937; /* dark-card */
  border: 1px solid #374151; /* gray-700 */
  color: #e5e7eb; /* gray-200 */
  hover: {
    background: #111827; /* gray-900 */
    border-color: #4b5563; /* gray-600 */
  }
}
```

#### Dropdown Menu
```css
/* Light Mode */
.column-control-menu {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
  min-width: 200px;
  max-height: 400px;
  overflow-y: auto;
}

/* Dark Mode */
.dark .column-control-menu {
  background: #1f2937;
  border: 1px solid #374151;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
}
```

#### Checkbox Items
```css
.column-checkbox-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.15s;

  hover: {
    background: #f3f4f6; /* gray-100 */
  }
}

.dark .column-checkbox-item:hover {
  background: #374151; /* gray-700 */
}

.column-checkbox-label {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  color: #374151; /* gray-700 */
}

.dark .column-checkbox-label {
  color: #e5e7eb; /* gray-200 */
}
```

#### Reset Button
```css
.column-reset-button {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #6b7280; /* gray-500 */
  text-align: center;
  cursor: pointer;

  hover: {
    color: #374151; /* gray-700 */
    background: #f3f4f6; /* gray-100 */
  }
}

.dark .column-reset-button {
  border-top-color: #374151;
  color: #9ca3af; /* gray-400 */

  hover: {
    color: #e5e7eb; /* gray-200 */
    background: #374151; /* gray-700 */
  }
}
```

### Responsive Behavior

#### Desktop (≥1024px)
- Dropdown button aligned right of search bar
- Full column labels visible
- Dropdown width: 250px
- Table sizing: Full dynamic sizing support (large/medium/small)
- Horizontal scroll smooth and intuitive

#### Tablet (768px - 1023px)
- Dropdown button below search bar
- Abbreviated column labels if needed
- Dropdown width: 220px
- Table sizing: Medium size enforced for readability
- Horizontal scroll with touch support

#### Mobile (<768px)
- Dropdown button full width below search
- Short column labels
- Dropdown width: 100%
- Max height: 300px with scroll
- Table sizing: Small size enforced
- Horizontal scroll optimized for touch
- Fixed columns sticky on horizontal scroll

### Dynamic Table Sizing CSS

#### Size Class Utilities
```css
/* Table Container */
.table-container {
  overflow-x: auto;
  position: relative;
}

/* Size Large (3 or fewer columns) */
.table-size-large th,
.table-size-large td {
  padding: 1rem 1.5rem;
  font-size: 0.875rem; /* 14px */
  line-height: 1.25rem;
}

/* Size Medium (4-6 columns) */
.table-size-medium th,
.table-size-medium td {
  padding: 0.75rem 1rem;
  font-size: 0.75rem; /* 12px */
  line-height: 1rem;
}

/* Size Small (7+ columns) */
.table-size-small th,
.table-size-small td {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem; /* 12px */
  line-height: 1rem;
}

/* Sticky Fixed Columns */
.sticky-column {
  position: sticky;
  left: 0;
  z-index: 10;
  background: white;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.dark .sticky-column {
  background: #1f2937; /* dark-card */
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.2);
}

/* Smooth Transitions */
.table-size-transition {
  transition: padding 0.2s ease, font-size 0.2s ease;
}
```

---

## 🧪 Testing Strategy

### Unit Tests

**Component Tests** (`ColumnVisibilityControl.test.jsx`):
```javascript
describe('ColumnVisibilityControl', () => {
  test('renders all column options', () => {});
  test('toggles column visibility on checkbox click', () => {});
  test('resets to default on reset button click', () => {});
  test('disables control when disabled prop is true', () => {});
  test('applies correct dark mode styles', () => {});
});
```

**Hook Tests** (`useColumnVisibility.test.js`):
```javascript
describe('useColumnVisibility', () => {
  test('initializes with default columns', () => {});
  test('loads saved preferences from session storage', () => {});
  test('saves preferences to session storage on change', () => {});
  test('toggles column visibility correctly', () => {});
  test('maintains column order based on selection', () => {});
  test('resets to defaults correctly', () => {});
});
```

### Integration Tests

**BookingsTable Integration** (`BookingsTable.integration.test.jsx`):
```javascript
describe('BookingsTable with Column Visibility', () => {
  test('renders only visible columns', () => {});
  test('hides columns when toggled off', () => {});
  test('shows columns when toggled on', () => {});
  test('maintains column order based on selection', () => {});
  test('preserves sorting on visible columns', () => {});
  test('always shows fixed columns', () => {});
  test('persists column preferences across renders', () => {});
});
```

### Manual Test Cases

**Test Case 1: Basic Column Toggle**
1. Navigate to mock exam details page
2. Click "Columns" dropdown
3. Uncheck "Dominant Hand"
4. Verify column is hidden
5. Check "Dominant Hand" again
6. Verify column is shown

**Test Case 2: Column Order**
1. Hide all columns
2. Check "Booking Date" first
3. Check "Status" second
4. Check "Name" third (fixed, should be first)
5. Verify order: Name, Email, Student ID, Booking Date, Status

**Test Case 3: Persistence**
1. Toggle several columns off
2. Refresh page
3. Verify column preferences persist

**Test Case 4: Reset Defaults**
1. Toggle several columns off
2. Click "Reset Defaults"
3. Verify all columns are visible again

**Test Case 5: Responsive Design**
1. Test on desktop (1920px)
2. Test on tablet (768px)
3. Test on mobile (375px)
4. Verify dropdown renders correctly

**Test Case 6: Dark Mode**
1. Enable dark mode
2. Open column dropdown
3. Verify styling is correct
4. Toggle columns
5. Verify changes work in dark mode

**Test Case 7: Selection Mode Compatibility**
1. Enter attendance mode
2. Verify column control is disabled
3. Exit attendance mode
4. Verify column control is enabled

**Test Case 8: Dynamic Sizing**
1. Start with default 3 columns (Time, Token Used, Booking Date)
2. Verify size-large class applied (big rows, bigger fonts)
3. Add 3 more columns (total 6)
4. Verify size-medium class applied
5. Add 3 more columns (total 9)
6. Verify size-small class applied
7. Verify horizontal scroll appears and works smoothly
8. Verify fixed columns remain visible during scroll

**Test Case 9: Sticky Columns**
1. Enable 9+ columns
2. Scroll horizontally to the right
3. Verify Name, Email, Student ID remain visible (sticky)
4. Scroll back to the left
5. Verify sticky columns don't obscure other columns

**Test Case 10: Edge Cases**
1. Try hiding all dynamic columns
2. Verify table still renders with fixed columns only
3. Test with empty bookings list
4. Test with 100+ bookings
5. Test rapid column toggling (no visual glitches)
6. Test with only 1 dynamic column visible

---

## 🚀 Deployment Strategy

### Pre-Deployment Checklist
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete
- [ ] Dark mode verified
- [ ] Responsive design verified
- [ ] Code review complete
- [ ] Documentation updated
- [ ] Performance optimizations applied

### Deployment Steps

**Step 1: Code Merge**
- Create feature branch: `feature/column-visibility-control`
- Implement feature
- Pass all tests
- Code review and approval
- Merge to `main` or `trainee-dashboard-module`

**Step 2: Build & Deploy**
```bash
# Build admin frontend
cd admin_root
npm run build

# Deploy to Vercel
vercel --prod
```

**Step 3: Post-Deployment Verification**
- Verify feature works in production
- Check browser console for errors
- Test on production data
- Monitor for any issues

**Step 4: Rollback Plan** (If Needed)
- Revert merge commit
- Rebuild and redeploy previous version
- Clear session storage for affected users

---

## 📊 Success Metrics

### Quantitative Metrics
- **Adoption Rate**: % of admin users who use the feature within first week
- **Column Toggle Frequency**: Average number of column toggles per session
- **Most Hidden Columns**: Which columns are hidden most frequently
- **Session Persistence**: % of sessions where preferences are loaded from storage

### Qualitative Metrics
- **User Feedback**: Survey admin users on feature usefulness
- **Support Tickets**: Reduction in "too many columns" complaints
- **Task Efficiency**: Anecdotal feedback on improved workflow

### Performance Metrics
- **Render Time**: Table render time should not increase >50ms
- **Storage Size**: Session storage usage should be minimal (<1KB)
- **Re-render Count**: Minimize unnecessary re-renders on toggle

---

## 🔮 Future Enhancements

### Phase 2 Features (Post-MVP)
1. **Column Reordering via Drag & Drop**
   - Allow manual reordering of columns
   - More intuitive than selection order

2. **Saved Presets**
   - "Attendance View" preset (only attendance-relevant columns)
   - "Quick View" preset (minimal columns)
   - Custom user-defined presets

3. **Column Width Adjustment**
   - Resizable columns
   - Save width preferences

4. **Export with Current View**
   - Export to CSV with only visible columns
   - Match column order

5. **Keyboard Shortcuts**
   - Quick toggle for common columns
   - Keyboard navigation in dropdown

### Technical Debt Items
- ~~Fix duplicate "Dominant Hand" column bug~~ ✅ Resolved in v2.0
- Consider TypeScript for type safety
- Add unit tests for BookingRow cell rendering with dynamic sizing
- Consider moving to Context API if column visibility needed elsewhere
- Performance testing with 1000+ bookings and 9+ columns
- Add visual scroll indicators for horizontal scroll

---

## 🔒 Security Considerations

### Client-Side Storage
- **Risk**: Session storage is client-side, not encrypted
- **Mitigation**: Only store non-sensitive column preferences (no user data)
- **Impact**: Low risk - column visibility is not sensitive information

### XSS Protection
- **Risk**: Column labels could be injection vectors
- **Mitigation**: Use constants for column definitions (hardcoded labels)
- **Impact**: No risk - labels are static

### Session Hijacking
- **Risk**: Session storage accessible via XSS
- **Mitigation**: Existing XSS protections sufficient, no auth tokens stored
- **Impact**: Low risk - preferences only, no credentials

---

## 📚 References

### Related Documentation
- [Admin Dashboard README](../../admin_root/README.md)
- [BookingsTable Component](../../admin_root/admin_frontend/src/components/admin/BookingsTable.jsx)
- [API Documentation](../../admin_root/documentation/api/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

### Related PRDs
- [Mock Exam Detail View PRD](./admin-module-mock%20exam%20session%20page.md)
- [Attendance Tracking Feature PRD](./attendance-tracking-feature.md)

### Framework Resources
- [CLAUDE.md - Development Guidelines](../../CLAUDE.md)
- [Project Summary](../../PROJECT_SUMMARY.md)

---

## 🤝 Stakeholder Sign-Off

### Approvals Required
- [ ] Product Owner
- [ ] Lead Developer
- [ ] UX/UI Designer
- [ ] QA Lead

### Review Notes
_To be added during review process_

---

## 📝 Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-01-04 | 1.0 | System Generated | Initial PRD creation |
| 2025-01-04 | 2.0 | System Updated | **Major updates**: <br>• Removed duplicate Dominant Hand column<br>• Changed default visible columns to only: Time, Token Used, Booking Date<br>• Added dynamic sizing feature (adaptive row/column/font sizing)<br>• Added sticky column positioning for fixed columns<br>• Updated implementation plan to 14 hours (from 12)<br>• Enhanced responsive behavior specifications<br>• Added comprehensive sizing test cases |

---

**End of PRD**

_This document follows the PrepDoctors HubSpot Automation Framework standards for PRD creation._
