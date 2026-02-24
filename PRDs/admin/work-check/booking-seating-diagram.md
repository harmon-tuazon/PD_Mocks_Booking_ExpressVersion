# PRD: Work Check Booking Seating Diagram

## Overview

Add a "Seating Diagram" feature to the Work Check Bookings page (`/work-check/bookings`) that generates a visual seating chart showing all bookings for a given date and session, organized by **student group**, downloadable as a PDF. This is adapted from the prototype app's `GroupImageGenerator` component but styled to match the existing NDECC seating arrangement format.

## Entry Point

A secondary/outlined button labeled **"Seating Diagram"** placed immediately to the left of the existing "Create Booking" primary button in the page header of `WorkCheckBookings.jsx`.

```
[ Seating Diagram ]  [ + Create Booking ]
   (outlined)            (primary/filled)
```

## User Flow

1. Admin clicks "Seating Diagram" button
2. Modal opens with:
   - **Date picker** (defaults to today)
   - **Session toggle** (Morning / Afternoon / Both — defaults to Both)
3. Modal fetches bookings for the selected date and session
4. Canvas renders a visual seating diagram with one column per **group**
5. Each group column shows Morning and Afternoon sessions stacked vertically
6. Instructor name displayed above each group column
7. Admin clicks **"Download PDF"** to save the diagram

## Visual Design (Target Style)

**Reference screenshot:** `screenshots/NDECC Lab A, B, C, E SEATING ARRANGEMENT.pptx.png`

### Layout Structure

```
+================================================================================+
|                                                                                |
|  [PrepDoctors Logo]   NDECC CLINICAL SKILLS - WORKCHECK — 20th February       |
|                                                                                |
|  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
|                                                                                |
|  DR. INSTRUCTOR 1      DR. INSTRUCTOR 2      DR. INSTRUCTOR 3      ...        |
|                                                                                |
|  TIME GROUP 1 MORNING  TIME GROUP 2 MORNING  TIME GROUP 3 MORNING  ...        |
|  08:00  John Smith     08:00  Alex Jones     08:00  May Chen                  |
|  08:50                 08:50  Sara Kim       08:50  Raj Patel                 |
|  09:40  Karen Lee      09:40                 09:40                            |
|  10:30  Nilay Shah     10:30  Syeda Asif     10:30                            |
|  11:20  Ghassan G.     11:20  Ramneek Kaur   11:20  Kartik P.                |
|  12:10  Samiya Khan    12:10  Joyce A.       12:10  Dhawni Patel              |
|                                                                                |
|  TIME GROUP 1 AFTERNOON TIME GROUP 2 AFTERNOON TIME GROUP 3 AFTERNOON ...     |
|  1:50   Shaza Fadul    1:50   Halima Issa    1:50   Ramsha Inam              |
|  2:40   Neetu Garg     2:40   Shayan G.      2:40                            |
|  3:30   Shivani P.     3:30                  3:30                            |
|  4:20                  4:20                  4:20                            |
|  5:10   Harman B.      5:10                  5:10                            |
|  6:00                  6:00   Naseer C.      6:00                            |
|                                                                                |
+================================================================================+
```

### Color Palette

Extracted from the reference screenshot:

```javascript
const COLORS = {
  // Background
  canvasBg: '#163B4E',          // Dark navy/teal — fills entire canvas

  // Header
  titleText: '#E8634F',         // Coral/salmon — main title + date
  logoArea: 'white',            // PrepDoctors logo text area
  dividerLine: '#4A7A8A',       // Dashed line below header

  // Instructor labels
  instructorText: '#FFFFFF',    // White text for instructor names

  // Group header bars
  groupHeaderBg: '#E8634F',     // Coral/salmon background
  groupHeaderText: '#FFFFFF',   // White text ("TIME", "GROUP X MORNING")

  // Table cells
  cellBg: '#FFFFFF',            // White cell background
  cellBgAlt: '#F5F5F5',        // Very light gray alternating rows (optional)
  cellBorder: '#D0D0D0',       // Light gray cell borders
  cellTimeText: '#333333',      // Dark text for time values
  cellNameText: '#333333',      // Dark text for student names
  cellEmptyText: '#999999',     // Gray for empty cells (or just blank)
};
```

