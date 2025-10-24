# Current App State - Admin Dashboard Architecture

**Last Updated**: January 24, 2025
**Version**: 2.0.0
**Status**: Production

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication System](#authentication-system)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Flow](#data-flow)
6. [Caching Strategy](#caching-strategy)
7. [State Management](#state-management)
8. [Component Architecture](#component-architecture)
9. [API Integration](#api-integration)
10. [Performance Optimization](#performance-optimization)
11. [Security Implementation](#security-implementation)
12. [Deployment Pipeline](#deployment-pipeline)

---

## Architecture Overview

The Admin Dashboard follows a **serverless architecture** with a React frontend and Node.js backend functions deployed on Vercel. Data is stored in HubSpot CRM and cached in Redis for performance.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel Edge Network                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Static Frontend (SPA)                  │ │
│  │  React 18 + Vite + Tailwind CSS + React Query          │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            Serverless API Functions (Node.js)          │ │
│  │  Authentication │ Mock Exams │ Health Check            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐  ┌──────────┐  ┌────────────┐
    │   Supabase   │  │ HubSpot  │  │   Redis    │
    │     Auth     │  │   CRM    │  │  (Upstash) │
    └──────────────┘  └──────────┘  └────────────┘
```

### Key Design Decisions

1. **Serverless-First**: All backend logic runs as Vercel serverless functions
2. **Single Page Application**: React SPA with client-side routing
3. **HubSpot as Database**: No traditional database, HubSpot CRM stores all data
4. **Redis Caching**: 2-minute TTL to reduce HubSpot API calls
5. **Supabase Auth**: Centralized authentication with JWT tokens
6. **Infinite Scroll**: Pagination optimized for large datasets

---

## Authentication System

### Supabase Integration

The application uses **Supabase** for authentication instead of custom JWT tokens. This provides:
- Built-in session management
- Automatic token refresh
- Secure password hashing
- Row-level security ready

### Authentication Flow

```
1. User Login
   ├─> Frontend: Login.jsx form submission
   ├─> Backend: POST /api/admin/auth/login
   │   ├─> Supabase: signInWithPassword()
   │   ├─> Returns: { access_token, refresh_token, user }
   │   └─> Backend returns session to frontend
   ├─> Frontend: supabase.auth.setSession()
   │   ├─> Stores session in localStorage (sb-*-auth-token)
   │   └─> Updates AuthContext state
   └─> Redirect to dashboard

2. Session Persistence
   ├─> On page load: AuthContext initialization
   ├─> supabase.auth.getSession()
   ├─> If session exists: Restore user state
   └─> If expired: Attempt token refresh

3. Token Refresh
   ├─> Automatic: Supabase SDK handles refresh
   ├─> Manual: POST /api/admin/auth/refresh
   └─> Updates session in localStorage

4. Logout
   ├─> Frontend: AuthContext.signOut()
   ├─> Backend: POST /api/admin/auth/logout
   ├─> Supabase: auth.signOut()
   └─> Clear localStorage and redirect to login
```

### Session Storage

**Critical Fix Applied**:
- Previously used custom storage adapter causing double-serialization
- Now uses native `window.localStorage`
- Supabase handles JSON serialization internally
- Session keys: `sb-{project-id}-auth-token`

### Authentication Context

**Location**: `admin_frontend/src/contexts/AuthContext.jsx`

```javascript
const AuthContext = {
  user: Object,              // Current user object
  session: Object,           // Supabase session with tokens
  loading: Boolean,          // Initial auth loading state
  configError: String|null,  // Supabase config errors
  signIn: Function,          // Login method
  signOut: Function,         // Logout method
  validateSession: Function, // Check if session valid
  refreshToken: Function,    // Manually refresh token
  isAuthenticated: Function  // Check auth status
}
```

### Protected Routes

**Location**: `admin_frontend/src/components/admin/ProtectedAdminRoute.jsx`

- Wraps all authenticated pages
- Checks `isAuthenticated()` before rendering
- Redirects to `/login` if not authenticated
- Shows loading state during auth check

---

## Frontend Architecture

### Technology Stack

- **React 18**: Latest React with Concurrent Rendering
- **Vite**: Ultra-fast build tool and dev server
- **React Router v6**: Client-side routing with nested routes
- **React Query**: Server state management and caching
- **Tailwind CSS**: Utility-first CSS framework
- **Axios**: HTTP client with interceptors

### Project Structure (Detailed)

```
admin_frontend/src/
├── App.jsx                          # Root component with routing
├── main.jsx                         # Entry point, renders App
│
├── components/
│   ├── admin/                       # Admin-specific components
│   │   ├── DashboardMetrics.jsx    # 4 metric cards (total, upcoming, etc.)
│   │   ├── FilterBar.jsx           # Search + filters (location, type, status, dates)
│   │   ├── MockExamsTable.jsx      # Infinite scroll table with sorting
│   │   ├── MockExamPreview.jsx     # Preview card for bulk creation
│   │   ├── TimeSlotBuilder.jsx     # Time slot picker component
│   │   ├── StatusBadge.jsx         # Colored status badges
│   │   └── ProtectedAdminRoute.jsx # Auth wrapper for routes
│   │
│   ├── layout/                      # Layout components
│   │   ├── MainLayout.jsx          # Main app layout with sidebar
│   │   └── SidebarNavigation.jsx   # Vertical navigation menu
│   │
│   └── shared/                      # Reusable components
│       ├── Logo.jsx                 # PrepDoctors logo
│       └── DarkModeToggle.jsx      # Theme switcher
│
├── contexts/                        # React Context providers
│   ├── AuthContext.jsx             # Authentication state & methods
│   └── ThemeContext.jsx            # Dark mode state & toggle
│
├── hooks/                           # Custom React hooks
│   ├── useAuth.js                  # Hook to access AuthContext
│   ├── useMockExamsData.js         # React Query hook for infinite scroll
│   └── useTableFilters.js          # Filter state management
│
├── pages/                           # Page-level components
│   ├── Login.jsx                    # Login page with form
│   ├── MockExamsDashboard.jsx      # Dashboard with metrics & table
│   └── MockExams.jsx                # Create/bulk create page
│
├── services/                        # API service layer
│   └── adminApi.js                  # Axios instance with auth interceptors
│
├── utils/                           # Utility functions
│   └── supabaseClient.js           # Supabase client configuration
│
└── styles/
    └── index.css                    # Global styles & Tailwind imports
```

### Component Hierarchy

```
App.jsx
├── ThemeProvider
│   └── AuthProvider
│       ├── Router
│       │   ├── Route: /login → Login.jsx
│       │   └── Route: /* → MainLayout.jsx
│       │       ├── SidebarNavigation.jsx
│       │       └── Outlet
│       │           ├── Route: /dashboard → MockExamsDashboard.jsx
│       │           │   ├── DashboardMetrics.jsx
│       │           │   ├── FilterBar.jsx
│       │           │   └── MockExamsTable.jsx
│       │           │       └── StatusBadge.jsx (per row)
│       │           └── Route: /mock-exams → MockExams.jsx
│       │               ├── Single Mode:
│       │               │   └── TimeSlotBuilder.jsx
│       │               └── Bulk Mode:
│       │                   └── MockExamPreview.jsx (per exam)
```

### Routing Configuration

**Location**: `admin_frontend/src/App.jsx`

```javascript
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<ProtectedAdminRoute />}>
    <Route element={<MainLayout />}>
      <Route path="/dashboard" element={<MockExamsDashboard />} />
      <Route path="/mock-exams" element={<MockExams />} />
      <Route path="/mock-exams/create" element={<MockExams />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Route>
</Routes>
```

### State Management Strategy

**1. Server State (React Query)**
- Used for: API data (mock exams, metrics)
- Benefits: Automatic caching, refetching, background updates
- Example: `useMockExamsData` hook

**2. Authentication State (Context)**
- Used for: User session, auth methods
- Benefits: Global access, persist across navigation
- Provider: `AuthContext`

**3. Theme State (Context)**
- Used for: Dark mode toggle
- Benefits: Persist to localStorage, global access
- Provider: `ThemeContext`

**4. Local State (useState)**
- Used for: Form inputs, UI state (modals, dropdowns)
- Benefits: Component-scoped, simple to reason about

---

## Backend Architecture

### Serverless Functions

All backend logic runs as **Vercel Serverless Functions** with:
- **Runtime**: Node.js 20.x
- **Max Duration**: 60 seconds
- **Memory**: 1024MB (default)
- **Region**: Auto (closest to user)

### API Structure

```
api/
├── admin/
│   ├── auth/
│   │   ├── login.js          # POST - User login
│   │   ├── logout.js         # POST - User logout
│   │   ├── me.js             # GET - Get current user
│   │   ├── refresh.js        # POST - Refresh tokens
│   │   └── validate.js       # GET - Validate session
│   │
│   ├── middleware/
│   │   ├── requireAdmin.js   # Validates Supabase JWT
│   │   └── requireAuth.js    # Basic auth check
│   │
│   └── mock-exams/
│       ├── list.js           # GET - List with filters/pagination
│       ├── get.js            # GET - Get single exam by ID
│       ├── create.js         # POST - Create single exam
│       ├── bulk-create.js    # POST - Create multiple exams
│       ├── update.js         # PATCH - Update exam
│       ├── delete.js         # DELETE - Delete exam
│       └── metrics.js        # GET - Dashboard statistics
│
├── _shared/
│   ├── hubspot.js            # HubSpot API service class
│   ├── redis.js              # Redis connection
│   ├── cache.js              # Cache get/set utilities
│   ├── supabase.js           # Supabase clients (public & service)
│   └── validation.js         # Joi validation schemas
│
└── health.js                 # GET - Health check endpoint
```

### Shared Services

#### 1. HubSpot Service (`_shared/hubspot.js`)

**Purpose**: Centralized HubSpot API integration

**Key Methods**:
```javascript
class HubSpotService {
  // Mock Exams
  async listMockExams(options)      // Search with filters
  async getMockExam(id)             // Get by ID
  async createMockExam(data)        // Create single
  async bulkCreateMockExams(exams)  // Batch create
  async updateMockExam(id, data)    // Update properties
  async deleteMockExam(id)          // Soft/hard delete

  // Metrics
  async getMockExamMetrics()        // Dashboard statistics

  // Utility
  async apiCall(method, endpoint, data)  // Base API caller
}
```

**Features**:
- Automatic retry with exponential backoff
- Rate limit handling (429 responses)
- Error logging and formatting
- Property mapping (frontend ↔ HubSpot)

#### 2. Cache Service (`_shared/cache.js`)

**Purpose**: Redis caching layer

**Interface**:
```javascript
const cache = getCache();

await cache.get(key)              // Returns parsed JSON or null
await cache.set(key, value, ttl)  // Stores with TTL in seconds
await cache.del(key)              // Delete specific key
await cache.clear(pattern)        // Delete by pattern
```

**Usage**:
- List endpoints: 2-minute TTL
- Single exam lookups: 5-minute TTL
- Metrics: 1-minute TTL
- Cache invalidation on create/update/delete

#### 3. Validation Service (`_shared/validation.js`)

**Purpose**: Joi schema validation for all endpoints

**Schemas**:
```javascript
{
  mockExamList: {        // GET /api/admin/mock-exams
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort_by: Joi.string().valid('date', 'location', 'type'),
    sort_order: Joi.string().valid('asc', 'desc').default('asc'),
    filter_location: Joi.string().optional(),
    filter_mock_type: Joi.string().optional(),
    filter_status: Joi.string().valid('all', 'active', 'inactive'),
    filter_date_from: Joi.string().isoDate().optional(),
    filter_date_to: Joi.string().isoDate().optional(),
    search: Joi.string().optional()
  },

  mockExamCreate: {      // POST /api/admin/mock-exams/create
    mock_type: Joi.string().required(),
    exam_date: Joi.string().isoDate().required(),
    start_time: Joi.number().integer().required(),  // Unix timestamp
    end_time: Joi.number().integer().required(),
    location: Joi.string().required(),
    capacity: Joi.number().integer().min(1).required(),
    is_active: Joi.boolean().default(true)
  }
}
```

#### 4. Supabase Service (`_shared/supabase.js`)

**Purpose**: Supabase client configuration

**Exports**:
```javascript
// Public client (frontend + backend)
export const supabasePublic = createClient(url, anonKey);

// Service client (backend only, bypasses RLS)
export const supabaseService = createClient(url, serviceRoleKey);
```

**Usage**:
- Login: `supabasePublic.auth.signInWithPassword()`
- Verify JWT: `supabaseService.auth.getUser(token)`
- Admin operations: Uses service client

---

## Data Flow

### List Mock Exams (with Caching)

```
1. Frontend Request
   └─> useInfiniteQuery({
         queryKey: ['mock-exams', filters],
         queryFn: adminApi.listMockExams
       })

2. API Request
   └─> GET /api/admin/mock-exams?page=1&limit=20&filter_location=Calgary

3. Backend Processing (list.js)
   ├─> Validate query params with Joi
   ├─> Check admin authentication
   ├─> Generate cache key: `admin:mock-exams:list:{filters}`
   ├─> Check Redis cache
   │   ├─> Cache HIT: Return cached data (< 50ms)
   │   └─> Cache MISS: Continue to HubSpot
   │
   └─> HubSpot Query (if cache miss)
       ├─> Build search filters
       │   ├─> Location filter: property='location', operator='EQ'
       │   ├─> Status filter: property='is_active', value='true'/'false'
       │   └─> Date range: property='exam_date', operator='GTE'/'LTE'
       │
       ├─> Execute search API call
       │   └─> POST /crm/v3/objects/2-50158913/search
       │
       ├─> Transform results
       │   ├─> Calculate utilization_rate
       │   ├─> Determine status (upcoming/full/past/inactive)
       │   ├─> Format times (Unix → 12-hour AM/PM)
       │   └─> Map properties to frontend format
       │
       ├─> Cache response (2-minute TTL)
       └─> Return JSON response

4. Frontend Updates
   ├─> React Query updates cache
   ├─> Component re-renders with new data
   └─> Infinite scroll loads next page on scroll
```

### Create Mock Exam

```
1. Frontend Submission
   └─> Form data collected from MockExams.jsx
       ├─> Single mode: One exam object
       └─> Bulk mode: Array of exam objects

2. API Request
   └─> POST /api/admin/mock-exams/create (single)
       OR
       POST /api/admin/mock-exams/bulk-create (multiple)

3. Backend Processing
   ├─> Validate request body with Joi
   ├─> Check admin authentication
   ├─> Transform data for HubSpot
   │   ├─> Convert date to ISO format
   │   ├─> Convert times to Unix timestamps
   │   ├─> Set default values (total_bookings: 0)
   │   └─> Map frontend fields to HubSpot properties
   │
   ├─> Create in HubSpot
   │   ├─> Single: POST /crm/v3/objects/2-50158913
   │   └─> Bulk: POST /crm/v3/objects/2-50158913/batch/create
   │
   ├─> Invalidate relevant caches
   │   └─> DELETE keys matching: admin:mock-exams:list:*
   │
   └─> Return created exam(s) with HubSpot IDs

4. Frontend Updates
   ├─> Show success notification
   ├─> Invalidate React Query cache
   ├─> Redirect to dashboard
   └─> Table automatically refetches with new data
```

### Authentication Flow (Detailed)

```
1. Login Form Submission
   └─> Login.jsx: handleSubmit()
       ├─> Validate email/password format
       ├─> Set loading state
       └─> Call AuthContext.signIn(email, password, rememberMe)

2. AuthContext.signIn()
   └─> POST /api/admin/auth/login { email, password, rememberMe }

3. Backend Login (login.js)
   ├─> Validate request body
   ├─> Check rate limiting (5 attempts per 15 min)
   ├─> Call supabasePublic.auth.signInWithPassword()
   ├─> If error: Increment failed attempts, return 401
   ├─> If success:
   │   ├─> Extract { user, session } from response
   │   ├─> Set cookie if rememberMe (7-day expiry)
   │   └─> Return { user, session } with BOTH tokens
   │       (access_token AND refresh_token - critical for persistence)

4. Frontend Session Setup
   ├─> Receive response from backend
   ├─> Call supabase.auth.setSession({ access_token, refresh_token })
   │   └─> Supabase stores in localStorage: sb-*-auth-token
   ├─> Update AuthContext state
   │   ├─> setUser(user)
   │   ├─> setSession(session)
   │   └─> Store tokens in localStorage (redundant backup)
   └─> Redirect to /dashboard

5. Session Persistence (on page refresh)
   ├─> AuthContext useEffect runs
   ├─> supabase.auth.onAuthStateChange() listener set up
   ├─> Fires INITIAL_SESSION event
   ├─> If session found in localStorage:
   │   ├─> Restore session to state
   │   ├─> User stays logged in
   │   └─> Set loading = false
   └─> If no session: Redirect to /login
```

---

## Caching Strategy

### Cache Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: React Query (Frontend)                        │
│  - In-memory cache of API responses                     │
│  - Stale time: 30 seconds                               │
│  - Automatic background refetch                         │
│  - Per-page caching for infinite scroll                 │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Redis Cache (Backend)                         │
│  - Shared across all users                              │
│  - TTL: 2 minutes for list endpoints                    │
│  - TTL: 5 minutes for single exam lookups               │
│  - TTL: 1 minute for metrics                            │
│  - Invalidated on create/update/delete                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Source: HubSpot CRM                                    │
│  - Single source of truth                               │
│  - Always fresh data (when cache miss)                  │
└─────────────────────────────────────────────────────────┘
```

### Cache Key Patterns

```javascript
// List caches (include all filter params)
`admin:mock-exams:list:${JSON.stringify(filters)}`

Examples:
- admin:mock-exams:list:{"page":1,"limit":20,"location":"Calgary"}
- admin:mock-exams:list:{"page":2,"limit":20,"status":"active"}

// Single exam cache
`admin:mock-exam:${examId}`

// Metrics cache
`admin:mock-exams:metrics`
```

### Cache Invalidation

**On Create**:
```javascript
// Invalidate all list caches
await cache.clear('admin:mock-exams:list:*');
await cache.clear('admin:mock-exams:metrics');
```

**On Update**:
```javascript
// Invalidate specific exam + lists
await cache.del(`admin:mock-exam:${examId}`);
await cache.clear('admin:mock-exams:list:*');
await cache.clear('admin:mock-exams:metrics');
```

**On Delete**:
```javascript
// Invalidate specific exam + lists
await cache.del(`admin:mock-exam:${examId}`);
await cache.clear('admin:mock-exams:list:*');
await cache.clear('admin:mock-exams:metrics');
```

### React Query Configuration

```javascript
// In useMockExamsData.js
useInfiniteQuery({
  queryKey: ['mock-exams', filters],
  queryFn: ({ pageParam = 1 }) =>
    adminApi.listMockExams({ ...filters, page: pageParam }),
  getNextPageParam: (lastPage) => lastPage.pagination.nextPage,
  staleTime: 30000,      // Data fresh for 30 seconds
  cacheTime: 300000,     // Keep in cache for 5 minutes
  refetchOnWindowFocus: false,  // Don't refetch on tab focus
  refetchOnMount: true   // Refetch when component mounts
})
```

---

## State Management

### 1. Authentication State (Context API)

**Provider**: `AuthContext` in `contexts/AuthContext.jsx`

**State**:
```javascript
{
  user: {
    id: string,
    email: string,
    user_metadata: object
  },
  session: {
    access_token: string,
    refresh_token: string,
    expires_at: number,
    expires_in: number
  },
  loading: boolean,
  configError: string|null
}
```

**Methods**:
```javascript
{
  signIn(email, password, rememberMe),
  signOut(),
  validateSession(),
  refreshToken(),
  isAuthenticated()
}
```

**Usage**:
```javascript
const { user, isAuthenticated, signOut } = useAuth();
```

### 2. Server State (React Query)

**Infinite Query Example**:
```javascript
const {
  data,              // Pages of results
  fetchNextPage,     // Load next page
  hasNextPage,       // More data available?
  isFetching,        // Loading state
  isError,           // Error state
  error,             // Error object
  refetch            // Manual refetch
} = useMockExamsData(filters);
```

**Query Invalidation**:
```javascript
// After creating exam
queryClient.invalidateQueries(['mock-exams']);
queryClient.invalidateQueries(['metrics']);
```

### 3. Theme State (Context API)

**Provider**: `ThemeContext` in `contexts/ThemeContext.jsx`

**State**:
```javascript
{
  darkMode: boolean
}
```

**Methods**:
```javascript
{
  toggleDarkMode(),
  setDarkMode(boolean)
}
```

**Persistence**:
- Stored in localStorage: `theme`
- Applied via `dark` class on `<html>` element
- Tailwind CSS dark: variants activate

---

## Component Architecture

### Design Patterns

1. **Container/Presentational Pattern**
   - Pages (containers) manage state and logic
   - Components (presentational) receive props and render

2. **Custom Hooks Pattern**
   - Encapsulate data fetching logic
   - Reusable across components
   - Example: `useMockExamsData`, `useTableFilters`

3. **Compound Components**
   - Complex components broken into sub-components
   - Example: `FilterBar` with inputs for each filter

4. **Render Props**
   - Used in `ProtectedAdminRoute` for auth logic
   - Passes auth state to child components

### Key Components Deep Dive

#### MockExamsDashboard.jsx

**Purpose**: Main dashboard page with metrics and table

**State Management**:
```javascript
// Filter state (local)
const [filters, setFilters] = useState({
  search: '',
  filter_location: '',
  filter_mock_type: '',
  filter_status: 'all',
  filter_date_from: '',
  filter_date_to: '',
  sort_by: 'date',
  sort_order: 'asc'
});

// Metrics (React Query)
const { data: metrics } = useQuery(['metrics'], fetchMetrics);

// Mock exams list (React Query Infinite)
const { data, fetchNextPage, hasNextPage } = useMockExamsData(filters);
```

**Infinite Scroll Implementation**:
```javascript
const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  const bottom = scrollHeight - scrollTop === clientHeight;

  if (bottom && hasNextPage && !isFetching) {
    fetchNextPage();
  }
};
```

#### TimeSlotBuilder.jsx

**Purpose**: Build time slots for mock exam creation

**Features**:
- Select start and end dates
- Define time ranges (9 AM - 5 PM)
- Set duration per slot (30/60/90/120 min)
- Generates array of exam objects

**Output Format**:
```javascript
[
  {
    exam_date: '2025-01-25',
    start_time: 1706180400000,  // Unix timestamp
    end_time: 1706184000000,
    location: 'Calgary',
    mock_type: 'Situational Judgment',
    capacity: 20
  },
  // ... more slots
]
```

#### FilterBar.jsx

**Purpose**: Filter and search controls

**Filters**:
- **Search**: Free text across type, location, date, status
- **Location**: Dropdown (Mississauga, Calgary, Vancouver, etc.)
- **Mock Type**: Dropdown (Situational Judgment, Clinical Skills, etc.)
- **Status**: Dropdown (All, Active, Inactive)
- **Date Range**: From/To date pickers

**Active Filter Count**:
```javascript
const activeFilterCount = [
  filters.search,
  filters.filter_location,
  filters.filter_mock_type,
  filters.filter_status !== 'all' && filters.filter_status,
  filters.filter_date_from,
  filters.filter_date_to
].filter(Boolean).length;
```

---

## API Integration

### Axios Configuration

**Location**: `admin_frontend/src/services/adminApi.js`

**Setup**:
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### API Methods

```javascript
export const adminApi = {
  // Auth
  login: (email, password, rememberMe) =>
    api.post('/admin/auth/login', { email, password, rememberMe }),

  logout: () =>
    api.post('/admin/auth/logout'),

  // Mock Exams
  listMockExams: (params) =>
    api.get('/admin/mock-exams', { params }),

  getMockExam: (id) =>
    api.get(`/admin/mock-exams/${id}`),

  createMockExam: (data) =>
    api.post('/admin/mock-exams/create', data),

  bulkCreateMockExams: (exams) =>
    api.post('/admin/mock-exams/bulk-create', { exams }),

  updateMockExam: (id, data) =>
    api.patch(`/admin/mock-exams/${id}`, data),

  deleteMockExam: (id) =>
    api.delete(`/admin/mock-exams/${id}`),

  // Metrics
  getMetrics: () =>
    api.get('/admin/mock-exams/metrics')
};
```

### Error Handling

**Backend Error Format**:
```javascript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request parameters',
    details: { field: 'email', message: 'Invalid email format' }
  }
}
```

**Frontend Error Handling**:
```javascript
try {
  const response = await adminApi.createMockExam(data);
  // Success
} catch (error) {
  if (error.response) {
    // Server responded with error status
    const { code, message } = error.response.data.error;
    showNotification(message, 'error');
  } else if (error.request) {
    // Request made but no response
    showNotification('Network error. Please try again.', 'error');
  } else {
    // Something else went wrong
    showNotification('An unexpected error occurred.', 'error');
  }
}
```

---

## Performance Optimization

### 1. Code Splitting

**Vite Automatic Splitting**:
- Vendor chunks separated from app code
- Dynamic imports for heavy components
- Lazy loading for routes (future optimization)

### 2. Infinite Scroll vs Pagination

**Why Infinite Scroll?**:
- Better UX for browsing large datasets
- Faster perceived performance
- Each page cached individually by React Query
- Reduce CLS (Cumulative Layout Shift)

**Implementation**:
```javascript
const { data, fetchNextPage, hasNextPage, isFetching } =
  useInfiniteQuery({
    queryKey: ['mock-exams', filters],
    queryFn: ({ pageParam = 1 }) => fetchPage(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.nextPage
  });

// All pages in a flat array
const allExams = data?.pages.flatMap(page => page.data) ?? [];
```

### 3. Memoization

**React.memo for Components**:
```javascript
const StatusBadge = React.memo(({ status }) => {
  // Only re-renders if status changes
  return <span className={statusClasses[status]}>{status}</span>;
});
```

**useMemo for Expensive Calculations**:
```javascript
const filteredExams = useMemo(() => {
  return exams.filter(exam =>
    exam.location === selectedLocation
  );
}, [exams, selectedLocation]);
```

### 4. Image Optimization

**Logo SVG**:
- Inline SVG in Logo.jsx component
- No external image requests
- Instant rendering

### 5. Bundle Size

**Current Bundle**:
- Vendor chunk: ~300KB (React, React Query, Tailwind)
- App chunk: ~150KB (application code)
- Total (gzipped): ~120KB

**Optimizations**:
- Tree-shaking enabled (Vite default)
- Unused Tailwind classes purged
- No large external libraries

---

## Security Implementation

### 1. Authentication Security

**Password Requirements**:
- Minimum 8 characters (enforced by Joi)
- Hashed with bcrypt (handled by Supabase)
- Never stored in plain text

**Token Security**:
- JWTs signed with Supabase secret
- Stored in localStorage (XSS mitigation via CSP)
- httpOnly cookies for refresh tokens (if rememberMe)
- Automatic expiry and refresh

**Rate Limiting (Login)**:
```javascript
// In login.js
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;  // 15 minutes
const BLOCK_DURATION = 60 * 60 * 1000;     // 1 hour

// After 5 failed attempts, block for 1 hour
```

### 2. API Security

**CORS Configuration**:
```javascript
// Only allow admin frontend domain
const ALLOWED_ORIGINS = [
  'https://admin-mocksbooking.vercel.app',
  'http://localhost:5173'  // Dev only
];
```

**Input Validation**:
- All inputs validated with Joi schemas
- Whitelist approach (only allow defined fields)
- Type coercion disabled (strict mode)

**SQL Injection Prevention**:
- No direct database access
- HubSpot API handles all queries
- Property names validated against whitelist

### 3. XSS Prevention

**Security Headers** (from vercel.json):
```javascript
{
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
}
```

**Content Sanitization**:
- No user-generated HTML rendered
- All text content escaped by React
- No `dangerouslySetInnerHTML` used

### 4. HTTPS Enforcement

**Vercel Automatic**:
- All traffic upgraded to HTTPS
- SSL certificates auto-renewed
- HSTS header enforces HTTPS in browser

---

## Deployment Pipeline

### Vercel Configuration

**File**: `vercel.json`

```json
{
  "name": "mocks_booking_admin",
  "buildCommand": "cd admin_frontend && npm install && npm run build",
  "outputDirectory": "admin_frontend/dist",
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60
    }
  },
  "redirects": [
    {
      "source": "/",
      "destination": "/login",
      "permanent": false
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api|assets|favicon\\.ico|robots\\.txt).*)",
      "destination": "/index.html"
    }
  ]
}
```

### Build Process

```
1. Git Push to main
   └─> Triggers Vercel deployment

2. Vercel Build Phase
   ├─> Install dependencies
   │   ├─> Root: npm install
   │   └─> Frontend: cd admin_frontend && npm install
   │
   ├─> Build frontend
   │   ├─> npm run build (in admin_frontend)
   │   ├─> Vite builds production bundle
   │   ├─> Output: admin_frontend/dist/
   │   └─> Assets: HTML, JS chunks, CSS, images
   │
   └─> Prepare serverless functions
       └─> Each api/**/*.js becomes a function

3. Deployment
   ├─> Upload static assets to CDN
   ├─> Deploy serverless functions
   ├─> Configure routing
   └─> Activate new version

4. Post-Deployment
   ├─> Health check: GET /api/health
   ├─> Smoke test: Login flow
   └─> Monitor logs for errors
```

### Environment Variables

**Set in Vercel Dashboard**:

```bash
# Production
VITE_SUPABASE_URL=https://*.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_URL=https://*.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HS_PRIVATE_APP_TOKEN=pat-na1-...
REDIS_URL=rediss://...@...upstash.io:6379
ADMIN_MODE=true
NODE_ENV=production

# Available in all environments
VERCEL_URL=*.vercel.app  # Auto-set by Vercel
```

### Rollback Process

**If deployment fails**:
```bash
# Via Vercel Dashboard
1. Go to Deployments tab
2. Find last working deployment
3. Click "Promote to Production"

# Via Vercel CLI
vercel rollback <deployment-url>
```

---

## Conclusion

This document provides a comprehensive overview of the Admin Dashboard architecture as of January 24, 2025. The application is production-ready with:

✅ Secure Supabase authentication with session persistence
✅ Efficient infinite scroll with React Query
✅ Redis caching for optimal performance
✅ HubSpot CRM integration for data storage
✅ Comprehensive error handling and validation
✅ Dark mode support
✅ Responsive mobile-first design
✅ Serverless architecture on Vercel

For updates or questions, refer to the main README.md or contact the development team.

---

**Document Version**: 1.0
**Last Updated**: January 24, 2025
**Maintained By**: Development Team
