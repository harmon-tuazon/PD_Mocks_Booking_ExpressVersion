# PRD: User Module Serverless to Express.js Migration

## Overview

**Objective:** Convert the `user_root` module from Vercel serverless architecture to a traditional Express.js server-based architecture.

**Scope:** Full user application — API endpoints (`user_root/api/`) AND frontend (`user_root/frontend/`). Express serves both from a single origin, eliminating the need for CORS. Admin module (`admin_root/`) is a separate Express app.

**Estimated Effort:** 2-3 days

**Priority:** Medium

**Risk Level:** High (user-facing booking system - requires careful migration)

---

## Current Architecture

### Serverless Structure (Vercel)
```
user_root/
├── api/
│   ├── _shared/                    # 8 shared utilities
│   │   ├── auth.js                 # JWT/session authentication
│   │   ├── batch.js                # HubSpot batch operations
│   │   ├── cache.js                # Redis caching layer
│   │   ├── hubspot.js              # HubSpot API client
│   │   ├── hubspot-webhook.js      # Webhook verification
│   │   ├── redis.js                # Redis client configuration
│   │   ├── supabase.js             # Supabase client
│   │   ├── supabase-data.js        # Supabase data operations
│   │   └── validation.js           # Joi validation schemas
│   ├── bookings/                   # 3 booking endpoints
│   │   ├── create.js               # POST - Create booking (CRITICAL)
│   │   ├── list.js                 # GET - List user bookings
│   │   └── [id].js                 # DELETE - Cancel booking
│   ├── mock-discussions/           # 3 mock discussion endpoints
│   │   ├── available.js            # GET - Available discussions
│   │   ├── create-booking.js       # POST - Create discussion booking
│   │   └── validate-credits.js     # POST - Validate credits
│   ├── mock-exams/                 # 3 mock exam endpoints
│   │   ├── available.js            # GET - Available exams
│   │   ├── validate-credits.js     # POST - Validate exam credits
│   │   └── [id]/
│   │       └── capacity.js         # GET - Exam capacity check
│   ├── user/                       # 2 user endpoints
│   │   ├── login.js                # POST - User authentication
│   │   └── update-ndecc-date.js    # PUT - Update NDECC date
│   └── health.js                   # GET - Health check
├── frontend/                       # React frontend (unchanged)
└── vercel.json                     # Routing configuration
```

**Total API Files:** 20 (12 endpoints + 8 shared utilities)

### Current Handler Pattern
```javascript
// Vercel serverless handler
const { validateAuth } = require('../_shared/auth');
const { schemas } = require('../_shared/validation');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await validateAuth(req);
    const { error, value } = schemas.bookingCreation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Business logic
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
```

---

## Target Architecture

### Express.js Structure
```
user_root/
├── src/
│   ├── server.js                   # Express app entry point (serves API + frontend)
│   ├── routes/
│   │   ├── index.js                # Route aggregator
│   │   ├── bookings.routes.js      # /api/bookings/*
│   │   ├── mockExams.routes.js     # /api/mock-exams/*
│   │   ├── mockDiscussions.routes.js # /api/mock-discussions/*
│   │   └── user.routes.js          # /api/user/*
│   ├── controllers/                # Business logic (existing handlers)
│   │   ├── bookings/
│   │   │   ├── create.js           # Booking creation (CRITICAL)
│   │   │   ├── list.js             # List bookings
│   │   │   └── cancel.js           # Cancel booking
│   │   ├── mockExams/
│   │   │   ├── available.js
│   │   │   ├── validateCredits.js
│   │   │   └── capacity.js
│   │   ├── mockDiscussions/
│   │   │   ├── available.js
│   │   │   ├── createBooking.js
│   │   │   └── validateCredits.js
│   │   └── user/
│   │       ├── login.js
│   │       └── updateNdeccDate.js
│   ├── middleware/                 # Express middleware
│   │   ├── auth.js                 # Authentication middleware
│   │   ├── errorHandler.js         # Global error handler
│   │   ├── rateLimiter.js          # Rate limiting
│   │   ├── requestLogger.js        # Request logging
│   │   └── validateBody.js         # Joi validation middleware
│   ├── services/                   # Shared utilities (renamed from _shared)
│   │   ├── auth.js
│   │   ├── batch.js
│   │   ├── cache.js
│   │   ├── hubspot.js
│   │   ├── hubspot-webhook.js
│   │   ├── redis.js
│   │   ├── supabase.js
│   │   ├── supabase-data.js
│   │   └── validation.js
│   └── config/
│       ├── environment.js          # Environment variable validation
│       └── constants.js            # Application constants
├── frontend/                       # React frontend (built with Vite, served by Express)
│   └── dist/                       # Production build output served as static files
├── package.json                    # Updated dependencies
├── Dockerfile                      # For containerized deployment
└── docker-compose.yml              # Local development
```

