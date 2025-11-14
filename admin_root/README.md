# Admin Dashboard - PrepDoctors Mock Booking System

## Overview

The Admin Dashboard is a modern React-based web application for managing the PrepDoctors Mock Booking System. It provides comprehensive tools for managing mock exam sessions, monitoring system performance, and maintaining booking data.

**Current Status**: ✅ Fully Operational (Production)

## Key Features

### Mock Exam Management
- **Dashboard View**: Real-time statistics and utilization metrics
- **Infinite Scroll**: Efficiently browse large datasets with pagination
- **Advanced Filtering**: Filter by location, type, status, and date range
- **Dual View Modes**: Toggle between aggregate (grouped) and list (individual) views
  - **Aggregate View**: Groups sessions by type, location, and date with expandable accordions
    - Client-side sorting by type, location, or date
    - Instant sort toggle (no API calls required)
    - Independent sort state from list view
    - Dark mode support for all table headers
  - **List View**: Traditional table showing individual sessions
- **Bulk Creation**: Create multiple exam sessions simultaneously
- **Single Creation**: Create individual sessions with time slot builder
- **Detail View**: View complete exam details and all associated bookings
  - Non-editable exam information display
  - Sortable, searchable bookings table
  - Pagination support (50 items per page)
  - Real-time search with debouncing
  - Capacity progress bar with color coding

### Authentication & Security
- **Supabase Auth**: Secure authentication with session persistence
- **Protected Routes**: Authentication-only access control (no role-based permissions)
- **Session Management**: Automatic token refresh and validation
- **Secure Headers**: XSS protection, frame options, and HSTS
- **Simplified Security**: Any authenticated user has full admin access

### User Experience
- **Dark Mode**: Full dark mode support with theme persistence
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Real-time Updates**: React Query for efficient data fetching
- **Performance**: Redis caching with 2-minute TTL for optimal speed

## Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **State Management**: React Context API + React Query
- **Styling**: Tailwind CSS with custom brand colors
- **Authentication**: Supabase Auth
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js serverless functions on Vercel
- **Authentication**: Supabase with JWT validation
- **Data Storage**: HubSpot CRM (custom objects)
- **Caching**: Redis (Upstash) with 2-minute TTL
- **Validation**: Joi schemas
- **API Design**: RESTful with proper error handling

### Infrastructure
- **Hosting**: Vercel (serverless)
- **Database**: HubSpot CRM
- **Cache**: Redis (Upstash)
- **Environment**: Vercel Environment Variables

## Project Structure

```
admin_root/
├── api/                              # Serverless API functions
│   ├── admin/
│   │   ├── auth/                    # Authentication endpoints
│   │   │   ├── login.js            # User login
│   │   │   ├── logout.js           # User logout
│   │   │   ├── me.js               # Get current user
│   │   │   ├── refresh.js          # Refresh token
│   │   │   └── validate.js         # Validate session
│   │   ├── middleware/              # Auth middleware
│   │   │   ├── requireAdmin.js     # Admin authentication
│   │   │   └── requireAuth.js      # Basic authentication
│   │   └── mock-exams/             # Mock exam endpoints
│   │       ├── list.js             # List with filters/pagination
│   │       ├── get.js              # Get single exam
│   │       ├── create.js           # Create single exam
│   │       ├── bulk-create.js      # Create multiple exams
│   │       ├── update.js           # Update exam
│   │       ├── delete.js           # Delete exam
│   │       └── metrics.js          # Dashboard metrics
│   ├── _shared/                     # Shared services
│   │   ├── hubspot.js              # HubSpot API integration
│   │   ├── redis.js                # Redis connection
│   │   ├── cache.js                # Caching utilities
│   │   ├── supabase.js             # Supabase clients
│   │   └── validation.js           # Joi validation schemas
│   └── health.js                   # Health check endpoint
├── admin_frontend/                  # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/              # Admin-specific components
│   │   │   │   ├── DashboardMetrics.jsx
│   │   │   │   ├── FilterBar.jsx
│   │   │   │   ├── MockExamsTable.jsx
│   │   │   │   ├── MockExamPreview.jsx
│   │   │   │   ├── TimeSlotBuilder.jsx
│   │   │   │   └── StatusBadge.jsx
│   │   │   ├── layout/             # Layout components
│   │   │   │   ├── MainLayout.jsx
│   │   │   │   └── SidebarNavigation.jsx
│   │   │   └── shared/             # Shared components
│   │   │       ├── Logo.jsx
│   │   │       └── DarkModeToggle.jsx
│   │   ├── contexts/               # React contexts
│   │   │   ├── AuthContext.jsx    # Authentication state
│   │   │   └── ThemeContext.jsx   # Theme management
│   │   ├── hooks/                  # Custom hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useMockExamsData.js
│   │   │   └── useTableFilters.js
│   │   ├── pages/                  # Page components
│   │   │   ├── Login.jsx
│   │   │   ├── MockExamsDashboard.jsx
│   │   │   └── MockExams.jsx
│   │   ├── services/               # API services
│   │   │   └── adminApi.js
│   │   ├── utils/                  # Utilities
│   │   │   └── supabaseClient.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── vercel.json                      # Vercel deployment config
├── package.json                     # Root package.json
├── README.md                        # This file
└── CURRENT_APP_STATE.md            # Detailed architecture docs
```

