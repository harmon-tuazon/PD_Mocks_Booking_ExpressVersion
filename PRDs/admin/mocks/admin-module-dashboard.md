# Product Requirements Document (PRD)
## Admin Module: Mock Exam Dashboard & Management

**Project**: Mock Exam Booking System - Admin Module  
**Date**: October 21, 2025  
**Requested By**: System Requirements  
**Priority**: [X] High  
**Status**: 📋 Planning

---

## 📋 **Feature Summary**

### **Brief Description**
A comprehensive admin dashboard that displays all existing Mock Exam objects in a searchable, filterable, and sortable data table. This module provides system administrators with real-time visibility into all mock exam sessions, their booking status, and quick access to key metrics and actions. The dashboard serves as the central hub for monitoring and managing the mock exam inventory.

### **Category**
- [X] ✨ **New Feature** - Add new functionality
- [X] 📊 **Analytics** - Data visualization and reporting
- [X] 🔐 **Security** - Security-related changes (protected routes)

### **Business Value**
This dashboard eliminates the need for administrators to access HubSpot directly to view mock exam data. It provides:
- **Real-time visibility** into all scheduled mock exams and their capacity utilization
- **Quick identification** of sessions that need attention (low bookings, fully booked, past dates)
- **Efficient management** through search, filter, and sort capabilities
- **Data-driven decisions** through key metrics and analytics
- **Streamlined workflows** with quick actions directly from the dashboard

---

## 🎯 **Current State vs Desired State**

### **What's happening now?**
Currently, there is no unified view of all Mock Exam objects within the admin system. Administrators must:
- Log into HubSpot directly to view mock exam data
- Manually search through object records one at a time
- Export data to spreadsheets for analysis
- Lack visibility into real-time booking status
- Cannot easily identify sessions that require attention
- Have no way to quickly compare sessions or spot trends

### **What should happen instead?**
System administrators should have access to a dedicated dashboard at `/admin/mock-exams` where they can:
- View all Mock Exam objects in a single, comprehensive table
- See real-time booking counts and capacity utilization for each session
- Filter by date range, location, mock type, and status
- Search by any field (location, type, date, etc.)
- Sort by any column (date, bookings, capacity, etc.)
- View key metrics at a glance (total sessions, utilization rate, upcoming exams)
- Identify sessions requiring attention through visual indicators
- Access quick actions (view details, edit, deactivate, view bookings)
- Export filtered data for reporting purposes
- Navigate seamlessly between dashboard and creation workflows

### **Why is this change needed?**

**Operational Visibility:** Provides complete oversight of all mock exam sessions without leaving the admin portal

**Time Efficiency:** Eliminates the need to log into HubSpot for basic monitoring and reporting tasks

**Data-Driven Management:** Enables quick identification of underutilized sessions or capacity issues

**Improved Decision Making:** Real-time metrics help optimize scheduling and resource allocation

**User Experience:** Creates a purpose-built interface that matches administrator workflows and needs

**Compliance & Auditing:** Centralized view makes it easier to verify that all sessions are properly configured

---

## 📐 **Technical Details**

### **Affected Components**
- [X] 🔙 **Backend API** (`/api/admin/`)
- [X] 🖥️ **Frontend React App** (`/frontend/src/pages/admin/`)
- [X] 🏢 **HubSpot Integration** (Mock Exams object `2-50158913`)
- [X] 🔐 **Authentication & Authorization** (Route protection)
- [X] 📖 **Documentation** (API docs, admin user guide)

### **New Files/Endpoints Structure**

#### Backend Structure
```
api/
├── admin/
│   ├── controllers/
│   │   ├── adminMockExamsController.js (extend existing)
│   │   └── adminAnalyticsController.js (new)
│   ├── services/
│   │   ├── adminMockExamsService.js (extend existing)
│   │   └── adminAnalyticsService.js (new)
│   └── routes/
│       └── adminMockExamsRoutes.js (extend existing)
```

#### Frontend Structure
```
frontend/src/
├── pages/
│   └── admin/
│       ├── MockExamsDashboard.jsx (new)
│       ├── MockExamDetails.jsx (new)
│       └── MockExamEdit.jsx (new)
├── components/
│   └── admin/
│       ├── MockExamsTable.jsx (new)
│       ├── DashboardMetrics.jsx (new)
│       ├── FilterBar.jsx (new)
│       ├── StatusBadge.jsx (new)
│       └── ExportButton.jsx (new)
└── hooks/
    ├── useMockExamsData.js (new)
    └── useTableFilters.js (new)
```

