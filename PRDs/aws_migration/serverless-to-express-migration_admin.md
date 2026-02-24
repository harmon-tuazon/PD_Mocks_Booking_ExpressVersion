# PRD: Admin Module Serverless to Express.js Migration

## Overview

**Objective:** Convert the `admin_root` module from Vercel serverless architecture to a traditional Express.js server-based architecture.

**Scope:** Full admin application — API endpoints (`admin_root/api/`) AND frontend (`admin_root/admin_frontend/`). Express serves both from a single origin, eliminating the need for CORS. User module (`user_root/`) is a separate Express app.

**Estimated Effort:** 2-3 days

**Priority:** Medium

---

## Current Architecture

### Serverless Structure (Vercel)
```
admin_root/
├── api/
│   ├── _shared/                    # 12 shared utilities
│   │   ├── cache.js
│   │   ├── cors.js
│   │   ├── hubspot.js
│   │   ├── hubspot-webhook.js
│   │   ├── redis.js
│   │   ├── refund.js
│   │   ├── scheduledActivation.js
│   │   ├── supabase.js
│   │   ├── supabase-data.js
│   │   ├── supabase-webhook.js
│   │   ├── supabaseSync.optimized.js
│   │   └── validation.js
│   ├── admin/
│   │   ├── auth/                   # 8 auth endpoints
│   │   ├── bookings/               # 2 booking endpoints
│   │   ├── cron/                   # 3 cron jobs
│   │   ├── middleware/             # 4 middleware files
│   │   ├── mock-exams/             # 18 exam endpoints
│   │   ├── sync/                   # 1 sync endpoint
│   │   └── trainees/               # 4 trainee endpoints
│   ├── bookings/                   # 2 booking endpoints
│   └── health.js
├── admin_frontend/                 # React frontend (unchanged)
└── vercel.json                     # Routing & cron config
```

**Total API Files:** 60 (48 endpoints + 12 shared)

### Current Handler Pattern
```javascript
// Vercel serverless handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Business logic
  return res.status(200).json({ success: true });
};
```

---

## Target Architecture

### Express.js Structure
```
admin_root/
├── src/
│   ├── server.js                   # Express app entry point (serves API + frontend)
│   ├── routes/
│   │   ├── index.js                # Route aggregator
│   │   ├── auth.routes.js          # /api/admin/auth/*
│   │   ├── bookings.routes.js      # /api/admin/bookings/*
│   │   ├── mockExams.routes.js     # /api/admin/mock-exams/*
│   │   ├── trainees.routes.js      # /api/admin/trainees/*
│   │   └── sync.routes.js          # /api/admin/sync/*
│   ├── controllers/                # Business logic (existing handlers)
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── mockExams/
│   │   ├── trainees/
│   │   └── sync/
│   ├── middleware/                 # Auth & validation middleware
│   │   ├── requireAdmin.js
│   │   ├── requireAuth.js
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── services/                   # Shared utilities (renamed from _shared)
│   │   ├── hubspot.js
│   │   ├── redis.js
│   │   ├── supabase.js
│   │   └── ...
│   ├── jobs/                       # Cron jobs
│   │   ├── scheduler.js
│   │   ├── syncExams.job.js
│   │   ├── syncBookings.job.js
│   │   └── activateScheduled.job.js
│   └── config/
│       ├── environment.js
│       └── constants.js
├── admin_frontend/                 # React frontend (built with Vite, served by Express)
│   └── dist/                       # Production build output served as static files
├── package.json                    # Updated dependencies
└── Dockerfile                      # For containerized deployment
```

### Single-Origin Architecture (No CORS Required)

Express serves both the API and the built frontend static files from the **same origin**. This eliminates the need for CORS middleware entirely.

**How it works:**
- API routes are mounted at `/api/*`
- Built frontend (`admin_frontend/dist/`) is served as static files
- A catch-all route serves `index.html` for client-side routing (SPA fallback)
- Both run on port **3001** — same protocol, domain, and port = same origin

**ALB routing:**
```
admin.prepdoctors.com → ALB → Target Group (port 3001) → Express (API + Frontend)
```

### Target Handler Pattern
```javascript
// Express.js controller
const createBooking = async (req, res, next) => {
  try {
    // Same business logic
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);  // Global error handler
  }
};

module.exports = { createBooking };
```

---

## Migration Benefits