### Single-Origin Architecture (No CORS Required)

Express serves both the API and the built frontend static files from the **same origin**. This eliminates the need for CORS middleware entirely.

**How it works:**
- API routes are mounted at `/api/*`
- Built frontend (`frontend/dist/`) is served as static files
- A catch-all route serves `index.html` for client-side routing (SPA fallback)
- Both run on port **3000** — same protocol, domain, and port = same origin

**ALB routing:**
```
booking.prepdoctors.com → ALB → Target Group (port 3000) → Express (API + Frontend)
```

### Target Handler Pattern
```javascript
// Express.js controller
const { createBookingAtomic } = require('../../services/supabase-data');
const { schemas } = require('../../services/validation');

const create = async (req, res, next) => {
  try {
    // req.user populated by auth middleware
    // req.body already validated by validateBody middleware
    const result = await createBookingAtomic(req.body, req.user);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);  // Global error handler
  }
};

module.exports = { create };
```

---

## Migration Benefits

| Aspect | Serverless (Current) | Express.js (Target) |
|--------|----------------------|---------------------|
| **Booking creation timeout** | 60s limit (tight for HubSpot sync) | No timeout |
| **Redis connection** | Cold start reconnects | Persistent connection pool |
| **Local development** | `vercel dev` (slow startup) | `node src/server.js` (instant) |
| **Debugging** | Limited console.log | Full debugger + breakpoints |
| **Rate limiting** | Per-function config | Centralized middleware |
| **Request logging** | Manual per-endpoint | Global middleware |
| **CORS** | Required (separate frontend URL) | Not needed (same origin) |
| **WebSocket support** | Not available | Native support (future real-time) |
| **Deployment flexibility** | Vercel only | Any platform |
| **Cost at scale** | Per-request billing | Fixed server cost |

---

## Critical Migration Considerations

### 1. Booking Creation (HIGH RISK)

The booking creation endpoint (`api/bookings/create.js`) is the most critical path:

**Current Flow:**
1. Validate JWT authentication
2. Validate request body with Joi
3. Check Redis distributed lock
4. Verify credit availability (Supabase + HubSpot)
5. Atomic booking creation (Supabase RPC)
6. Redis counter increment
7. Supabase sync (fire-and-forget)
8. HubSpot webhook (fire-and-forget)

**Migration Risk:**
- Must preserve atomic behavior
- Must maintain distributed locking
- Must not introduce race conditions

**Mitigation:**
- Keep existing business logic unchanged
- Only refactor request/response handling
- Extensive testing before deployment

### 2. Redis Connection Management

**Current (Serverless):**
```javascript
// Cold start creates new connection each time
const redis = new Redis(process.env.REDIS_URL);
```

**Target (Express):**
```javascript
// Persistent connection with pooling
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  connectionName: 'user-api'
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
});
```

### 3. Supabase Connection

**Current (Serverless):**
```javascript
// New client per request (acceptable for serverless)
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(url, key);
```

**Target (Express):**
```javascript
// Singleton pattern with connection pooling
let supabaseInstance = null;

const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' }
    });
  }
  return supabaseInstance;
};
```

---

## Implementation Plan

### Phase 1: Setup & Dependencies (2 hours)