### **API Endpoints**

#### 1. Get All Mock Exams
```
GET /api/admin/mock-exams
Authentication: Required (Admin role)
```

**Query Parameters:**
```
?page=1
&limit=50
&sort_by=exam_date
&sort_order=asc
&filter_location=Calgary
&filter_mock_type=Situational%20Judgment
&filter_status=active
&filter_date_from=2025-10-01
&filter_date_to=2025-12-31
&search=Calgary
```

**Response:**
```json
{
  "success": true,
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 237,
    "records_per_page": 50
  },
  "data": [
    {
      "id": "mock_exam_12345",
      "mock_type": "Situational Judgment",
      "exam_date": "2025-10-02",
      "start_time": "10:00",
      "end_time": "11:00",
      "capacity": 15,
      "total_bookings": 12,
      "utilization_rate": 80,
      "location": "Calgary",
      "is_active": true,
      "status": "upcoming",
      "created_at": "2025-09-15T10:30:00Z",
      "updated_at": "2025-09-20T14:22:00Z"
    }
  ]
}
```

#### 2. Get Dashboard Metrics
```
GET /api/admin/mock-exams/metrics
Authentication: Required (Admin role)
```

**Query Parameters:**
```
?date_from=2025-10-01
&date_to=2025-12-31
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "total_sessions": 237,
    "active_sessions": 215,
    "upcoming_sessions": 89,
    "past_sessions": 126,
    "fully_booked": 45,
    "low_bookings": 23,
    "average_utilization": 67.5,
    "total_capacity": 3555,
    "total_bookings": 2399,
    "by_location": {
      "Calgary": 89,
      "Edmonton": 76,
      "Vancouver": 72
    },
    "by_mock_type": {
      "Situational Judgment": 95,
      "Professional Dilemmas": 78,
      "CASPer": 64
    }
  }
}
```

#### 3. Get Single Mock Exam Details
```
GET /api/admin/mock-exams/:id
Authentication: Required (Admin role)
```

**Response:**
```json
{
  "success": true,
  "mockExam": {
    "id": "mock_exam_12345",
    "properties": {
      "mock_type": "Situational Judgment",
      "exam_date": "2025-10-02",
      "start_time": "10:00",
      "end_time": "11:00",
      "capacity": 15,
      "total_bookings": 12,
      "location": "Calgary",
      "is_active": true
    },
    "bookings": [
      {
        "booking_id": "booking_001",
        "student_name": "John Doe",
        "student_email": "john@example.com",
        "booking_date": "2025-09-18T09:15:00Z",
        "status": "confirmed"
      }
    ],
    "metadata": {
      "created_at": "2025-09-15T10:30:00Z",
      "created_by": "admin@prepdoctors.ca",
      "updated_at": "2025-09-20T14:22:00Z",
      "updated_by": "admin@prepdoctors.ca"
    }
  }
}
```

#### 4. Update Mock Exam
```
PATCH /api/admin/mock-exams/:id
Authentication: Required (Admin role)
```

**Request Body:**
```json
{
  "is_active": false,
  "capacity": 20,
  "location": "Vancouver"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mock exam updated successfully",
  "mockExam": {
    "id": "mock_exam_12345",
    "properties": { ... }
  }
}
```

#### 5. Delete Mock Exam
```
DELETE /api/admin/mock-exams/:id
Authentication: Required (Admin role)
```

**Response:**
```json
{
  "success": true,
  "message": "Mock exam deleted successfully",
  "deleted_id": "mock_exam_12345"
}
```

#### 6. Export Mock Exams Data
```
GET /api/admin/mock-exams/export
Authentication: Required (Admin role)
```

**Query Parameters:** Same as Get All Mock Exams endpoint

**Response:** CSV file download
```
Content-Type: text/csv
Content-Disposition: attachment; filename="mock-exams-export-2025-10-21.csv"
```

### **Data Requirements**

#### Existing HubSpot Properties Used
- ✅ `mock_type` - Type of exam
- ✅ `exam_date` - Date of the exam
- ✅ `capacity` - Maximum bookings allowed
- ✅ `location` - Venue location
- ✅ `is_active` - Active status
- ✅ `start_time` - Session start time
- ✅ `end_time` - Session end time
- ✅ `total_bookings` - Current booking count

#### Calculated Fields (Frontend/Backend)
- `utilization_rate` - (total_bookings / capacity) * 100
- `status` - Derived from exam_date and is_active
  - "upcoming" - Future date, is_active = true
  - "past" - Past date
  - "inactive" - is_active = false
  - "full" - total_bookings >= capacity