### Typography

```javascript
const FONTS = {
  title: 'bold 48px "Segoe UI", Arial, sans-serif',          // Main title
  instructor: 'bold 18px "Segoe UI", Arial, sans-serif',     // Instructor name
  groupHeader: 'bold 16px "Segoe UI", Arial, sans-serif',    // "TIME | GROUP X MORNING"
  cellTime: '16px "Segoe UI", Arial, sans-serif',            // Time values (08:00, etc.)
  cellName: '16px "Segoe UI", Arial, sans-serif',            // Student names
};
```

### Key Style Rules

1. **Dark background fills entire canvas** — not white like the prototype
2. **No rounded corners or card shadows** — clean rectangular grid cells with thin borders
3. **Group header bar** is a solid coral/salmon rectangle spanning the full column width
4. **Two-column table per group**: narrow TIME column (left) + wider NAME column (right)
5. **Morning and Afternoon sections stacked** within each group column, separated by a gap
6. **Instructor name** positioned above the group column in white text, centered
7. **Empty time slots** show the time but leave the name cell blank
8. **Dashed horizontal divider** separates the header area from the group content

## Grouping: How Bookings Map to Groups

### Data Model Context

```
work_check_slots  →  has group_id (UUID array)
                  →  groups table has group_name for each UUID
work_check_bookings  →  belongs to a slot (via slot_id)
                     →  has student_id (string like "PREP001")
groups_students  →  links student_id to group_id
```

A single slot can serve multiple groups. A booking belongs to one slot. Each student belongs to one group (via `groups_students`).

### Grouping Logic

1. **Fetch bookings** for the selected date via a new lightweight endpoint
2. **Resolve each booking's group** via `groups_students` (student_id → group_id → group_name)
3. **Build one column per group**, containing only the students from that group
4. **Bookings with no group match** go into an "Unassigned" column at the end

## Features File

**Reference implementation:** `prepdoctors-richmond-hill-main/frontend/src/components/admin/GroupImageGenerator.tsx`

### Adapted for mocks_booking

| Prototype Concept | mocks_booking Equivalent |
|---|---|
| Group card (rounded, shadowed) | Group column (flat, bordered cells) |
| Trainee + seat_number | slot_time + student_name |
| Group time_period (AM/PM) | Derived from slot_time (before 12:00 = AM, 12:00+ = PM) |
| Group instructors | Resolved via slot → instructor relationship + `groups_instructors` |
| max_capacity per group | `groups.max_capacity` column |
| White canvas background | Dark navy/teal canvas background |
| Card-based layout | Grid/table-based layout |
| S3 upload | Not needed — PDF download only |

### Data Sources

**Primary**: New `diagram-data` endpoint that returns bookings pre-grouped by group name for a given date.

### Session Determination

Derive AM/PM from `slot_time` in each aggregate:
```javascript
const isAM = (slotTime) => {
  const hour = parseInt(slotTime.split(':')[0], 10);
  return hour < 12;
};
```

Filter by session selection before rendering.

## Technical Specification

### New Files

| File | Purpose |
|---|---|
| `admin_frontend/src/components/admin/SeatingDiagramModal.jsx` | Modal component with canvas rendering + PDF download |
| `admin_root/api/admin/work-check-bookings/diagram-data.js` | Lightweight endpoint returning bookings enriched with group_name |

### Modified Files

| File | Change |
|---|---|
| `admin_frontend/src/pages/WorkCheckBookings.jsx` | Add "Seating Diagram" button + modal state |
| `admin_frontend/src/services/adminApi.js` | Add `getDiagramData(date)` method to `workCheckBookingsApi` |

