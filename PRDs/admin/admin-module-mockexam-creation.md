# Product Requirements Document (PRD)
## Admin Module: Bulk Mock Exam Creation

**Project**: Mock Exam Booking System - Admin Module  
**Date**: October 21, 2025  
**Requested By**: System Requirements  
**Priority**: [X] High  
**Status**: 📋 Planning

---

## 📋 **Feature Summary**

### **Brief Description**
A dedicated admin module that allows system administrators to create either individual or multiple Mock Exam objects through a unified interface. This module enables efficient bulk creation of mock exam sessions with different time slots while maintaining consistent properties across objects (mock type, date, capacity, location, etc.).

### **Category**
- [X] ✨ **New Feature** - Add new functionality
- [X] 🗃️ **Infrastructure** - Backend, deployment, or architecture changes
- [X] 🔒 **Security** - Security-related changes (protected routes)

### **Business Value**
This feature significantly reduces administrative overhead by allowing the creation of multiple mock exam sessions in a single operation. Instead of creating 10 separate mock exam objects manually for a single day with different time slots, admins can now create all sessions at once through a streamlined interface, improving operational efficiency and reducing data entry errors.

---

## 🎯 **Current State vs Desired State**

### **What's happening now?**
Currently, there is no administrative interface for creating Mock Exam objects. Any creation of mock exam sessions must be done manually through HubSpot's interface, one object at a time. This is:
- Time-consuming when creating multiple sessions for the same day
- Prone to data entry errors due to manual repetition
- Inefficient for bulk operations
- Not accessible to non-technical staff who shouldn't have direct HubSpot access

### **What should happen instead?**
System administrators should have access to a dedicated admin portal at `/admin/mock-exams/create` where they can:
- Create a single Mock Exam object with all necessary properties
- Create multiple Mock Exam objects simultaneously by specifying different time slots while keeping other properties consistent
- Preview all objects that will be created before submission
- Receive confirmation of successful creation with object IDs
- Access this functionality through a secure, role-protected interface separate from the public booking system

### **Why is this change needed?**
**Operational Efficiency:** Reduces time spent on administrative tasks by 80-90% for bulk session creation

**Data Quality:** Minimizes human error by eliminating repetitive manual data entry

**Security:** Provides controlled access to administrative functions without granting full HubSpot access

**Scalability:** Enables rapid scaling of exam offerings as business grows

**User Experience:** Empowers admin staff with purpose-built tools that don't require technical expertise

---

## 🔍 **Technical Details**

### **Affected Components**
- [X] 📙 **Backend API** (`/api/admin/`)
- [X] 🖥️ **Frontend React App** (`/frontend/src/pages/admin/`)
- [X] 🏢 **HubSpot Integration** (Mock Exams object `2-50158913`)
- [X] 🔒 **Authentication & Authorization** (Route protection)
- [X] 📖 **Documentation** (API docs, admin user guide)

### **New Files/Endpoints Structure**

#### Backend Structure
```
api/
├── admin/
│   ├── controllers/
│   │   ├── adminMockExamsController.js
│   │   └── adminAuthController.js
│   ├── services/
│   │   ├── adminMockExamsService.js
│   │   └── adminAuthService.js
│   ├── middleware/
│   │   ├── adminAuthMiddleware.js
│   │   └── roleValidationMiddleware.js
│   ├── routes/
│   │   └── adminMockExamsRoutes.js
│   └── validators/
│       └── mockExamValidators.js
└── shared/
    └── hubspot.js (existing, reused)
```

#### Frontend Structure
```
frontend/src/
├── pages/
│   └── admin/
│       ├── AdminLayout.jsx
│       ├── AdminDashboard.jsx
│       ├── MockExamBulkCreate.jsx
│       └── MockExamsList.jsx
├── components/
│   └── admin/
│       ├── ProtectedAdminRoute.jsx
│       ├── TimeSlotBuilder.jsx
│       ├── MockExamPreview.jsx
│       └── BulkCreateForm.jsx
├── hooks/
│   └── useAdminAuth.js
└── services/
    └── adminApi.js
```