**1.1 Install Dependencies**
```bash
cd user_root
npm install express helmet morgan compression express-rate-limit
npm install -D nodemon
```
> **Note:** `cors` is NOT needed — Express serves both frontend and API on the same origin.

**1.2 Create Server Entry Point**

```javascript
// src/server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initializeConnections, closeConnections } = require('./services/connections');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: { message: 'Too many requests' } }
});
app.use(limiter);

// Request parsing
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// API Routes
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files (built Vite output)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA fallback - all non-API routes serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handler (must be last middleware for API errors)
app.use(errorHandler);

// Initialize connections and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initializeConnections();

    app.listen(PORT, () => {
      console.log(`User app running on port ${PORT} (API + Frontend)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeConnections();
  process.exit(0);
});

startServer();

module.exports = app;
```

> **No CORS middleware** — frontend and API are served from the same origin (`http://localhost:3000` in dev, `https://booking.prepdoctors.com` in prod). The browser never makes cross-origin requests.
>
> **Important ordering:** API routes MUST be registered before the static file serving and SPA fallback, otherwise the catch-all `*` route would intercept API requests.

**1.3 Update package.json**
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "test:coverage": "jest --coverage"
  }
}
```

---

### Phase 2: Route Conversion (3 hours)

**2.1 Bookings Routes (CRITICAL PATH)**

```javascript
// src/routes/bookings.routes.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const bookings = require('../controllers/bookings');

// All booking routes require authentication
router.use(authenticate);

// Create booking - most critical endpoint
router.post('/create',
  validateBody(schemas.bookingCreation),
  bookings.create
);

// List user's bookings
router.get('/list', bookings.list);

// Cancel booking
router.delete('/:id', bookings.cancel);

module.exports = router;
```

**2.2 Mock Exams Routes**

```javascript
// src/routes/mockExams.routes.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const mockExams = require('../controllers/mockExams');

// Public route - available exams
router.get('/available', mockExams.available);

// Protected routes
router.use(authenticate);

router.post('/validate-credits',
  validateBody(schemas.creditValidation),
  mockExams.validateCredits
);

router.get('/:id/capacity', mockExams.capacity);

module.exports = router;
```

**2.3 Mock Discussions Routes**

```javascript
// src/routes/mockDiscussions.routes.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const mockDiscussions = require('../controllers/mockDiscussions');

// Public route
router.get('/available', mockDiscussions.available);

// Protected routes
router.use(authenticate);

router.post('/validate-credits',
  validateBody(schemas.creditValidation),
  mockDiscussions.validateCredits
);

router.post('/create-booking',
  validateBody(schemas.bookingCreation),
  mockDiscussions.createBooking
);

module.exports = router;
```

**2.4 User Routes**

```javascript
// src/routes/user.routes.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const user = require('../controllers/user');

// Login - public
router.post('/login', user.login);

// Protected routes
router.use(authenticate);

router.put('/update-ndecc-date',
  validateBody(schemas.updateNdeccDate),
  user.updateNdeccDate
);

module.exports = router;
```

**2.5 Route Aggregator**

```javascript
// src/routes/index.js
const router = require('express').Router();

router.use('/bookings', require('./bookings.routes'));
router.use('/mock-exams', require('./mockExams.routes'));
router.use('/mock-discussions', require('./mockDiscussions.routes'));
router.use('/user', require('./user.routes'));

module.exports = router;
```

---

### Phase 3: Controller Conversion (3 hours)

**3.1 Conversion Pattern**

Each handler needs minimal changes:

| Change | Before (Vercel) | After (Express) |
|--------|-----------------|-----------------|
| Export | `module.exports = async (req, res) => {}` | `const handler = async (req, res, next) => {}` |
| Method check | `if (req.method !== 'POST')` | Remove (router handles) |
| Auth check | `await validateAuth(req)` | `req.user` (middleware) |
| Validation | `schemas.x.validate(req.body)` | Middleware + `req.body` |
| Dynamic params | `req.query.id` | `req.params.id` |
| Error handling | `return res.status(500).json({})` | `next(error)` |

**3.2 Booking Create Controller (CRITICAL)**

**Before:**
```javascript
// api/bookings/create.js
const { validateAuth } = require('../_shared/auth');
const { schemas } = require('../_shared/validation');
const { createBookingAtomic } = require('../_shared/supabase-data');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await validateAuth(req);
    const { error, value } = schemas.bookingCreation.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }

    // ... existing business logic (400+ lines)

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Booking creation error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
```

**After:**
```javascript
// src/controllers/bookings/create.js
const { createBookingAtomic } = require('../../services/supabase-data');
// ... other imports unchanged