- `available_spots` - capacity - total_bookings

### **HubSpot Operations**
- **List Objects:** Use HubSpot List API (`GET /crm/v3/objects/2-50158913`) with pagination
- **Search Objects:** Use HubSpot Search API (`POST /crm/v3/objects/2-50158913/search`)
- **Get Object:** Use standard get API (`GET /crm/v3/objects/2-50158913/{id}`)
- **Update Object:** Use update API (`PATCH /crm/v3/objects/2-50158913/{id}`)
- **Delete Object:** Use delete API (`DELETE /crm/v3/objects/2-50158913/{id}`)
- **Get Associations:** Query associated bookings for detailed view

---

## 💥 **User Impact**

### **Who will this affect?**
- [X] System administrators
- [X] PrepDoctors operations team
- [X] Admin staff responsible for scheduling and monitoring

### **User Stories**

#### Primary User Story
```
As a system administrator,
I want to view all mock exam sessions in a single dashboard with real-time booking information,
So that I can quickly monitor capacity, identify issues, and make informed scheduling decisions.
```

#### Acceptance Criteria
1. Admin can access `/admin/mock-exams` only with valid admin credentials
2. Dashboard displays all mock exams in a paginated table (50 per page)
3. Each row shows: type, date, time, location, capacity, bookings, utilization %, status
4. Admin can sort by any column (ascending/descending)
5. Admin can filter by: date range, location, mock type, status
6. Admin can search across all fields
7. Dashboard shows key metrics: total sessions, utilization rate, fully booked count
8. Status indicators clearly show: upcoming (green), past (gray), full (red), inactive (yellow)
9. Admin can click on any session to view detailed information
10. Admin can quickly edit or deactivate sessions from the table
11. Admin can export filtered data to CSV
12. Dashboard updates in real-time when new bookings are made

#### Example Scenarios

**Scenario 1: Monitoring Upcoming Sessions**
```
Given I am an authenticated admin user
When I navigate to /admin/mock-exams
Then I should see a dashboard with all mock exam sessions
And I should see metrics showing:
  - 89 upcoming sessions
  - 67.5% average utilization
  - 45 fully booked sessions
  - 23 sessions with low bookings (< 50%)
And I should see a table sorted by exam_date (ascending)
And each row should show real-time booking counts
```

**Scenario 2: Finding Underutilized Sessions**
```
Given I am viewing the mock exams dashboard
When I apply filter: "Utilization < 50%" and "Status = Upcoming"
And I sort by utilization_rate ascending
Then I should see only sessions with less than 50% bookings
And I can identify which sessions need promotional attention
```

**Scenario 3: Exporting Monthly Report**
```
Given I am viewing the mock exams dashboard
When I set date filter: "October 1 - October 31, 2025"
And I select "Location: All" and "Type: All"
And I click "Export to CSV"
Then I should receive a CSV file with all October sessions
And the file should include all displayed columns
And I can use this for monthly reporting to stakeholders
```

**Scenario 4: Quick Session Management**
```
Given I am viewing a mock exam session in the table
When I notice a session is fully booked
And I click the "Edit" quick action
Then I should see an edit modal
And I can increase the capacity from 15 to 20
And I can save the changes without leaving the dashboard
```

---

## 🎨 **UI/UX Requirements**