| Aspect | Serverless (Current) | Express.js (Target) |
|--------|----------------------|---------------------|
| **Long operations** | 60s timeout limit | No timeout |
| **Cron jobs** | Vercel config, 60s limit | node-cron, unlimited |
| **Local development** | `vercel dev` (slow) | `node src/server.js` (instant) |
| **Debugging** | Limited | Full debugger support |
| **Connection pooling** | Cold start reconnects | Persistent connections |
| **WebSockets** | Not supported | Native support |
| **CORS** | Required (separate frontend URL) | Not needed (same origin) |
| **Deployment** | Vercel only | Any platform (AWS, DO, Railway) |
| **Cost at scale** | Per-request billing | Fixed server cost |

---

## Implementation Plan

### Phase 1: Setup & Dependencies (2 hours)

**1.1 Install Dependencies**
```bash
cd admin_root
npm install express helmet morgan node-cron compression
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

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initScheduler } = require('./jobs/scheduler');

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// API Routes
app.use('/api', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files (built Vite output)
app.use(express.static(path.join(__dirname, '../admin_frontend/dist')));

// SPA fallback - all non-API routes serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin_frontend/dist/index.html'));
});

// Error handler (must be last middleware for API errors)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin app running on port ${PORT} (API + Frontend)`);
  initScheduler();  // Start cron jobs
});

module.exports = app;
```

> **No CORS middleware** — frontend and API are served from the same origin (`http://localhost:3001` in dev, `https://admin.prepdoctors.com` in prod). The browser never makes cross-origin requests.
>
> **Important ordering:** API routes MUST be registered before the static file serving and SPA fallback, otherwise the catch-all `*` route would intercept API requests.

**1.3 Update package.json**
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  }
}
```

---

### Phase 2: Route Conversion (4 hours)

**2.1 Auth Routes**

```javascript
// src/routes/auth.routes.js
const router = require('express').Router();
const auth = require('../controllers/auth');

router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/me', auth.me);
router.post('/refresh', auth.refresh);
router.post('/request-otp', auth.requestOtp);
router.post('/verify-otp', auth.verifyOtp);
router.post('/update-password', auth.updatePassword);
router.get('/validate', auth.validate);

module.exports = router;
```

**2.2 Mock Exams Routes**

```javascript
// src/routes/mockExams.routes.js
const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const mockExams = require('../controllers/mockExams');

// Apply auth middleware to all routes
router.use(requireAdmin);

// List & CRUD
router.get('/list', mockExams.list);
router.get('/get', mockExams.get);
router.post('/create', mockExams.create);
router.patch('/update', mockExams.update);
router.delete('/delete', mockExams.delete);

// Bulk operations
router.post('/bulk-create', mockExams.bulkCreate);
router.post('/bulk-create-csv', mockExams.bulkCreateCsv);
router.patch('/bulk-update', mockExams.bulkUpdate);
router.post('/bulk-toggle-status', mockExams.bulkToggleStatus);
router.post('/batch-delete', mockExams.batchDelete);
router.post('/clone', mockExams.clone);

// Exports & metrics
router.get('/export-csv', mockExams.exportCsv);
router.get('/metrics', mockExams.metrics);
router.get('/aggregates', mockExams.aggregates);
router.get('/aggregates/:key/sessions', mockExams.aggregateSessions);
router.get('/available-for-rebook', mockExams.availableForRebook);

// Nested routes for specific exam
router.get('/:id', mockExams.getById);
router.get('/:id/bookings', mockExams.getBookings);
router.patch('/:id/attendance', mockExams.updateAttendance);
router.post('/:id/cancel-bookings', mockExams.cancelBookings);

// Prerequisites
router.get('/:id/prerequisites', mockExams.getPrerequisites);
router.post('/:id/prerequisites', mockExams.addPrerequisite);
router.post('/:id/prerequisites/delta', mockExams.updatePrerequisitesDelta);
router.delete('/:id/prerequisites/:prerequisiteId', mockExams.removePrerequisite);

module.exports = router;
```

**2.3 Route Aggregator**

```javascript
// src/routes/index.js
const router = require('express').Router();

router.use('/admin/auth', require('./auth.routes'));
router.use('/admin/mock-exams', require('./mockExams.routes'));
router.use('/admin/bookings', require('./bookings.routes'));
router.use('/admin/trainees', require('./trainees.routes'));
router.use('/admin/sync', require('./sync.routes'));
router.use('/bookings', require('./publicBookings.routes'));

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
| Dynamic params | `req.query.id` | `req.params.id` |
| Error handling | `return res.status(500).json({})` | `next(error)` |