const create = async (req, res, next) => {
  try {
    // req.user populated by auth middleware
    // req.body validated by validateBody middleware

    // ... existing business logic (400+ lines) - UNCHANGED

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);  // Global error handler
  }
};

module.exports = { create };
```

**3.3 Dynamic Route Params**

**Before:** `api/bookings/[id].js` with `req.query.id`
**After:** Route `/:id` with `req.params.id`

```javascript
// Before (Vercel)
const bookingId = req.query.id;

// After (Express)
const bookingId = req.params.id;
```

---

### Phase 4: Middleware Implementation (2 hours)

**4.1 Authentication Middleware**

```javascript
// src/middleware/auth.js
const { validateAuth } = require('../services/auth');

const authenticate = async (req, res, next) => {
  try {
    const user = await validateAuth(req);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || 'Authentication required'
      }
    });
  }
};

module.exports = { authenticate };
```

**4.2 Validation Middleware**

```javascript
// src/middleware/validateBody.js
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        }
      });
    }

    req.body = value;  // Use validated/sanitized values
    next();
  };
};

module.exports = { validateBody };
```

**4.3 Global Error Handler**

```javascript
// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.hubspot_id
  });

  // Handle known error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    });
  }

  if (err.code === 'RACE_CONDITION' || err.code === 'BOOKING_LOCKED') {
    return res.status(409).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  if (err.code === 'INSUFFICIENT_CREDITS') {
    return res.status(402).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred processing your request'
    : err.message;

  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
```

**4.4 Request Logger**

```javascript
// src/middleware/requestLogger.js
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.hubspot_id || 'anonymous'
    }));
  });

  next();
};

module.exports = requestLogger;
```

---

### Phase 5: Services Migration (1 hour)

**5.1 Move _shared to services**

```bash
# Rename and reorganize
mv user_root/api/_shared user_root/src/services
```

**5.2 Connection Manager**

```javascript
// src/services/connections.js
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');

let redis = null;
let supabase = null;

const initializeConnections = async () => {
  console.log('Initializing connections...');

  // Redis with connection pooling
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    connectionName: 'user-api',
    lazyConnect: true
  });

  await redis.connect();
  console.log('✅ Redis connected');

  // Supabase singleton
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
  console.log('✅ Supabase initialized');

  return { redis, supabase };
};

const closeConnections = async () => {
  console.log('Closing connections...');

  if (redis) {
    await redis.quit();
    console.log('✅ Redis disconnected');
  }
};

const getRedis = () => {
  if (!redis) throw new Error('Redis not initialized');
  return redis;
};

const getSupabase = () => {
  if (!supabase) throw new Error('Supabase not initialized');
  return supabase;
};

