# PrepDoctors Mock Exam Booking System

A full-stack web application for booking mock exams at PrepDoctors, built using the PrepDoctors HubSpot Automation Framework with HubSpot CRM as the single source of truth.

## 🏗️ Architecture Overview

### Tech Stack
- **Backend**: Node.js serverless functions on Vercel
- **Frontend**: React 18 + Vite with Tailwind CSS
- **CRM (Source of Truth)**: HubSpot API integration
- **Secondary Database**: Supabase for read-optimized queries
- **Validation**: Joi schemas for input validation
- **Testing**: Jest with >70% coverage requirement

### Framework Principles
- **KISS (Keep It Simple, Stupid)**: Straightforward solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)**: Build only what's needed
- **Two-Tier Database**: HubSpot as source of truth + Supabase for read optimization
- **Write-Through Pattern**: Write to HubSpot → Immediately sync to Supabase
- **Serverless-First**: Vercel functions with 60-second timeout awareness

## 📁 Project Structure

```
mocks_booking/
├── admin_root/                    # Admin Application
│   ├── api/
│   │   ├── _shared/               # Shared Services & Utilities
│   │   │   ├── auth.js           # Authentication middleware
│   │   │   ├── hubspot.js        # HubSpot service layer
│   │   │   ├── validation.js     # Joi validation schemas
│   │   │   ├── cache.js          # Redis-based caching layer
│   │   │   ├── supabaseSync.js   # Supabase sync utilities (NEW)
│   │   │   └── supabase-data.js  # Supabase data layer (NEW)
│   │   └── admin/cron/
│   │       └── sync-supabase.js  # Cron job for HubSpot → Supabase sync (NEW)
├── user_root/                     # User Application
│   ├── api/
│   │   ├── _shared/               # Shared Services & Utilities
│   │   │   ├── auth.js           # Authentication middleware
│   │   │   ├── hubspot.js        # HubSpot service layer with rate limiting
│   │   │   ├── validation.js     # Joi validation schemas
│   │   │   ├── cache.js          # Redis-based caching layer
│   │   │   ├── redis.js          # Distributed locking service
│   │   │   └── supabase-data.js  # Supabase data layer (NEW)
│   ├── bookings/                 # Booking Management
│   │   └── create.js            # Create booking endpoint
│   ├── mock-exams/              # Mock Exam Services
│   │   ├── available.js         # Fetch available sessions
│   │   ├── sync-capacity.js     # Capacity synchronization
│   │   └── validate-credits.js  # Credit validation
│   ├── mock-discussions/        # Mock Discussion Services (NEW)
│   │   ├── available.js         # Fetch available discussion sessions
│   │   ├── validate-credits.js  # Validate mock_discussion_token
│   │   └── create-booking.js    # Create discussion booking
│   └── webhooks/                # External Integrations
│       └── booking-sync.js      # HubSpot webhook handler
├── frontend/                     # React Frontend Application
│   ├── src/
│   │   ├── components/          # React Components
│   │   │   ├── shared/          # Reusable UI Components
│   │   │   │   ├── CalendarView.jsx      # Calendar interface
│   │   │   │   ├── CapacityBadge.jsx     # Capacity indicators
│   │   │   │   ├── CreditAlert.jsx       # Credit warnings
│   │   │   │   ├── Logo.jsx              # Brand components
│   │   │   │   ├── SessionDrawer.jsx     # Session details
│   │   │   │   └── SidebarNavigation.jsx # Vertical nav with submenus
│   │   │   ├── dashboard/       # Dashboard Components (NEW v1.5.0)
│   │   │   │   ├── Dashboard.jsx         # Main dashboard page
│   │   │   │   ├── ThisWeekActivities.jsx # Activities section
│   │   │   │   ├── ActivityCard.jsx      # Individual activity display
│   │   │   │   ├── BookingWizard.jsx     # Two-card wizard section
│   │   │   │   ├── MockExamCard.jsx      # Mock exam booking card
│   │   │   │   └── WorkCheckCard.jsx     # Work check booking card
│   │   │   ├── BookingConfirmation.jsx   # Confirmation flow
│   │   │   ├── BookingForm.jsx           # Booking interface
│   │   │   ├── ExamSessionsList.jsx      # Session listings
│   │   │   ├── ExamTypeSelector.jsx      # Exam type selection
│   │   │   ├── LoginForm.jsx             # Authentication
│   │   │   ├── MyBookings.jsx            # Booking management page
│   │   │   └── bookings/                 # Booking-specific components
│   │   │       ├── BookingsList.jsx      # List view for bookings
│   │   │       ├── BookingsCalendar.jsx  # Calendar view for bookings
│   │   │       └── ExistingBookingsCard.jsx # Compact booking card
│   │   ├── pages/               # Page Components
│   │   │   └── MockDiscussions.jsx       # Mock discussions page (NEW)
│   │   ├── hooks/               # Custom React Hooks
│   │   │   ├── useBookingFlow.js         # Booking state management
│   │   │   ├── useCachedCredits.js       # Credit caching hook
│   │   │   └── useDashboard.js           # Dashboard data fetching (NEW v1.5.0)
│   │   ├── services/            # API Integration Layer
│   │   │   └── api.js                    # Axios configuration & utilities
│   │   └── utils/               # Frontend Utilities
│   │       └── auth.js                   # Authentication helpers
│   └── dist/                    # Production build output
├── documentation/               # Technical Documentation
│   ├── HUBSPOT_SCHEMA_DOCUMENTATION.md  # HubSpot object schemas
│   ├── MOCK_DISCUSSIONS_MODULE.md       # Mock Discussions documentation (NEW)
│   └── AGENT_DEVELOPER_COORDINATION_RULES.md  # Development protocols
├── tests/                       # Comprehensive Test Suite
│   ├── unit/                    # Unit tests
│   ├── integration/             # API integration tests
│   └── e2e/                     # End-to-end tests
└── vercel.json                  # Deployment configuration
```

