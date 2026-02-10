# PRD: Full AWS Migration with Shared Database Architecture

## Document Information

| Field | Value |
|-------|-------|
| **Title** | Mocks Booking Full AWS Migration |
| **Version** | 1.0 |
| **Created** | January 26, 2026 |
| **Status** | Draft |
| **Priority** | High |
| **Related** | DATABASE_CONNECTIONS.md, Infrastructure_Expansion_Analysis_Report.pdf |

---

## 1. Executive Summary

Migrate the Mocks Booking application from Vercel + Supabase to a fully AWS-based architecture, **matching the existing database connection pattern** from the other application. This ensures:

- Consistent architecture across applications
- Reusable modules and shared infrastructure
- Simplified operations and maintenance
- Ability to share or federate databases if needed

### Target State

| Component | Current | Target |
|-----------|---------|--------|
| **Compute** | Vercel Serverless | AWS EC2 (Express.js) |
| **Database** | Supabase (HTTP API) | AWS RDS PostgreSQL (Connection Pool) |
| **Cache** | Upstash Redis (HTTP) | AWS ElastiCache Redis (TCP) |
| **Secrets** | Environment variables | AWS Secrets Manager |
| **Load Balancer** | Vercel Edge | AWS ALB |

---

## 2. Architecture Comparison

### Current (Mocks Booking)

```
Vercel Function ──HTTP──▶ Supabase REST API ──▶ PostgreSQL
      │
      └──HTTP──▶ Upstash Redis
      │
      └──HTTP──▶ HubSpot API
```

### Other Application (Target Pattern)

```
EC2 Express.js ──TCP──▶ RDS PostgreSQL (Connection Pool)
      │
      └──TCP──▶ ElastiCache Redis
      │
      └────────▶ AWS Secrets Manager
```

### Unified Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Internet                                                          │
│      │                                                              │
│      ▼                                                              │
│   ┌─────────────────────────────────────────┐                      │
│   │         Application Load Balancer        │                      │
│   │         (HTTPS termination)              │                      │
│   └─────────────────────────────────────────┘                      │
│      │                                                              │
│      ├──────────────────┬───────────────────┐                      │
│      ▼                  ▼                   ▼                      │
│   ┌────────┐      ┌────────┐         ┌────────────┐               │
│   │ EC2-1  │      │ EC2-2  │         │ EC2-Dev    │               │
│   │ (Prod) │      │ (Prod) │         │ (Staging)  │               │
│   └────────┘      └────────┘         └────────────┘               │
│      │                │                    │                       │
│      │    Connection Pool (node-pg)        │                       │
│      │    max: 10-20 per instance          │                       │
│      │                │                    │                       │
│      ▼                ▼                    ▼                       │
│   ┌─────────────────────────────────────────┐                      │
│   │         RDS PostgreSQL (Multi-AZ)       │                      │
│   │         db.t4g.large (680 connections)  │                      │
│   │                                         │                      │
│   │   Tables:                               │                      │
│   │   - hubspot_mock_exams                  │                      │
│   │   - hubspot_bookings                    │                      │
│   │   - hubspot_contact_credits             │                      │
│   │   - sync_metadata                       │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                     │
│   ┌─────────────────────────────────────────┐                      │
│   │         ElastiCache Redis               │                      │
│   │         cache.t4g.micro                 │                      │
│   │                                         │                      │
│   │   Keys:                                 │                      │
│   │   - exam:{id}:bookings (counters)       │                      │
│   │   - lock:{exam_id} (distributed locks)  │                      │
│   │   - booking:{id}:{date} (dedup cache)   │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                     │
│   ┌─────────────────────────────────────────┐                      │
│   │         Secrets Manager                  │                      │
│   │                                         │                      │
│   │   Secrets:                              │                      │
│   │   - prepdoctors-db-credentials          │                      │
│   │   - prepdoctors-redis-credentials       │                      │
│   │   - prepdoctors-hubspot-token           │                      │
│   └─────────────────────────────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Integration from Other Application

### 3.1 Files to Copy/Adapt

From your other application's `backend/src/config/`:

| Source File | Target Location | Adaptations |
|-------------|-----------------|-------------|
| `database.js` | `src/config/database.js` | Adjust pool settings, add tables |
| Secrets Manager integration | `src/config/secrets.js` | Same pattern |
| `.env.example` | `.env.example` | Add mocks-specific vars |

### 3.2 Database Configuration (Adapted)