---

## Backend: `diagram-data.js`

### Purpose

Returns all active bookings for a given date, each enriched with the student's `group_name`. This avoids having the frontend make N+1 queries to resolve group memberships.

### Endpoint

`GET /api/admin/work-check-bookings/diagram-data?date=2026-02-19`

### Auth

`requirePermission(req, 'workcheck.view')`

### Logic

```sql
-- Pseudocode:
1. Fetch all work_check_bookings where slot.slot_date = :date
   AND status NOT IN ('cancelled', 'rejected')
   Join slot (slot_date, slot_time, location, group_id, instructor_id)
   Join student (firstname, lastname)
   Join instructor (instructor_name)

2. For each booking, resolve group_name:
   Look up groups_students where student_id = booking.student_id
   AND group_id IN (booking.slot.group_id array)
   Join groups to get group_name

3. Return bookings grouped by session (AM/PM) and group_name
```

### Response Shape

```json
{
  "success": true,
  "data": {
    "date": "2026-02-19",
    "sessions": [
      {
        "session": "AM",
        "slot_time": "09:00:00",
        "location": "Richmond Hill",
        "groups": [
          {
            "group_name": "Group 1",
            "group_id": "uuid-a",
            "instructor_name": "Dr. Miller",
            "max_capacity": 7,
            "bookings": [
              {
                "student_name": "John Smith",
                "student_id": "PREP001",
                "slot_time": "08:00",
                "type": "Work Check",
                "status": "confirmed"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Frontend Component: `SeatingDiagramModal.jsx`

### Props

```javascript
{
  isOpen: boolean,       // Controls modal visibility
  onClose: () => void,   // Close handler
}
```

### State

```javascript
const [selectedDate, setSelectedDate] = useState(todayString);    // YYYY-MM-DD
const [sessionFilter, setSessionFilter] = useState('BOTH');       // 'AM' | 'PM' | 'BOTH'
const [imageDataUrl, setImageDataUrl] = useState(null);           // Base64 PNG for preview
const [generating, setGenerating] = useState(false);
```

### Data Fetching

```javascript
const { data, isLoading } = useQuery({
  queryKey: ['diagram-data', selectedDate],
  queryFn: () => workCheckBookingsApi.getDiagramData(selectedDate),
  enabled: isOpen && !!selectedDate,
});
```

### Canvas Configuration

```javascript
const CANVAS_CONFIG = {
  WIDTH: 1920,
  HEIGHT_SINGLE: 1080,           // One session (AM or PM only)
  HEIGHT_DOUBLE: 1920,           // Both sessions stacked
  HEADER_HEIGHT: 140,            // Title + logo + divider area
  GROUP_HEADER_HEIGHT: 35,       // Coral bar ("TIME | GROUP X MORNING")
  ROW_HEIGHT: 40,                // Each time slot row
  COLUMN_GAP: 12,               // Gap between group columns
  INSTRUCTOR_LABEL_HEIGHT: 30,   // Space for instructor name above group
  SESSION_GAP: 20,               // Gap between morning and afternoon sections
  PADDING: 40,                   // Canvas edge padding
  TIME_COL_WIDTH: 60,            // Width of the TIME column
};
```

### Canvas Drawing Flow

```
1. Fill entire canvas with dark navy/teal (#163B4E)
2. Draw header area:
   a. PrepDoctors logo (top-left)
   b. Title in coral text: "NDECC CLINICAL SKILLS - WORKCHECK — [Date]"
   c. Dashed horizontal divider line
3. Calculate column widths: (canvasWidth - padding - gaps) / numberOfGroups
4. For each group column (left to right, sorted alphabetically):
   a. Draw instructor name in white text, centered above column
   b. MORNING section:
      - Coral header bar: "TIME | GROUP [name] MORNING"
      - For each time slot row:
        * TIME cell (left): slot time in dark text on white bg
        * NAME cell (right): student name in dark text on white bg
        * Empty slots: time shown, name cell left blank
      - Thin gray borders between all cells
   c. Gap between sessions
   d. AFTERNOON section:
      - Same layout as morning
5. Convert to data URL for preview
```

### PDF Download

Use `jspdf` to convert the canvas to PDF:

```javascript
import jsPDF from 'jspdf';

const downloadPDF = () => {
  const canvas = canvasRef.current;
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`Seating_Diagram_${sessionLabel}_${selectedDate}.pdf`);
};
```

### Dependency

```bash
cd admin_root/admin_frontend && npm install jspdf
```

---

## UI Specification

### Modal Structure (Headless UI Dialog)

Follow existing modal pattern from `WorkCheckBookingFormModal.jsx`:

```
+---------------------------------------------------+
| Seating Diagram                              [X]  |
+---------------------------------------------------+
|                                                    |
|  Date: [ 2026-02-19  ]   Session: [Both    v]     |
|                                                    |
|  [ Generate Diagram ]                              |
|                                                    |
|  +----------------------------------------------+  |
|  |          (Canvas preview image)              |  |
|  |                                              |  |
|  +----------------------------------------------+  |
|                                                    |
+---------------------------------------------------+
|                      [ Download PDF ]   [ Close ]  |
+---------------------------------------------------+
```

- Modal size: `max-w-4xl` (wider than typical to fit the preview)
- Canvas preview: rendered as `<img>` from data URL, scaled to fit modal width
- Hidden `<canvas>` element for offscreen rendering
- "Generate Diagram" button: primary style, disabled if no date selected or data still loading
- "Download PDF" button: only visible after diagram is generated
- "Close" button: always visible

### Button in WorkCheckBookings.jsx

```jsx
<button
  onClick={() => setSeatingDiagramOpen(true)}
  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