## Authentication Policy

### Authentication-Only Model (No Role-Based Authorization)

**Important**: This admin system uses a **simplified authentication model**:

✅ **Authentication**: Verifies user identity (logged in via Supabase)
❌ **Authorization**: No role-based permissions or access control levels
✅ **Access Policy**: Any authenticated user has full admin access
✅ **Design Philosophy**: Simplicity over complexity, faster development, easier maintenance

#### What This Means

- The `requireAdmin` middleware only verifies that a user is logged in
- It does NOT check roles, permissions, or access levels
- Any user who can successfully authenticate via Supabase has full admin privileges
- This is intentional for internal tools with a trusted user base

#### Middleware Implementation

```javascript
// admin_root/api/admin/middleware/requireAdmin.js
async function requireAdmin(req) {
  // Only verifies authentication - no role checking
  const user = await requireAuth(req);
  return user;  // No role validation
}
```

**Note**: The name `requireAdmin` is kept for backward compatibility and semantic clarity, but it only performs authentication checks.

## API Endpoints

### Authentication
All endpoints (except login) require authentication via Supabase session token. Once authenticated, users have access to all admin endpoints.

#### Auth Endpoints
- `POST /api/admin/auth/login` - User login with email/password
- `POST /api/admin/auth/logout` - User logout
- `GET /api/admin/auth/me` - Get current user details
- `POST /api/admin/auth/refresh` - Refresh access token
- `GET /api/admin/auth/validate` - Validate current session

### Mock Exam Management

#### List & Retrieve
- `GET /api/admin/mock-exams` - List exams with filters
  - Query params: `page`, `limit`, `sort_by`, `sort_order`
  - Filters: `filter_location`, `filter_mock_type`, `filter_status`, `filter_date_from`, `filter_date_to`
  - Returns: Paginated results with metrics

- `GET /api/admin/mock-exams/metrics` - Dashboard statistics
  - Returns: Total sessions, upcoming, fully booked, avg utilization

- `GET /api/admin/mock-exams/:id` - Get single exam details (legacy)

- `GET /api/admin/mock-exams/[id]` - Get detailed exam information
  - Query param: `id` (required)
  - Returns: Complete exam details with calculated fields
  - Cache: 2-minute TTL

- `GET /api/admin/mock-exams/[id]/bookings` - Get bookings for specific exam
  - Path param: `id` (exam ID)
  - Query params: `page`, `limit`, `sort_by`, `sort_order`, `search`
  - Returns: Paginated bookings with search and sort
  - Cache: 2-minute TTL

#### Create & Update
- `POST /api/admin/mock-exams/create` - Create single exam session
- `POST /api/admin/mock-exams/bulk-create` - Create multiple exam sessions
- `POST /api/admin/mock-exams/bulk-update` - Bulk update multiple exam sessions
  - Update 1-100 sessions simultaneously
  - Editable fields: location, mock_type, capacity, exam_date, is_active, scheduled_activation_datetime
  - Automatic filtering of sessions with bookings
  - Auto-regeneration of mock_exam_name when components change
- `PATCH /api/admin/mock-exams/:id` - Update exam session
- `DELETE /api/admin/mock-exams/:id` - Delete exam session

### System
- `GET /api/health` - Health check with dependency status

## Environment Variables

### Required Variables

```bash
# Supabase Configuration
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# HubSpot Configuration
HS_PRIVATE_APP_TOKEN=<your-hubspot-private-app-token>

# Redis Configuration (Upstash)
REDIS_URL=<your-redis-connection-url>

# Application Configuration
ADMIN_MODE=true
NODE_ENV=production
```

### Optional Variables

```bash
# API Configuration
VITE_API_BASE_URL=/api  # Default: /api

# Vercel Configuration
VERCEL_URL=<auto-set-by-vercel>
```

## HubSpot Integration

### Custom Objects

The application uses the following HubSpot custom objects:

**Mock Exams** (Object ID: `2-50158913`)
- `mock_type` - Type of mock exam
- `exam_date` - Date of the exam
- `start_time` - Start time (Unix timestamp)
- `end_time` - End time (Unix timestamp)
- `location` - Physical or online location
- `capacity` - Maximum number of participants
- `total_bookings` - Current booking count
- `is_active` - Active status (boolean as string: "true"/"false")

**Bookings** (Object ID: `2-50158943`)
- Associated with Mock Exams and Contacts

## Development

### Local Setup

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd admin_frontend
npm install
cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev

# Run API locally (in separate terminal)
npm run dev:api
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Building

```bash
# Build frontend
npm run build

# The build output will be in admin_frontend/dist/
```

## Deployment

### Automatic Deployment (Recommended)

