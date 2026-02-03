# Database Connection Architecture

## Overview

This application uses **persistent database connections** via connection pooling with PostgreSQL.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL (AWS RDS) |
| Driver | `node-pg` (native PostgreSQL driver) |
| Connection Pattern | Persistent connection pool |
| ORM | None (raw SQL with parameterized queries) |

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/src/config/database.js` | Primary database configuration and pool management |
| `backend/.env.example` | Environment variable template |
| `backend/.env.development` | Development environment settings |
| `backend/.env.production` | Production environment settings |

## Connection Pool Settings

The pool is configured in `backend/src/config/database.js`:

```javascript
pool = new Pool({
  host: credentials.host,
  port: credentials.port,
  database: credentials.database,
  user: credentials.user,
  password: credentials.password,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  acquireTimeoutMillis: 10000
});
```

| Setting | Value | Description |
|---------|-------|-------------|
| `max` | 10 | Maximum concurrent connections in the pool |
| `min` | 2 | Minimum idle connections to maintain |
| `idleTimeoutMillis` | 30,000 ms (30s) | Time before idle connections are closed |
| `connectionTimeoutMillis` | 5,000 ms (5s) | Timeout for establishing a new connection |
| `acquireTimeoutMillis` | 10,000 ms (10s) | Timeout for acquiring a connection from the pool |

## Connection Flow

### Initialization

1. Server starts (`server.js`)
2. `initializeDatabase()` is called
3. Connection pool is created (single instance)
4. `initializeTables()` ensures required tables exist
5. Server begins accepting requests

### Request Handling

1. Model receives a request (e.g., `User.js`, `Activity.js`, `Group.js`)
2. Model calls `getPool()` to access the shared pool
3. Query is executed via `pool.query()`
4. Connection is automatically returned to the pool

### Shutdown

1. `SIGTERM` or `SIGINT` signal received
2. `closeDatabase()` is called
3. Pool connections are gracefully closed

## Credentials Management

### Production (EC2)

- Uses AWS Secrets Manager via `AWS_SECRET_NAME` environment variable
- Region: `ca-central-1`
- Falls back to `.env` file if Secrets Manager is unavailable

### Development

- Uses `.env` file directly
- Connects to AWS RDS PostgreSQL instance

## Model Usage Pattern

All models follow the same pattern for database access:

```javascript
const { getPool } = require('../config/database');

async function someOperation() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
  return result.rows;
}
```

## Security Features

- **Parameterized queries**: All SQL queries use parameterized statements to prevent SQL injection
- **SSL support**: Configurable SSL connections via `DB_SSL` environment variable
- **Secrets Manager**: Production credentials stored in AWS Secrets Manager

## Benefits of This Architecture

1. **Performance**: Reuses connections instead of creating new ones per request
2. **Resource efficiency**: Maintains a controlled number of database connections
3. **Reliability**: Automatic connection management and health checks
4. **Scalability**: Pool size can be adjusted based on load requirements