### **Dashboard Layout**

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Portal > Mock Exams Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Total   │ │ Upcoming │ │  Fully   │ │ Average  │       │
│  │ Sessions │ │ Sessions │ │  Booked  │ │Utilization│      │
│  │   237    │ │    89    │ │    45    │ │  67.5%   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Search: [________________]  [+ Create New Session]  │    │
│  │                                                       │    │
│  │ Filters:                                             │    │
│  │ Date Range: [Oct 1] - [Dec 31]                      │    │
│  │ Location: [All ▼] Type: [All ▼] Status: [All ▼]    │    │
│  │                                                       │    │
│  │ [Apply Filters] [Reset] [Export CSV]                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Type ▲▼ │ Date ▲▼ │ Time │ Location │ Capacity │...│    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ SJ      │ Oct 2   │10:00 │ Calgary  │ 12/15 ●●●○│    │
│  │ PD      │ Oct 3   │11:00 │Edmonton  │ 15/15 ●●● │    │
│  │ CASPer  │ Oct 5   │14:00 │Vancouver │  8/15 ●●○○│    │
│  │ ...     │ ...     │ ...  │ ...      │ ...       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Showing 1-50 of 237 | [< Previous] Page 1 of 5 [Next >]   │
└─────────────────────────────────────────────────────────────┘
```

### **Visual Indicators**

**Status Badges:**
- 🟢 **Upcoming** - Green badge (exam_date in future, is_active = true)
- 🔴 **Full** - Red badge (total_bookings >= capacity)
- 🟡 **Low** - Yellow badge (utilization < 50%)
- ⚫ **Past** - Gray badge (exam_date in past)
- 🟠 **Inactive** - Orange badge (is_active = false)

**Utilization Indicators:**
- Visual progress bar or dot indicators
- Color coding: Red (< 50%), Yellow (50-79%), Green (80-100%)

**Quick Actions:**
- 👁️ View Details
- ✏️ Edit
- 🚫 Deactivate/Activate
- 📋 View Bookings

### **Responsive Design**
- Desktop: Full table with all columns
- Tablet: Horizontal scroll for table, collapsible filters
- Mobile: Card-based layout instead of table, stacked metrics

---

## 🧪 **Testing Requirements**

### **Unit Tests**
```javascript
// Backend Service Tests
describe('AdminMockExamsDashboardService', () => {
  test('should fetch all mock exams with pagination', async () => {});
  test('should apply filters correctly', async () => {});
  test('should sort by any column', async () => {});
  test('should calculate utilization rate', () => {});
  test('should determine session status correctly', () => {});
  test('should aggregate metrics', async () => {});
});

// Controller Tests
describe('AdminMockExamsDashboardController', () => {
  test('should return paginated results', async () => {});
  test('should handle invalid filter parameters', async () => {});
  test('should export to CSV format', async () => {});
});
```

### **Frontend Tests**
```javascript
describe('MockExamsDashboard Component', () => {
  test('should render dashboard with metrics', () => {});
  test('should display table with mock exams', () => {});
  test('should apply filters and update results', () => {});
  test('should sort table columns', () => {});
  test('should paginate through results', () => {});
  test('should show status badges correctly', () => {});
  test('should handle loading and error states', () => {});
});