### **API Endpoints**

#### 1. Create Single Mock Exam
```
POST /api/admin/mock-exams/create
Authentication: Required (Admin role)
```

**Request Body:**
```json
{
  "mock_type": "Situational Judgment",
  "exam_date": "2025-10-02",
  "capacity": 15,
  "location": "Calgary",
  "is_active": true,
  "start_time": "10:00",
  "end_time": "11:00"
}
```

**Response:**
```json
{
  "success": true,
  "mockExam": {
    "id": "mock_exam_12345",
    "properties": { ... }
  }
}
```

#### 2. Create Multiple Mock Exams (Bulk)
```
POST /api/admin/mock-exams/bulk-create
Authentication: Required (Admin role)
```

**Request Body:**
```json
{
  "commonProperties": {
    "mock_type": "Situational Judgment",
    "exam_date": "2025-10-02",
    "capacity": 15,
    "location": "Calgary",
    "is_active": true
  },
  "timeSlots": [
    { "start_time": "10:00", "end_time": "11:00" },
    { "start_time": "11:00", "end_time": "12:00" },
    { "start_time": "13:00", "end_time": "14:00" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "created_count": 3,
  "mockExams": [
    { "id": "mock_exam_12345", "properties": { ... } },
    { "id": "mock_exam_12346", "properties": { ... } },
    { "id": "mock_exam_12347", "properties": { ... } }
  ]
}
```

#### 3. Validate Admin Access
```
GET /api/admin/auth/validate
Authentication: Required
```

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": "admin_001",
    "email": "admin@prepdoctors.ca",
    "role": "admin",
    "permissions": ["create_mock_exams", "edit_mock_exams", "view_analytics"]
  }
}
```

### **Data Requirements**

#### Existing HubSpot Properties (Mock Exams `2-50158913`)
- ✅ `mock_type` (String) - Type of exam
- ✅ `exam_date` (Date) - Date of the exam
- ✅ `capacity` (Number) - Maximum bookings allowed
- ✅ `location` (Enumeration) - Venue location
- ✅ `is_active` (Boolean) - Active status
- ✅ `start_time` (DateTime) - Session start time
- ✅ `end_time` (DateTime) - Session end time
- ✅ `total_bookings` (Number) - Current booking count

#### No New Properties Required
All necessary properties already exist in the Mock Exams object schema.

### **HubSpot Operations**
- **Batch Create Objects:** Use HubSpot Batch API (`POST /crm/v3/objects/2-50158913/batch/create`) for efficient bulk creation
- **Single Create Object:** Use standard create API (`POST /crm/v3/objects/2-50158913`) for individual creation
- **Validation:** Query existing objects to prevent duplicate time slot conflicts

---

## 👥 **User Impact**

### **Who will this affect?**
- [X] System administrators
- [X] PrepDoctors operations team
- [X] Admin staff responsible for scheduling

### **User Stories**

#### Primary User Story
```
As a system administrator,
I want to create multiple Mock Exam objects with different time slots through a single interface,
So that I can efficiently schedule exam sessions without manually creating each object in HubSpot.
```

#### Acceptance Criteria
1. Admin can access `/admin/mock-exams/create` only with valid admin credentials
2. Admin can choose between "Single Session" or "Multiple Sessions" creation mode
3. For multiple sessions, admin can add/remove time slots dynamically
4. System validates that end_time > start_time for each slot
5. System prevents creation of overlapping time slots
6. Admin sees a preview of all Mock Exam objects before final submission
7. System displays success confirmation with created object IDs
8. Failed creations show clear error messages with reasons

#### Example Scenarios

**Scenario 1: Creating Multiple Morning Sessions**
```
Given I am an authenticated admin user
When I navigate to /admin/mock-exams/create
And I select "Multiple Sessions" mode
And I enter common properties:
  - Mock Type: "Situational Judgment"
  - Date: October 2, 2025
  - Capacity: 15
  - Location: Calgary