module.exports = {
  initializeConnections,
  closeConnections,
  getRedis,
  getSupabase
};
```

**5.3 Update Import Paths**

Find and replace across all files:
- `require('../_shared/` → `require('../services/`
- `require('../../_shared/` → `require('../../services/`

---

### Phase 6: Deployment Configuration (1 hour)

**6.1 PM2 Process Manager**

PM2 manages the Node.js process on EC2 — auto-restart, cluster mode, logging, and boot persistence. No containers needed.

Install on EC2:
```bash
npm install -g pm2
```

PM2 ecosystem config (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'user-app',
    script: 'src/server.js',
    instances: 'max',          // one worker per CPU core
    exec_mode: 'cluster',      // cluster mode for load balancing
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Restart policy
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,

    // Memory limit — restart worker if it exceeds 512MB
    max_memory_restart: '512M',

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,

    // Watch (disabled in production)
    watch: false
  }]
};
```

**PM2 commands:**
```bash
# Start app
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs user-app

# Zero-downtime restart (cluster mode restarts workers one at a time)
pm2 reload user-app

# Survive EC2 reboots (generates systemd service automatically)
pm2 startup
pm2 save

# Monitor CPU/memory in real time
pm2 monit
```

**Why PM2 over Docker:**
- Simpler — no Dockerfiles, image registries, or container orchestration
- Direct debugging — SSH in, `pm2 logs`, inspect directly
- Lower overhead — no Docker daemon consuming memory
- Cluster mode built-in — multi-core without nginx or load balancer
- Sufficient for our scale — 2 Express apps on 1 EC2 behind ALB

> **Note:** In development, use `npm run dev` (nodemon) instead of PM2. You can also run the Vite dev server separately (`cd frontend && npm run dev`) on port 5173 for hot module replacement — configure the Vite proxy to forward `/api` requests to Express on port 3000.

**6.2 Environment Variables**

No changes needed — same environment variables work in both architectures. `FRONTEND_URL` / `CORS_ORIGIN` are no longer required since frontend and API share the same origin.

Required env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HS_PRIVATE_APP_TOKEN`
- `REDIS_URL`
- `JWT_SECRET`

**6.3 ALB Target Group Configuration**

```
User App:
  - Target Group: user-tg
  - Port: 3000
  - Health Check: GET /api/health
  - Domain: booking.prepdoctors.com → ALB → user-tg (port 3000)
```

---

## File Mapping Reference

| Vercel Path | Express Path | Route |
|-------------|--------------|-------|
| `api/health.js` | `src/server.js` (inline) | `GET /api/health` |
| `api/bookings/create.js` | `src/controllers/bookings/create.js` | `POST /api/bookings/create` |
| `api/bookings/list.js` | `src/controllers/bookings/list.js` | `GET /api/bookings/list` |
| `api/bookings/[id].js` | `src/controllers/bookings/cancel.js` | `DELETE /api/bookings/:id` |
| `api/mock-exams/available.js` | `src/controllers/mockExams/available.js` | `GET /api/mock-exams/available` |
| `api/mock-exams/validate-credits.js` | `src/controllers/mockExams/validateCredits.js` | `POST /api/mock-exams/validate-credits` |
| `api/mock-exams/[id]/capacity.js` | `src/controllers/mockExams/capacity.js` | `GET /api/mock-exams/:id/capacity` |
| `api/mock-discussions/available.js` | `src/controllers/mockDiscussions/available.js` | `GET /api/mock-discussions/available` |
| `api/mock-discussions/validate-credits.js` | `src/controllers/mockDiscussions/validateCredits.js` | `POST /api/mock-discussions/validate-credits` |
| `api/mock-discussions/create-booking.js` | `src/controllers/mockDiscussions/createBooking.js` | `POST /api/mock-discussions/create-booking` |
| `api/user/login.js` | `src/controllers/user/login.js` | `POST /api/user/login` |
| `api/user/update-ndecc-date.js` | `src/controllers/user/updateNdeccDate.js` | `PUT /api/user/update-ndecc-date` |

---

## Testing Strategy

### 1. Unit Tests (Pre-Migration)
- Write/verify tests for all 12 endpoints
- Ensure > 70% code coverage on business logic

### 2. API Compatibility Tests
- Verify all endpoints return same response format
- Test with existing React frontend (should work without changes)
- Compare response payloads between Vercel and Express

### 3. Integration Tests
- Test booking creation with real Redis locks
- Test credit validation flow
- Test cancellation flow

### 4. Load Testing
- Simulate concurrent booking requests
- Verify Redis locking prevents race conditions
- Test connection pooling under load

### 5. Regression Tests
```bash
# Run full test suite
npm run test:coverage

# Expected output
# ✅ All tests passing
# ✅ Coverage > 70%
```

---

## Migration Checklist

### Pre-Migration
- [ ] All existing tests passing
- [ ] > 70% test coverage achieved
- [ ] Backup current Vercel deployment
- [ ] Document current API response formats

### Phase 1: Setup
- [ ] Dependencies installed
- [ ] Server entry point created
- [ ] package.json scripts updated
- [ ] Local development working

### Phase 2: Routes
- [ ] Booking routes converted
- [ ] Mock exam routes converted
- [ ] Mock discussion routes converted
- [ ] User routes converted
- [ ] Route aggregator working

### Phase 3: Controllers
- [ ] All 12 controllers converted
- [ ] Dynamic params updated
- [ ] Error handling standardized

### Phase 4: Middleware
- [ ] Auth middleware working
- [ ] Validation middleware working
- [ ] Error handler working
- [ ] Request logger working

### Phase 5: Services
- [ ] _shared renamed to services
- [ ] Import paths updated
- [ ] Connection manager created
- [ ] Graceful shutdown working

### Phase 6: Deployment
- [ ] PM2 ecosystem.config.js created
- [ ] PM2 startup persistence configured
- [ ] Environment variables documented

### Post-Migration
- [ ] All 12 API endpoints functional
- [ ] Frontend works without modification
- [ ] All tests passing
- [ ] Local development starts in < 2 seconds
- [ ] Response times equal or better than Vercel

---

## Rollback Plan

1. Keep Vercel deployment active during migration (do not delete)
2. Use ALB weighted routing or DNS to control traffic:
   - `booking.prepdoctors.com` → Vercel (current, 100% traffic)
   - Switch ALB target to EC2 (Express on port 3000) after successful testing
3. Monitor for 24-48 hours
4. If issues arise, switch ALB target back to Vercel origin instantly

---

## Success Criteria

- [ ] All 12 API endpoints converted and functional
- [ ] Frontend React app works without ANY modifications
- [ ] All booking flows work (create, list, cancel)
- [ ] Credit validation works correctly
- [ ] Redis distributed locking prevents race conditions
- [ ] Local development starts in < 2 seconds
- [ ] All existing tests pass
- [ ] Response times equal or better than Vercel
- [ ] Graceful shutdown handles cleanup properly

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Race conditions in booking | Low | Critical | Keep existing Redis lock logic unchanged |
| Auth token incompatibility | Low | High | Use same JWT validation logic |
| Response format changes | Medium | Medium | Compare payloads, test with frontend |
| Connection pool exhaustion | Low | High | Configure proper pool limits |
| Increased latency | Low | Medium | Load test before migration |
| Deployment downtime | Low | High | Use DNS cutover, not in-place |

---

## Post-Migration Benefits

1. **Single-origin serving** - No CORS needed; one port serves frontend + API per app
2. **Simple ALB routing** - One target group per app (user:3000, admin:3001)
3. **No timeout limits** - Long operations (bulk imports, sync) won't fail
4. **Better debugging** - Full Node.js debugger with breakpoints
5. **Faster local dev** - Instant server start vs `vercel dev` cold starts
6. **Persistent connections** - Redis and Supabase stay connected
7. **WebSocket ready** - Can add real-time booking updates
8. **Platform flexibility** - Deploy to AWS, DigitalOcean, Railway, or self-host
9. **Cost predictability** - Fixed monthly cost vs per-request billing
10. **Custom middleware** - Rate limiting, logging, metrics all centralized

---

## Appendix: Complete Route Definitions

```javascript
// All routes after migration
POST   /api/bookings/create           # Create booking (CRITICAL)
GET    /api/bookings/list             # List user bookings
DELETE /api/bookings/:id              # Cancel booking

GET    /api/mock-exams/available      # Get available exams
POST   /api/mock-exams/validate-credits # Validate user credits
GET    /api/mock-exams/:id/capacity   # Check exam capacity

GET    /api/mock-discussions/available      # Get available discussions
POST   /api/mock-discussions/validate-credits # Validate discussion credits
POST   /api/mock-discussions/create-booking  # Create discussion booking

POST   /api/user/login                # User authentication
PUT    /api/user/update-ndecc-date    # Update NDECC exam date

GET    /api/health                    # Health check
```

---

*Created: January 2026*
*Author: Claude Code*
*Status: Draft*
*Target: user_root module*