>
  <Camera className="-ml-1 mr-2 h-5 w-5" />
  Seating Diagram
</button>
```

Place in a `flex gap-3` wrapper with the existing Create Booking button.

---

## Edge Cases

1. **No bookings for selected date**: Show an info message "No bookings found for this date"
2. **Both sessions but only one has bookings**: Only render the session that has data
3. **Student not in any group**: Place in an "Unassigned" group column at the end
4. **Many groups (>6)**: Reduce column widths or font sizes to fit; canvas width can increase dynamically
5. **Long student names**: Truncate with ellipsis at ~20 characters in the canvas
6. **Group with no bookings for this date**: Do not render a column for that group
7. **"Closed" session for a group**: Show "Closed" text in the name cell (as seen in reference)

---

## Validation Checklist

- [ ] "Seating Diagram" button appears beside "Create Booking" on `/work-check/bookings`
- [ ] Clicking opens a Headless UI modal
- [ ] Date picker defaults to today
- [ ] Session filter defaults to "Both"
- [ ] "Generate Diagram" fetches bookings and renders canvas
- [ ] Dark navy/teal background fills the entire canvas
- [ ] PrepDoctors logo appears top-left, coral title with date top-right
- [ ] Dashed divider line separates header from content
- [ ] Instructor name in white text centered above each group column
- [ ] Coral group header bars show "TIME | GROUP [name] MORNING/AFTERNOON"
- [ ] Two-column table per group: TIME (left) + NAME (right)
- [ ] White cell backgrounds with thin gray borders
- [ ] Empty time slots show time but blank name cell
- [ ] Morning and Afternoon sections stacked within each group column
- [ ] Groups arranged as horizontal columns (sorted alphabetically)
- [ ] "Download PDF" saves a properly formatted PDF
- [ ] No bookings scenario shows info message
- [ ] Students not in any group appear in "Unassigned" column
- [ ] `npm run build` passes with no errors
- [ ] New `diagram-data` endpoint returns correct group-enriched data