And I add time slots:
  - Slot 1: 10:00 AM - 11:00 AM
  - Slot 2: 11:00 AM - 12:00 PM
  - Slot 3: 01:00 PM - 02:00 PM
And I click "Create All Sessions"
Then 3 Mock Exam objects should be created in HubSpot
And I should see confirmation with all object IDs
And each object should have its respective start_time and end_time
```

**Scenario 2: Single Session Creation**
```
Given I am an authenticated admin user
When I select "Single Session" mode
And I fill in all required fields including one time slot
And I click "Create Session"
Then 1 Mock Exam object should be created in HubSpot
And I should see confirmation with the object ID
```

---

## 🧪 **Testing Requirements**

### **Unit Tests**
```javascript
// Backend Service Tests
describe('AdminMockExamsService', () => {
  test('should create single mock exam with valid data', async () => {});
  test('should create multiple mock exams via bulk operation', async () => {});
  test('should validate time slot consistency', () => {});
  test('should prevent overlapping time slots', () => {});
  test('should handle HubSpot API failures gracefully', async () => {});
});

// Controller Tests
describe('AdminMockExamsController', () => {
  test('should return 401 for unauthenticated requests', async () => {});
  test('should return 403 for non-admin users', async () => {});
  test('should validate request payload', async () => {});
});
```

### **Integration Tests**
- Test complete flow from API request to HubSpot object creation
- Verify batch API calls are made correctly
- Confirm proper error handling when HubSpot API is unavailable
- Test authentication middleware blocks unauthorized access

### **Frontend Tests**
```javascript
describe('MockExamBulkCreate Component', () => {
  test('should render time slot builder', () => {});
  test('should add new time slots dynamically', () => {});
  test('should remove time slots', () => {});
  test('should validate form before submission', () => {});
  test('should display preview of objects to be created', () => {});
});
```

### **Manual Testing Checklist**
- [ ] Verify admin authentication protects all `/admin/*` routes
- [ ] Test creating 1 mock exam object
- [ ] Test creating 10 mock exam objects simultaneously
- [ ] Verify all properties are correctly saved in HubSpot
- [ ] Test time validation (end must be after start)
- [ ] Test duplicate prevention logic
- [ ] Verify error handling displays user-friendly messages
- [ ] Test on mobile and desktop viewports
- [ ] Confirm non-admin users cannot access admin routes

---

## 🛡️ **Security & Access Control**

### **Authentication Requirements**
- All `/api/admin/*` endpoints require valid JWT token
- All `/admin/*` frontend routes protected by `ProtectedAdminRoute` component
- JWT tokens must include `role: "admin"` claim
- Tokens expire after 8 hours of inactivity

### **Authorization Rules**
```javascript
// Role hierarchy
const ROLES = {
  SUPER_ADMIN: 'super_admin',    // Full system access
  ADMIN: 'admin',                 // Mock exam management
  STAFF: 'staff',                 // Read-only access
  USER: 'user'                    // Public booking only
};

// Required role for mock exam creation
const REQUIRED_ROLE = ROLES.ADMIN;
```

### **Rate Limiting**
- Admin endpoints: 100 requests per 10 minutes per user
- Bulk create endpoint: 5 requests per minute (prevents abuse)

### **Audit Logging**
All admin actions must be logged:
```javascript
{
  timestamp: "2025-10-21T10:30:00Z",
  action: "BULK_CREATE_MOCK_EXAMS",
  admin_id: "admin_001",
  admin_email: "admin@prepdoctors.ca",
  affected_objects: 3,
  object_ids: ["mock_exam_12345", "mock_exam_12346", "mock_exam_12347"],
  ip_address: "192.168.1.100"
}
```

---

## 📊 **Non-Functional Requirements**

### **Performance**
- Single create operation: < 2 seconds
- Bulk create operation (10 objects): < 5 seconds
- Admin dashboard page load: < 1.5 seconds
- Real-time form validation: < 100ms response

### **Scalability**
- Support bulk creation of up to 50 mock exam objects per request
- Handle 20 concurrent admin users
- Optimize HubSpot batch API calls (max 100 objects per batch)

### **Reliability**
- Implement retry logic for failed HubSpot API calls (3 attempts)
- Atomic operations: All or nothing for bulk creates
- Rollback mechanism if batch creation partially fails

### **Usability**
- Intuitive interface requiring minimal training
- Clear error messages with actionable guidance
- Responsive design for tablet and desktop use
- Keyboard shortcuts for power users

---

## 📝 **Implementation Approach**

### **Phase 1: Backend Foundation (Week 1)**
1. Create admin controllers and services structure
2. Implement authentication/authorization middleware
3. Build single mock exam creation endpoint
4. Add comprehensive input validation
5. Write unit tests for services and controllers

### **Phase 2: Bulk Creation Logic (Week 1-2)**
6. Implement bulk creation service using HubSpot Batch API
7. Add time slot validation and conflict detection
8. Implement rollback mechanism for failed batches
9. Add audit logging for admin actions
10. Write integration tests

### **Phase 3: Frontend Interface (Week 2-3)**
11. Create protected admin route structure
12. Build MockExamBulkCreate component
13. Implement TimeSlotBuilder with add/remove functionality
14. Add form validation and preview modal
15. Create success/error feedback UI
16. Write frontend tests

### **Phase 4: Testing & Documentation (Week 3)**
17. Conduct end-to-end testing
18. Perform security audit
19. Write API documentation
20. Create admin user guide
21. Deploy to staging for UAT

---

## 🚀 **Success Metrics**

### **Quantitative Metrics**
- **Time Savings:** Reduce mock exam creation time from 5 min/object to < 1 min for 10 objects
- **Error Rate:** < 2% failed creations due to data entry errors
- **Adoption:** 100% of eligible admin staff using the tool within 2 weeks
- **Performance:** 95% of bulk create operations complete in < 5 seconds

### **Qualitative Metrics**
- Admin staff report increased satisfaction with workflow
- Reduction in HubSpot support tickets related to manual object creation
- Improved data consistency across mock exam objects

---

## 📅 **Timeline**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Backend Foundation | 1 week | Admin API endpoints, auth middleware, unit tests |
| Phase 2: Bulk Creation Logic | 1 week | Batch API integration, validation, integration tests |
| Phase 3: Frontend Interface | 1.5 weeks | Admin portal UI, protected routes, frontend tests |
| Phase 4: Testing & Docs | 0.5 weeks | Documentation, UAT, deployment |
| **Total** | **4 weeks** | Full admin module ready for production |

---

## ⚠️ **Risks & Mitigations**

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HubSpot API rate limits exceeded | High | Medium | Implement request batching and caching |
| Partial batch failure creates inconsistent state | High | Low | Atomic operations with rollback mechanism |
| Unauthorized access to admin routes | Critical | Low | Multi-layer authentication checks |
| Bulk creation creates duplicate sessions | Medium | Medium | Pre-creation validation against existing objects |

---

## 🔗 **Dependencies**

### **External Dependencies**
- HubSpot CRM API (Batch API v3)
- JWT authentication library
- Express.js middleware

### **Internal Dependencies**
- Existing `hubspot.js` shared service
- Current authentication system
- Mock Exams object schema (`2-50158913`)

### **Blocking Dependencies**
- Admin role definitions and user provisioning must be completed before deployment

---

## 📚 **References**

- [HubSpot Batch API Documentation](https://developers.hubspot.com/docs/api/crm/batch)
- [Mock Exam Booking System Documentation](./mocksBooking.md)
- [HubSpot Schema Documentation](./HUBSPOT_SCHEMA_DOCUMENTATION.md)
- [Security Best Practices Guide](./CLAUDE.md)

---

## ✅ **Approval Sign-off**

| Role | Name | Approval | Date |
|------|------|----------|------|
| Product Owner | | ⬜ Pending | |
| Tech Lead | | ⬜ Pending | |
| Security Lead | | ⬜ Pending | |
| QA Lead | | ⬜ Pending | |

---

**Document Version:** 1.0  
**Last Updated:** October 21, 2025  
**Next Review Date:** October 28, 2025p