```javascript
// src/config/database.js
// Based on your other application's pattern

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let pool = null;

/**
 * Get database credentials from AWS Secrets Manager or environment
 */
async function getCredentials() {
  // Production: Use Secrets Manager
  if (process.env.AWS_SECRET_NAME) {
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    const command = new GetSecretValueCommand({
      SecretId: process.env.AWS_SECRET_NAME
    });

    const response = await client.send(command);
    return JSON.parse(response.SecretString);
  }

  // Development: Use environment variables
  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  };
}

/**
 * Initialize database connection pool
 */
async function initializeDatabase() {
  if (pool) {
    console.log('Database pool already initialized');
    return pool;
  }

  const credentials = await getCredentials();

  pool = new Pool({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,

    // Connection pool settings (match your other app)
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 10000
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
}

/**
 * Get the connection pool
 */
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Close database connections gracefully
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

/**
 * Initialize required tables (if not exist)
 */
async function initializeTables() {
  const client = await pool.connect();

  try {
    // hubspot_mock_exams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hubspot_mock_exams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hubspot_id TEXT UNIQUE NOT NULL,
        mock_type TEXT NOT NULL,
        mock_set TEXT,
        exam_date DATE NOT NULL,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        location TEXT,
        capacity INTEGER DEFAULT 8,
        total_bookings INTEGER DEFAULT 0,
        is_active TEXT DEFAULT 'true',
        scheduled_activation_datetime TIMESTAMPTZ,
        prerequisite_exam_ids TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ
      )
    `);

    // hubspot_bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hubspot_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hubspot_id TEXT UNIQUE,
        booking_id TEXT,
        idempotency_key TEXT UNIQUE,
        associated_contact_id TEXT NOT NULL,
        associated_mock_exam TEXT NOT NULL,
        student_id TEXT,
        name TEXT,
        student_email TEXT,
        is_active TEXT DEFAULT 'Active',
        exam_date DATE,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        mock_type TEXT,
        mock_set TEXT,
        token_used TEXT,
        dominant_hand TEXT,
        attending_location TEXT,
        attendance TEXT,
        token_refunded BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ
      )
    `);

    // hubspot_contact_credits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hubspot_contact_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hubspot_id TEXT UNIQUE NOT NULL,
        student_id TEXT,
        email TEXT,
        firstname TEXT,
        lastname TEXT,
        student_name TEXT,
        sj_credits INTEGER DEFAULT 0,
        cs_credits INTEGER DEFAULT 0,
        sjmini_credits INTEGER DEFAULT 0,
        mock_discussion_token INTEGER DEFAULT 0,
        shared_mock_credits INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ
      )
    `);

    // sync_metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_type TEXT UNIQUE NOT NULL,
        last_sync_time TIMESTAMPTZ,
        last_modified_time TIMESTAMPTZ,
        records_synced INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_contact ON hubspot_bookings(associated_contact_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_exam ON hubspot_bookings(associated_mock_exam);
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON hubspot_bookings(exam_date);
      CREATE INDEX IF NOT EXISTS idx_exams_date ON hubspot_mock_exams(exam_date);
      CREATE INDEX IF NOT EXISTS idx_exams_active ON hubspot_mock_exams(is_active);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON hubspot_contact_credits(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_student ON hubspot_contact_credits(student_id);
    `);

    console.log('✅ Database tables initialized');
  } finally {
    client.release();
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  closeDatabase,
  initializeTables
};
```

### 3.3 Query Helper Module

```javascript
// src/services/db.js
// Simple query helpers that match Supabase-like patterns

const { getPool } = require('../config/database');

/**
 * Execute a SELECT query and return rows
 */
async function query(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Execute a SELECT query and return single row
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Execute INSERT and return inserted row
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');

  const sql = `
    INSERT INTO ${table} (${columns})
    VALUES (${placeholders})
    RETURNING *
  `;

  const rows = await query(sql, values);
  return rows[0];
}

/**
 * Execute UPDATE and return updated row
 */
async function update(table, data, where) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);
  const whereClause = whereKeys.map((k, i) => `${k} = $${keys.length + i + 1}`).join(' AND ');

  const sql = `
    UPDATE ${table}
    SET ${setClause}, updated_at = NOW()
    WHERE ${whereClause}
    RETURNING *
  `;

  const rows = await query(sql, [...values, ...whereValues]);
  return rows[0];
}

/**
 * Execute within a transaction
 */
async function transaction(callback) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { query, queryOne, insert, update, transaction };
```

---

## 4. Code Migration: Supabase to node-pg

### 4.1 Conversion Patterns

| Supabase Pattern | node-pg Equivalent |
|------------------|-------------------|
| `supabase.from('table').select('*')` | `query('SELECT * FROM table')` |
| `.eq('column', value)` | `WHERE column = $1`, `[value]` |
| `.single()` | `queryOne(...)` |
| `supabase.rpc('func', params)` | `query('SELECT func($1, $2)', [p1, p2])` |
| `.insert(data)` | `insert('table', data)` |
| `.update(data).eq(...)` | `update('table', data, { column: value })` |

### 4.2 Example Conversions

**Get Exam (Before - Supabase):**
```javascript
const { data, error } = await supabaseAdmin
  .from('hubspot_mock_exams')
  .select('*')
  .eq('hubspot_id', examId)
  .single();
```

**Get Exam (After - node-pg):**
```javascript
const exam = await queryOne(
  'SELECT * FROM hubspot_mock_exams WHERE hubspot_id = $1',
  [examId]
);
```

**Create Booking (Before - Supabase RPC):**
```javascript
const { data, error } = await supabaseAdmin.rpc('create_booking_atomic', {
  p_booking_id: bookingId,
  p_mock_exam_id: examId,
  p_student_id: studentId,
  // ...
});
```

**Create Booking (After - node-pg transaction):**
```javascript
const booking = await transaction(async (client) => {
  // Check capacity
  const examResult = await client.query(
    'SELECT * FROM hubspot_mock_exams WHERE hubspot_id = $1 FOR UPDATE',
    [examId]
  );
  const exam = examResult.rows[0];

  if (exam.total_bookings >= exam.capacity) {
    throw new Error('Exam is full');
  }

  // Create booking
  const bookingResult = await client.query(`
    INSERT INTO hubspot_bookings (booking_id, associated_mock_exam, associated_contact_id, ...)
    VALUES ($1, $2, $3, ...)
    RETURNING *
  `, [bookingId, examId, contactId, ...]);

  // Increment booking count
  await client.query(
    'UPDATE hubspot_mock_exams SET total_bookings = total_bookings + 1 WHERE hubspot_id = $1',
    [examId]
  );

  // Deduct credit
  await client.query(
    `UPDATE hubspot_contact_credits SET ${creditField} = ${creditField} - 1 WHERE hubspot_id = $1`,
    [contactId]
  );

  return bookingResult.rows[0];
});
```

---

## 5. Redis Migration: Upstash to ElastiCache

### 5.1 Connection Pattern Change

**Current (Upstash HTTP):**
```javascript
const redis = new Redis(process.env.UPSTASH_REDIS_URL);
// Uses HTTP under the hood
```

**Target (ElastiCache TCP):**
```javascript
// src/config/redis.js
const Redis = require('ioredis');

let redis = null;

async function initializeRedis() {
  if (redis) return redis;

  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,

    // Connection settings
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.error('Redis error:', err));

  return redis;
}

function getRedis() {
  if (!redis) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redis;
}

async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('Redis connection closed');
  }
}

module.exports = { initializeRedis, getRedis, closeRedis };
```

### 5.2 Usage Remains Similar

```javascript
const { getRedis } = require('../config/redis');

// Distributed lock (same API)
const redis = getRedis();
const lockToken = await redis.set(`lock:${examId}`, token, 'EX', 10, 'NX');

// Counter operations (same API)
await redis.incr(`exam:${examId}:bookings`);
await redis.get(`exam:${examId}:bookings`);
```

---

## 6. Server Entry Point

```javascript
// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { initializeDatabase, closeDatabase, initializeTables } = require('./config/database');
const { initializeRedis, closeRedis } = require('./config/redis');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// Routes
app.use('/api', routes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { getPool } = require('./config/database');
    const { getRedis } = require('./config/redis');

    // Test database
    await getPool().query('SELECT 1');

    // Test Redis
    await getRedis().ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Error handler
app.use(errorHandler);

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting server...');

    // Initialize connections
    await initializeDatabase();
    await initializeTables();
    await initializeRedis();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeDatabase();
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closeDatabase();
  await closeRedis();
  process.exit(0);
});

startServer();

module.exports = app;
```

---

## 7. Connection Pool Calculation

### Combined Load (Both Applications)

| Application | EC2 Instances | Pool Size | Total Connections |
|-------------|---------------|-----------|-------------------|
| Other App | 2 | 10 | 20 |
| Mocks Booking | 2 | 10 | 20 |
| Development | 2 | 5 each | 10 |
| **Total** | | | **50** |

### RDS Capacity

| RDS Instance | Max Connections | Your Usage | Utilization |
|--------------|-----------------|------------|-------------|
| db.t4g.large | 680 | 50 | **7.4%** |

**Plenty of headroom** - even if you scale to 10 EC2 instances total, you'd only use ~100 connections (15%).

### Shared vs Separate RDS

**Option A: Shared RDS (Recommended for now)**
```
┌─────────────────────────────────────────┐
│          RDS PostgreSQL                  │
│          db.t4g.large                    │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ other_app_db │  │ mocks_booking_db │ │
│  │ (schema)     │  │ (schema)         │ │
│  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────┘
```
- **Cost:** One RDS instance ($212/mo)
- **Pros:** Cost-effective, shared infrastructure
- **Cons:** Shared failure domain

**Option B: Separate RDS Instances**
```
┌─────────────────┐    ┌─────────────────┐
│ RDS (Other App) │    │ RDS (Mocks)     │
│ db.t4g.medium   │    │ db.t4g.medium   │
└─────────────────┘    └─────────────────┘
```
- **Cost:** Two instances (~$400/mo total)
- **Pros:** Isolation, independent scaling
- **Cons:** More expensive

---

## 8. Migration Phases

### Phase 1: Infrastructure Setup (Week 1)

```
□ Create RDS PostgreSQL instance (or use existing)
  □ Enable Multi-AZ for production
  □ Configure security groups
  □ Set up Secrets Manager

□ Create ElastiCache Redis cluster
  □ Configure security groups
  □ Enable encryption in transit

□ Set up EC2 instances (or use existing)
  □ Configure Auto Scaling Group
  □ Set up ALB with health checks
```

### Phase 2: Data Migration (Week 1-2)

```
□ Export data from Supabase
  pg_dump -h db.xxxx.supabase.co -U postgres -d postgres \
    --table=hubspot_mock_exams \
    --table=hubspot_bookings \
    --table=hubspot_contact_credits \
    --table=sync_metadata \
    > supabase_export.sql

□ Import to RDS
  psql -h your-rds-endpoint.rds.amazonaws.com -U admin -d prepdoctors \
    < supabase_export.sql

□ Verify data integrity
  - Row counts match
  - Sample data spot checks
  - Foreign key relationships intact

□ Migrate PostgreSQL functions (RPC)
  - Export function definitions from Supabase
  - Recreate in RDS
```

### Phase 3: Code Migration (Week 2)

```
□ Copy database.js module from other app
□ Adapt for mocks_booking tables
□ Convert all Supabase calls to node-pg
  □ src/services/supabase-data.js → src/services/db-queries.js
  □ Update all controllers
□ Update Redis integration for ElastiCache
□ Update environment variables
```

### Phase 4: Testing (Week 2-3)

```
□ Unit tests for all database queries
□ Integration tests for booking flow
□ Load testing (target: 50+ RPS)
□ Verify HubSpot sync still works
□ Test distributed locking with Redis
```

### Phase 5: Deployment (Week 3)

```
□ Deploy to staging environment
□ Run parallel with Supabase (read from both, verify consistency)
□ Cutover to AWS
□ Monitor for 48 hours
□ Decommission Supabase
```

---

## 9. Cost Comparison

### Current Architecture

| Service | Monthly Cost |
|---------|--------------|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Upstash Redis | $10 |
| **Total** | **$55** |

### Target Architecture (Option B with Shared RDS)

| Service | Monthly Cost |
|---------|--------------|
| ALB | $30 |
| EC2 Production (x2) | $136 |
| EC2 Development | $17 |
| RDS Multi-AZ (shared) | $212 (split: $106 each) |
| ElastiCache | $25 |
| Secrets Manager | $2 |
| **Total (Mocks Booking share)** | **~$316** |

If RDS is shared with the other app, your effective cost is lower.

---

## 10. Risk Mitigation

### During Migration

| Risk | Mitigation |
|------|------------|
| Data loss during export | Full backup before migration, verify checksums |
| Downtime | Run parallel systems, DNS-based cutover |
| Connection pool exhaustion | Conservative pool sizes, monitoring alerts |
| Performance regression | Load test before cutover, have rollback plan |

### Rollback Plan

1. Keep Supabase active for 2 weeks post-migration
2. DNS cutover allows instant rollback
3. Database export/import can be reversed
4. Environment variables switch between Supabase/RDS

---

## 11. Checklist Summary

```
□ INFRASTRUCTURE
  □ RDS PostgreSQL (create or share existing)
  □ ElastiCache Redis
  □ EC2 instances + ALB
  □ Secrets Manager secrets
  □ Security groups configured

□ DATA MIGRATION
  □ Export from Supabase
  □ Import to RDS
  □ Migrate RPC functions
  □ Verify data integrity

□ CODE MIGRATION
  □ Integrate database.js module
  □ Convert Supabase → node-pg queries
  □ Update Redis connection
  □ Update environment variables
  □ Update server entry point

□ TESTING
  □ Unit tests pass
  □ Integration tests pass
  □ Load testing complete
  □ HubSpot sync verified

□ DEPLOYMENT
  □ Staging deployment
  □ Parallel running period
  □ Production cutover
  □ Monitoring active
  □ Supabase decommissioned
```

---

## 12. Conclusion

By adopting the same database connection pattern from your other application:

1. **Consistency** - Both apps use identical infrastructure patterns
2. **Reusability** - Share modules like `database.js`, secrets management
3. **Simplified ops** - One RDS instance to manage (optionally)
4. **Team knowledge** - Same patterns, no learning curve
5. **Cost efficiency** - Shared infrastructure reduces per-app cost

The migration requires code changes (Supabase → node-pg), but the patterns are straightforward and you already have working examples in your other application.

---

*Document End*