**3.2 Example Conversion**

**Before:**
```javascript
// api/admin/mock-exams/list.js
const { requireAdmin } = require('../middleware/requireAdmin');
const { getMockExams } = require('../../_shared/supabase-data');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);
    const exams = await getMockExams(req.query);
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    console.error('Error listing exams:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
```

**After:**
```javascript
// src/controllers/mockExams/list.js
const { getMockExams } = require('../../services/supabase-data');

const list = async (req, res, next) => {
  try {
    const exams = await getMockExams(req.query);
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

module.exports = { list };
```

**3.3 Dynamic Route Params**

**Before:** `api/admin/mock-exams/[id].js` with `req.query.id`
**After:** Route `/:id` with `req.params.id`

```javascript
// Before
const examId = req.query.id;

// After
const examId = req.params.id;
```

---

### Phase 4: Middleware Migration (1 hour)

**4.1 Error Handler**

```javascript
// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'SERVER_ERROR';

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
```

**4.2 Auth Middleware (Minimal Changes)**

```javascript
// src/middleware/requireAdmin.js
const { requireAuth } = require('./requireAuth');

const requireAdmin = async (req, res, next) => {
  try {
    const user = await requireAuth(req);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: error.message }
    });
  }
};

module.exports = { requireAdmin };
```

---

### Phase 5: Cron Jobs Migration (1 hour)

**5.1 Scheduler Setup**

```javascript
// src/jobs/scheduler.js
const cron = require('node-cron');
const { syncExamsFromHubspot } = require('./syncExams.job');
const { syncBookingsToHubspot } = require('./syncBookings.job');
const { activateScheduledExams } = require('./activateScheduled.job');

const initScheduler = () => {
  console.log('Initializing cron scheduler...');

  // Sync exams from HubSpot - every 1 hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running: sync-exams-from-hubspot');
    await syncExamsFromHubspot();
  });

  // Sync bookings to HubSpot - every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running: sync-bookings-to-hubspot');
    await syncBookingsToHubspot();
  });

  // Activate scheduled exams - twice daily (5 PM and 6 PM UTC)
  cron.schedule('0 17,18 * * *', async () => {
    console.log('Running: activate-scheduled-exams');
    await activateScheduledExams();
  });

  console.log('Cron jobs scheduled successfully');
};

module.exports = { initScheduler };
```

**5.2 Job Wrapper**

```javascript
// src/jobs/syncExams.job.js
const { syncAllData } = require('../services/supabaseSync.optimized');

const syncExamsFromHubspot = async () => {
  const startTime = Date.now();

  try {
    const result = await syncAllData();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Sync completed in ${duration}s:`, result.summary);
    return result;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
};