## 🔧 Core Architecture Components

### Backend Services (`api/_shared/`)

#### HubSpot Service Layer (`hubspot.js`)
- Centralized HubSpot API integration with rate limiting
- Custom object management (Mock Exams, Bookings, Contacts)
- Batch operations for performance optimization
- Error handling with exponential backoff

#### Authentication (`auth.js`)
- Token-based authentication middleware
- Request validation and sanitization
- CORS configuration for cross-origin requests

#### Validation (`validation.js`)
- Joi schema definitions for all endpoints
- Input sanitization and type validation
- Consistent error response formatting

### API Endpoints

#### Dashboard (NEW - v1.5.0)
- `GET /api/dashboard` - Unified dashboard data endpoint
  - Returns user info, this week's activities, tokens, and groups
  - Uses parallel queries for efficiency (Supabase)
  - Auto-calculates week range (Monday to Sunday)

#### Mock Exam Management
- `GET /api/mock-exams/available` - Fetch available exam sessions
- `POST /api/mock-exams/validate-credits` - Validate user credits
- `POST /api/mock-exams/sync-capacity` - Synchronize session capacity

#### Mock Discussion Management
- `GET /api/mock-discussions/available` - Fetch available discussion sessions
- `POST /api/mock-discussions/validate-credits` - Validate mock_discussion_token
- `POST /api/mock-discussions/create-booking` - Create discussion booking with idempotency

#### Booking Management
- `POST /api/bookings/create` - Create new booking with validation
- `GET /api/bookings/list` - List user bookings with filtering and pagination
- `GET /api/bookings/[id]` - Get individual booking details with associations
- `DELETE /api/bookings/[id]` - Cancel booking with automatic credit restoration

#### Admin - Mock Exam Management
- `PATCH /api/admin/mock-exams/[id]/cancel-bookings` - Batch cancel bookings with optional token refunds
  - Supports bulk cancellation of up to 100 bookings
  - Optional automatic token refund to trainees
  - Partial failure handling with detailed results
  - Audit logging to mock exam timeline

#### Webhooks
- `POST /api/webhooks/booking-sync` - HubSpot data synchronization

### Frontend Architecture (`frontend/src/`)

#### Component Structure
- **Shared Components**: Reusable UI elements with consistent styling
- **Feature Components**: Booking flow, exam selection, confirmation, booking management
- **Layout Components**: Authentication, routing, error boundaries
- **Booking Components**: Specialized components for viewing and managing bookings
- **Dashboard Components**: User dashboard with activities, tokens, and booking wizards (NEW v1.5.0)

#### State Management
- Custom hooks for booking flow state
- React Context for authentication state
- Local state for UI interactions

#### Services Layer
- Axios-based API client with interceptors
- Request/response transformation
- Error handling and retry logic

## 🛠️ Development Workflow

### Framework Commands
```bash
# Development
npm run dev                 # Start backend with nodemon
cd frontend && npm run dev  # Start Vite dev server
vercel dev                 # Local serverless development

# Testing
npm test                   # Run Jest test suite
npm run test:coverage      # Generate coverage report
npm run test:integration   # Integration tests

# Deployment
vercel                     # Deploy to staging
vercel --prod             # Deploy to production

# HubSpot Integration
npm run verify:hubspot-schema  # Verify HubSpot object schemas
```

### Quality Gates
- **Test Coverage**: Minimum 70% coverage required
- **HubSpot Integration**: All operations use HubSpot as single source of truth
- **Security**: Joi validation for all inputs, no hardcoded secrets
- **Performance**: Serverless functions under 60-second timeout

## 🔒 Security & Compliance

### Input Validation
- All endpoints use Joi schemas for validation
- XSS protection through input sanitization
- SQL injection prevention (no local database)

### Authentication
- Token-based authentication system
- Secure credential validation through HubSpot
- CORS protection for cross-origin requests

### Data Privacy
- HubSpot CRM as secure data repository
- No local data storage or caching
- Audit trail through HubSpot deal timelines

## 📊 HubSpot Integration (Source of Truth)

### Custom Objects
- **Mock Exams (2-50158913)**: Session definitions with capacity management
  - Supports multiple types: Situational Judgment, Clinical Skills, Mini-mock, Mock Discussion
  - Synced to Supabase: `hubspot_mock_exams` table

