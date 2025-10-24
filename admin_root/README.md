# Admin Dashboard - PrepDoctors Mock Booking System

## Overview

The Admin Dashboard is a modern React-based web application for managing the PrepDoctors Mock Booking System. It provides comprehensive tools for managing mock exam sessions, monitoring system performance, and maintaining booking data.

**Current Status**: ✅ Fully Operational (Production)

## Key Features

### Mock Exam Management
- **Dashboard View**: Real-time statistics and utilization metrics
- **Infinite Scroll**: Efficiently browse large datasets with pagination
- **Advanced Filtering**: Filter by location, type, status, and date range
- **Bulk Creation**: Create multiple exam sessions simultaneously
- **Single Creation**: Create individual sessions with time slot builder

### Authentication & Security
- **Supabase Auth**: Secure authentication with session persistence
- **Protected Routes**: Role-based access control
- **Session Management**: Automatic token refresh and validation
- **Secure Headers**: XSS protection, frame options, and HSTS

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

## API Endpoints

### Authentication
All endpoints (except login) require authentication via Supabase session token.

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

- `GET /api/admin/mock-exams/:id` - Get single exam details

#### Create & Update
- `POST /api/admin/mock-exams/create` - Create single exam session
- `POST /api/admin/mock-exams/bulk-create` - Create multiple exam sessions
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

- **Detailed Architecture**: See `CURRENT_APP_STATE.md`
- **API Documentation**: See `documentation/api/`
- **Frontend Documentation**: See `documentation/frontend/`
- **HubSpot Schema**: See `documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md`

## License

Private - PrepDoctors Internal Use Only

---

**Version**: 2.0.0
**Last Updated**: January 24, 2025
**Status**: ✅ Production Ready
**Production URL**: https://your-admin-domain.vercel.app