module.exports = { syncExamsFromHubspot };
```

---

### Phase 6: Services Migration (30 min)

**6.1 Move _shared to services**

```bash
# Rename and reorganize
mv admin_root/api/_shared admin_root/src/services
```

**6.2 Update Import Paths**

Find and replace:
- `require('../_shared/` → `require('../services/`
- `require('../../_shared/` → `require('../../services/`

---

### Phase 7: Deployment Configuration (1 hour)

**7.1 Dockerfile**

```dockerfile
# Dockerfile
FROM node:18-alpine AS frontend-build

WORKDIR /app/admin_frontend
COPY admin_frontend/package*.json ./
RUN npm ci
COPY admin_frontend/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY src ./src

# Copy built frontend from build stage
COPY --from=frontend-build /app/admin_frontend/dist ./admin_frontend/dist

# Environment
ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

CMD ["node", "src/server.js"]
```

**7.2 Docker Compose (Development)**

```yaml
# docker-compose.yml
version: '3.8'

services:
  admin-app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - HS_PRIVATE_APP_TOKEN=${HS_PRIVATE_APP_TOKEN}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./src:/app/src  # Hot reload backend
    command: npm run dev
```

> **Note:** In development, you may still run the Vite dev server separately (`cd admin_frontend && npm run dev`) on port 5173 for hot module replacement. In that case, the Vite dev server proxies API requests to Express on port 3001 (configure in `vite.config.js`). In production, Express serves the pre-built `admin_frontend/dist/` directly.

**7.3 Environment Variables**

No changes needed - same environment variables work in both architectures. `CORS_ORIGIN` is no longer required since frontend and API share the same origin.

**7.4 ALB Target Group Configuration**

```
Admin App:
  - Target Group: admin-tg
  - Port: 3001
  - Health Check: GET /api/health
  - Domain: admin.prepdoctors.com → ALB → admin-tg (port 3001)
```

---

## File Mapping Reference

| Vercel Path | Express Path | Route |
|-------------|--------------|-------|
| `api/admin/auth/login.js` | `src/controllers/auth/login.js` | `POST /api/admin/auth/login` |
| `api/admin/mock-exams/list.js` | `src/controllers/mockExams/list.js` | `GET /api/admin/mock-exams/list` |
| `api/admin/mock-exams/[id].js` | `src/controllers/mockExams/getById.js` | `GET /api/admin/mock-exams/:id` |
| `api/admin/mock-exams/[id]/bookings.js` | `src/controllers/mockExams/getBookings.js` | `GET /api/admin/mock-exams/:id/bookings` |
| `api/admin/cron/sync-exams-*.js` | `src/jobs/syncExams.job.js` | Cron: `0 * * * *` |

---

## Testing Strategy

### 1. API Compatibility Tests
- Verify all endpoints return same response format
- Test with existing frontend (should work without changes)

### 2. Cron Job Tests
- Verify jobs run on schedule
- Test manual trigger endpoint for each job

### 3. Load Testing
- Verify connection pooling works
- Test concurrent request handling

---

## Rollback Plan

1. Keep Vercel deployment active during migration
2. Use feature flag or DNS switch to route traffic
3. If issues arise, switch back to Vercel instantly

---

## Success Criteria

- [ ] All 48 API endpoints converted and functional
- [ ] All 3 cron jobs running on schedule
- [ ] Frontend works without modification
- [ ] Local development starts in < 2 seconds
- [ ] All existing tests pass
- [ ] Response times equal or better than Vercel

---

## Post-Migration Benefits

1. **Single-origin serving** - No CORS needed; one port serves frontend + API per app
2. **Simple ALB routing** - One target group per app (admin:3001, user:3000)
3. **Unlimited operation time** - Bulk operations no longer timeout
4. **Better debugging** - Full Node.js debugger support
5. **Faster local dev** - Instant server start vs `vercel dev`
6. **WebSocket ready** - Can add real-time features
7. **Platform flexibility** - Deploy anywhere (AWS, DO, Railway, self-hosted)
8. **Cost predictability** - Fixed server cost vs per-request billing

---

## Appendix: Complete Route Definitions

```javascript
// All routes after migration
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
POST   /api/admin/auth/refresh
POST   /api/admin/auth/request-otp
POST   /api/admin/auth/verify-otp
POST   /api/admin/auth/update-password
GET    /api/admin/auth/validate

POST   /api/admin/bookings/create
POST   /api/admin/bookings/bulk-create

GET    /api/admin/mock-exams/list
GET    /api/admin/mock-exams/get
POST   /api/admin/mock-exams/create
PATCH  /api/admin/mock-exams/update
DELETE /api/admin/mock-exams/delete
POST   /api/admin/mock-exams/bulk-create
POST   /api/admin/mock-exams/bulk-create-csv
PATCH  /api/admin/mock-exams/bulk-update
POST   /api/admin/mock-exams/bulk-toggle-status
POST   /api/admin/mock-exams/batch-delete
POST   /api/admin/mock-exams/clone
GET    /api/admin/mock-exams/export-csv
GET    /api/admin/mock-exams/metrics
GET    /api/admin/mock-exams/aggregates
GET    /api/admin/mock-exams/aggregates/:key/sessions
GET    /api/admin/mock-exams/available-for-rebook
GET    /api/admin/mock-exams/:id
GET    /api/admin/mock-exams/:id/bookings
PATCH  /api/admin/mock-exams/:id/attendance
POST   /api/admin/mock-exams/:id/cancel-bookings
GET    /api/admin/mock-exams/:id/prerequisites
POST   /api/admin/mock-exams/:id/prerequisites
POST   /api/admin/mock-exams/:id/prerequisites/delta
DELETE /api/admin/mock-exams/:id/prerequisites/:prerequisiteId

GET    /api/admin/trainees/search
GET    /api/admin/trainees/:contactId/bookings
PATCH  /api/admin/trainees/:contactId/tokens

POST   /api/admin/sync/force-supabase

POST   /api/bookings/batch-cancel
POST   /api/bookings/rebook

GET    /api/health
```

---

*Created: January 2026*
*Author: Claude Code*
*Status: Draft*