- **Bookings (2-50158943)**: Student reservations linked to contacts
  - Unified booking object for both exams and discussions
  - Token refund tracking properties: `token_refunded`, `token_refunded_at`, `token_refund_admin`
  - Contact association: `associated_contact_id` (links booking to contact for refunds)
  - Synced to Supabase: `hubspot_bookings` table

- **Contacts (0-1)**: Student profiles with credit tracking
  - Credit properties: `sj_credits`, `cs_credits`, `sjmini_credits`, `mock_discussion_token`, `shared_mock_credits`
  - Credits automatically updated during booking/cancellation operations
  - **Synced to Supabase: `hubspot_contact_credits` table (NEW - 90% faster reads)**

### Data Flow
1. **Write Operations**: Frontend requests → API validation → HubSpot update → **Immediate Supabase sync (non-blocking)**
2. **Read Operations**: Frontend requests → API → **Try Supabase first (~50ms) → Fallback to HubSpot (~500ms)**
3. **Auto-Populate**: Cache miss → HubSpot query → Populate Supabase for future requests
4. **Cron Sync**: Every 2 hours sync HubSpot → Supabase (exams, bookings, contact credits)
5. Webhook notifications for real-time synchronization
6. Capacity management through HubSpot properties
7. Audit logging in deal timelines

### Performance Improvements
- **Credit validation**: ~450ms faster (90% improvement)
- **Real-time sync**: No more 2-hour staleness window
- **Reduced API load**: ~70% of credit reads served from Supabase

## 🚀 Deployment

### Vercel Configuration
- Frontend built from `frontend/dist`
- API routes deployed as serverless functions
- Environment variables for HubSpot integration
- Automatic deployments from Git

### Environment Setup
```bash
# Required environment variables
HUBSPOT_PRIVATE_APP_TOKEN=your_hubspot_token
CORS_ORIGIN=your_frontend_domain
REDIS_URL=your_redis_connection_string  # For caching and distributed locking
CRON_SECRET=your_cron_secret  # For scheduled jobs

# Supabase Configuration (NEW - v1.2.0)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_SCHEMA_NAME=public  # Optional, defaults to public
```

## 📈 Performance Considerations

### Backend Optimization
- **Two-Tier Database Architecture**: Supabase for fast reads, HubSpot as source of truth
- **90% faster credit queries**: ~50ms (Supabase) vs ~500ms (HubSpot API)
- HubSpot API rate limiting and batch operations
- Efficient serverless function architecture
- Stateless design for scalability
- Non-blocking write-through sync pattern

### Frontend Optimization
- React 18 with Vite for fast development builds
- Tailwind CSS for optimized styling
- Lazy loading and code splitting

## 🧪 Testing Strategy

### Unit Tests
- Individual function and component testing
- Mock HubSpot API responses
- Validation schema testing

### Integration Tests
- End-to-end API workflow testing
- HubSpot integration validation
- Error handling verification

### Manual Testing
- User flow validation scripts
- HubSpot data integrity checks
- Performance and load testing

## 📚 Additional Documentation

For detailed module documentation, see:

### User-Facing Features

- **[Mock Discussions Module](documentation/MOCK_DISCUSSIONS_MODULE.md)** - Complete documentation for the mock discussions booking system
  - API endpoints and request/response formats
  - Frontend components and state management
  - HubSpot configuration requirements
  - Token management and validation logic
  - Testing procedures and deployment checklist
  - Known limitations and future enhancements

### Admin Features

- **[Token Refund API](documentation/api/TOKEN_REFUND_API.md)** - Technical API documentation for token refund system
  - Endpoint specification and request/response schemas
  - Token type mapping and property names
  - Performance characteristics and batch optimization
  - Error handling and troubleshooting

- **[Token Refund User Guide](documentation/user_guides/TOKEN_REFUND_USER_GUIDE.md)** - Admin user guide for token refunds
  - How to use the refund feature
  - When to enable/disable refunds
  - Understanding refund results
  - Troubleshooting failed refunds

- **[Deployment Guide](documentation/DEPLOYMENT_GUIDE.md)** - Production deployment procedures
  - Pre-deployment checklist (HubSpot properties, tests, builds)
  - Deployment steps and verification
  - Post-deployment validation and smoke tests
  - Rollback procedures

### System Documentation

- **[HubSpot Schema Documentation](documentation/HUBSPOT_SCHEMA_DOCUMENTATION.md)** - Complete HubSpot CRM integration reference
- **[Agent Developer Coordination Rules](documentation/AGENT_DEVELOPER_COORDINATION_RULES.md)** - Development protocols

## 📝 Contributing

This project follows the PrepDoctors HubSpot Automation Framework:

1. **PRD-Driven Development**: Create comprehensive plans before implementation
2. **Specialized Agents**: Use domain-specific developers for each layer
3. **HubSpot-Centric**: Always use HubSpot as the single source of truth
4. **Quality Gates**: Ensure >70% test coverage and security compliance
5. **Documentation**: Keep technical documentation current with code changes

For detailed development protocols, see `documentation/AGENT_DEVELOPER_COORDINATION_RULES.md`.