describe('FilterBar Component', () => {
  test('should render all filter inputs', () => {});
  test('should reset filters to default', () => {});
  test('should validate date range inputs', () => {});
});
```

### **Integration Tests**
- Test complete data flow from HubSpot API to dashboard display
- Verify real-time updates when bookings change
- Test export functionality produces valid CSV
- Confirm filtering and sorting work with large datasets

### **Manual Testing Checklist**
- [ ] Verify dashboard loads within 2 seconds with 200+ records
- [ ] Test all filter combinations work correctly
- [ ] Verify sorting works on all columns
- [ ] Test pagination navigates correctly
- [ ] Confirm status badges display accurate states
- [ ] Test search across all fields
- [ ] Verify CSV export contains correct filtered data
- [ ] Test responsive design on tablet and mobile
- [ ] Confirm quick actions open correct modals
- [ ] Verify metrics calculate accurately

---

## 🛡️ **Security & Access Control**

### **Authentication Requirements**
- All `/api/admin/mock-exams*` endpoints require valid JWT token
- All `/admin/mock-exams*` frontend routes protected by `ProtectedAdminRoute`
- JWT tokens must include `role: "admin"` claim
- Read operations require at minimum `STAFF` role
- Write operations (edit/delete) require `ADMIN` role

### **Authorization Rules**
```javascript
// Role permissions
const PERMISSIONS = {
  SUPER_ADMIN: ['read', 'create', 'edit', 'delete', 'export'],
  ADMIN: ['read', 'create', 'edit', 'delete', 'export'],
  STAFF: ['read', 'export']
};
```

### **Data Security**
- Implement rate limiting: 200 requests per minute per user
- Sanitize all search and filter inputs
- Validate pagination parameters to prevent abuse
- Log all data export actions for audit trail

---

## 📊 **Non-Functional Requirements**

### **Performance**
- Dashboard initial load: < 2 seconds
- Filter/sort operations: < 500ms
- Pagination navigation: < 300ms
- Metrics calculation: < 1 second
- Export generation: < 3 seconds for 500 records

### **Scalability**
- Support displaying up to 10,000 mock exam records
- Handle 50 concurrent admin users
- Efficient API pagination (max 100 records per request)
- Client-side caching of frequently accessed data

### **Usability**
- Intuitive table interface requiring no training
- Clear visual hierarchy and status indicators
- Responsive design for all device sizes
- Keyboard navigation support
- Accessible (WCAG 2.1 AA compliant)

### **Reliability**
- Graceful degradation if HubSpot API is slow/unavailable
- Retry logic for failed API requests (3 attempts)
- Error messages with actionable guidance
- Auto-refresh option for real-time monitoring

---

## 📐 **Implementation Approach**

### **Phase 1: Backend API & Data Layer (Week 1)**
1. Extend adminMockExamsController with list/search endpoints
2. Implement filtering, sorting, and pagination logic
3. Build metrics aggregation service
4. Add CSV export functionality
5. Write comprehensive unit tests

### **Phase 2: Dashboard UI Core (Week 1-2)**
6. Create MockExamsDashboard page component
7. Build MockExamsTable with sorting/pagination
8. Implement DashboardMetrics component
9. Add FilterBar with all filter controls
10. Create StatusBadge component

### **Phase 3: Advanced Features (Week 2)**
11. Implement search functionality
12. Add quick actions (view/edit/delete)
13. Build export button with download
14. Add real-time data refresh option
15. Implement responsive design

### **Phase 4: Details & Edit Views (Week 2-3)**
16. Create MockExamDetails page
17. Build MockExamEdit modal/page
18. Implement update functionality
19. Add confirmation dialogs for destructive actions
20. Write frontend tests

### **Phase 5: Testing & Polish (Week 3)**
21. Conduct end-to-end testing
22. Performance optimization
23. Accessibility audit and fixes
24. Documentation and user guide
25. Deploy to staging for UAT

---

## 🚀 **Success Metrics**

### **Quantitative Metrics**
- **Adoption Rate:** 100% of admin staff use dashboard within 1 week
- **Time Savings:** Reduce time to find/review sessions from 5 min to 30 seconds
- **HubSpot Access:** Reduce direct HubSpot logins by 80%
- **Response Time:** 95% of dashboard loads complete in < 2 seconds
- **Data Accuracy:** 100% match between dashboard and HubSpot data

### **Qualitative Metrics**
- Admin staff report high satisfaction with dashboard usability
- Reduced support tickets related to "how to find" mock exam data
- Improved ability to identify capacity issues proactively
- Enhanced confidence in data accuracy and real-time status

---

## 📅 **Timeline**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Backend API & Data | 1 week | List/filter/export endpoints, metrics API |
| Phase 2: Dashboard UI Core | 1 week | Table, metrics, filters, pagination |
| Phase 3: Advanced Features | 1 week | Search, quick actions, export, responsive |
| Phase 4: Details & Edit Views | 1 week | Detail page, edit functionality |
| Phase 5: Testing & Polish | 0.5 weeks | E2E tests, documentation, UAT |
| **Total** | **4.5 weeks** | Full dashboard ready for production |

---

## ⚠️ **Risks & Mitigations**

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubSpot API rate limits with large datasets | High | Medium | Implement pagination, caching, and batch requests |
| Dashboard performance degrades with 1000+ records | Medium | Medium | Client-side virtualization, server-side filtering |
| Real-time data sync issues | Medium | Low | Implement polling with exponential backoff |
| Complex filter combinations cause slow queries | Medium | Low | Optimize HubSpot search queries, add query caching |
| Export of large datasets times out | Low | Low | Implement background job processing for exports |

---

## 🔗 **Dependencies**

### **External Dependencies**
- HubSpot CRM API (List, Search, Get Object APIs)
- JWT authentication system
- CSV generation library (e.g., Papa Parse)

### **Internal Dependencies**
- Existing `hubspot.js` service
- Admin authentication middleware
- Mock Exams object schema (`2-50158913`)
- Bulk creation module (complementary feature)

### **Blocking Dependencies**
- Admin role definitions must be completed
- Mock Exam creation module should be deployed first (provides data to display)

---

## 📚 **References**

- [HubSpot CRM Objects API](https://developers.hubspot.com/docs/api/crm/crm-objects)
- [HubSpot Search API](https://developers.hubspot.com/docs/api/crm/search)
- [Mock Exam Creation PRD](./admin-module-mockexam-creation.md)
- [HubSpot Schema Documentation](./HUBSPOT_SCHEMA_DOCUMENTATION.md)
- [Mock Exam Booking System Documentation](./mocksBooking.md)

---

## ✅ **Approval Sign-off**

| Role | Name | Approval | Date |
|------|------|----------|------|
| Product Owner | | ⬜ Pending | |
| Tech Lead | | ⬜ Pending | |
| UX Designer | | ⬜ Pending | |
| QA Lead | | ⬜ Pending | |

---

**Document Version:** 1.0  
**Last Updated:** October 21, 2025  
**Next Review Date:** October 28, 2025