Push to `main` branch triggers automatic deployment to Vercel.

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Manual Deployment

```bash
# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging
```

### Post-Deployment Checklist

1. ✅ Verify environment variables in Vercel Dashboard
2. ✅ Test login functionality
3. ✅ Verify HubSpot data loading
4. ✅ Check Redis cache connectivity
5. ✅ Test filter and sort functionality
6. ✅ Verify session persistence on refresh

## Design System

### Colors (Tailwind Tokens)

```javascript
primary: {
  50: '#E6F2F9',
  100: '#CCE5F3',
  500: '#0660B2',  // Primary brand blue
  600: '#054E91',  // Primary button color
  700: '#043D73',  // Primary hover
  900: '#02376D'   // Navy blue
}

// Status colors
success: '#10B981'   // Green
warning: '#F59E0B'   // Yellow
error: '#EF4444'     // Red
info: '#3B82F6'      // Blue
```

### Typography

- **Headlines**: Museo font family (`font-headline`)
- **Subheadings**: Montserrat (`font-subheading`)
- **Body**: Karla (`font-body`)

## Monitoring & Debugging

### Health Check

```bash
curl https://your-admin-domain.vercel.app/api/health
```

### Logs

```bash
# View production logs
vercel logs --prod

# View specific function logs
vercel logs --prod api/admin/mock-exams/list.js
```

### Common Issues

1. **Blank page on load**
   - Check Supabase environment variables
   - Verify VITE_ prefix is present for frontend vars

2. **401 Unauthorized errors**
   - Check session persistence in localStorage
   - Verify Supabase tokens are valid

3. **Filters not working**
   - Check Redis cache connectivity
   - Verify HubSpot property names match

## Performance Optimization

### Caching Strategy
- **Redis TTL**: 2 minutes for list endpoints
- **React Query**: Stale time of 30 seconds
- **Infinite Scroll**: Pages cached individually

### Load Times
- Initial page load: < 2 seconds
- Subsequent navigation: < 500ms
- API response (cached): < 100ms
- API response (uncached): < 1 second

## Security Features

### Authentication
- Supabase authentication with JWT
- Session persistence in localStorage
- Automatic token refresh
- Secure logout with cleanup

### API Security
- CORS configured for admin domain only
- Rate limiting on auth endpoints (5 attempts per 15 min)
- Input validation with Joi schemas
- SQL injection prevention via HubSpot API

### Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security

## Support & Documentation

- **Documentation Index**: See `DOCUMENTATION_INDEX.md` - Complete guide to all documentation
- **Feature Documentation**: See `FEATURES.md` - Comprehensive feature guides and user flows
- **Detailed Architecture**: See `CURRENT_APP_STATE.md` - Complete system architecture
- **API Documentation**: See `documentation/api/` - API endpoint references
- **Frontend Documentation**: See `documentation/frontend/` - Component documentation
- **HubSpot Schema**: See `documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md` - CRM schema details

### Recent Feature Documentation
- **Aggregate Sorting**: See `AGGREGATE_SORTING_IMPLEMENTATION.md` - Client-side sorting feature documentation
- **Feature Summary v2.2.0**: See `FEATURE_SUMMARY_v2.2.0.md` - Quick reference for v2.2.0 features
- **API Optimizations**: See `OPTIMIZATION_IMPLEMENTATION_SUMMARY.md` - Performance optimization details
- **Preloaded Sessions**: See `IMPLEMENTATION_SUMMARY.md` - Aggregate session preloading implementation

## License

Private - PrepDoctors Internal Use Only

---

**Version**: 2.2.0
**Last Updated**: January 14, 2025
**Status**: ✅ Production Ready
**Production URL**: https://your-admin-domain.vercel.app

## Recent Changes

**v2.2.0** (October 27, 2025):
- Added client-side sorting for aggregate view
  - Three sortable columns: Type, Location, and Date
  - Instant sorting without API calls
  - Toggle ascending/descending order
  - Independent sort state from list view
  - Default sort by exam date (ascending)
- Enhanced aggregate view table structure
  - Replaced single colspan header with four separate columns
  - Improved column alignment in expanded sessions
  - Added dark mode support to all table headers
  - Visual indicators with emoji icons (📍 location, 📅 date)

**v2.2.0** (January 14, 2025):
- Added Bulk Edit feature for mock exam sessions
  - Update 1-100 sessions simultaneously
  - 6 editable properties (location, mock_type, capacity, exam_date, is_active, scheduled_activation_datetime)
  - Smart filtering: automatically excludes sessions with bookings
  - Auto-regeneration of mock_exam_name when components change
  - Batch processing with HubSpot API
  - Partial failure handling with detailed feedback
  - 85% time savings for bulk updates

**v2.1.0** (January 24, 2025):
- Added Mock Exam Detail View feature with booking management
- New sortable, searchable bookings table with pagination
- Capacity progress bar with color-coded indicators
- Enhanced navigation with "View" button in mock exams table
- Full dark mode and responsive design support
