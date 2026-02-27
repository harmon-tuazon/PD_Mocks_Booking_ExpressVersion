# Infrastructure Expansion Analysis - Option B Optimized

**Generated:** January 25, 2026
**Updated:** February 10, 2026
**Target:** 1,000 concurrent users + zero-downtime development
**Variant:** Cost-optimized with ElastiCache

---

## Executive Summary

This document presents an **optimized variant of Option B** that uses a smaller database instance (db.t4g.medium) combined with ElastiCache Redis for caching. This approach reduces monthly costs while maintaining the same capacity target.

> **Cost Correction (Feb 4, 2026):** The original $270/month estimate was understated by ~29%. The corrected cost analysis in `05-INFRASTRUCTURE-IMPLEMENTATION-PLAN.md` v2.0 calculates **$332/month baseline** (including NAT Gateway, dev instance, and tax). See that document for the authoritative cost breakdown.

| Variant | Monthly Cost | Notes |
|---------|--------------|-------|
| **Option B (Original)** | ~$350 | Simpler architecture, db.t4g.large |
| **Option B (Optimized)** | **~$332** | db.t4g.medium + ElastiCache (corrected in v2.0) |
| **Peak (3 instances)** | **~$468** | When ASG scales to maximum |

> **Infrastructure Status (Feb 10, 2026):** All 8 CloudFormation stacks deployed and healthy. Redis caching not yet implemented in application code.

---

## 1. Architecture Comparison

### Original Option B (db.t4g.large, no cache)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Application     │
                    │   Load Balancer   │
                    └────────┬──────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  EC2 #1     │   │  EC2 #2     │   │  EC2 #3     │
    │  t3.medium  │   │  t3.medium  │   │  t3.medium  │
    │  (ASG)      │   │  (ASG)      │   │  (dev only) │
    └──────┬──────┘   └──────┬──────┘   └─────────────┘
           │                 │
           └────────┬────────┘
                    │
           ┌────────▼────────┐
           │  RDS t4g.large  │
           │  8GB, 680 conn  │
           │  Multi-AZ       │
           └─────────────────┘
```

### Optimized Option B (db.t4g.medium + ElastiCache)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Application     │
                    │   Load Balancer   │
                    └────────┬──────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  EC2 #1     │   │  EC2 #2     │   │  EC2 #3     │
    │  t3.medium  │   │  t3.medium  │   │  t3.medium  │
    │  (ASG)      │   │  (ASG)      │   │  (dev only) │
    └──────┬──────┘   └──────┬──────┘   └─────────────┘
           │                 │
           └────────┬────────┘
                    │
         ┌──────────▼──────────┐
         │    ElastiCache      │  ← NEW: Redis cache layer
         │    Redis            │
         │    cache.t4g.small  │
         └──────────┬──────────┘
                    │
           ┌────────▼────────┐
           │ RDS t4g.medium  │  ← SMALLER: 4GB instead of 8GB
           │  4GB, 340 conn  │
           │  Multi-AZ       │
           └─────────────────┘
```

---

## 2. Cost Comparison

### Original Option B

| Resource | Spec | Monthly Cost |
|----------|------|--------------|
| ALB | Fixed + LCU | $30 |
| EC2 Production (x2) | t3.medium | $136 |
| EC2 Development | t3.small | $17 |
| **RDS Multi-AZ** | **db.t4g.large** | **$212** |
| EBS (50GB x 3) | gp3 | $15 |
| Data Transfer | ~50GB | $5 |
| Route 53 | Hosted zone + checks | $2 |
| Tax (13% HST) | - | $40 |
| **Total** | - | **~$350/mo** |

### Optimized Option B (with ElastiCache)

| Resource | Spec | Monthly Cost |
|----------|------|--------------|
| ALB | Fixed + LCU | $30 |
| EC2 Production (x2) | t3.medium | $136 |
| EC2 Development | t3.small | $17 |
| **RDS Multi-AZ** | **db.t4g.medium** | **$106** |
| **ElastiCache** | **cache.t4g.small** | **$25** |
| EBS (50GB x 3) | gp3 | $15 |
| Data Transfer | ~50GB | $5 |
| Route 53 | Hosted zone + checks | $2 |
| Tax (13% HST) | - | $34 |
| **Total** | - | **~$270/mo** |

### Savings Summary

| Metric | Original | Optimized | Difference |
|--------|----------|-----------|------------|
| **Monthly Cost** | $350 | $270 | **-$80 (23%)** |
| **Annual Cost** | $4,200 | $3,240 | **-$960** |
| **Cost/User** | $0.35 | $0.27 | -$0.08 |

---

## 3. Resource Specifications

### RDS Comparison

| Property | db.t4g.large | db.t4g.medium |
|----------|--------------|---------------|
| vCPU | 2 | 2 |
| Memory | 8 GB | 4 GB |
| Max Connections | ~680 | ~340 |
| Network | Up to 5 Gbps | Up to 5 Gbps |
| Storage IOPS | 3,000 | 3,000 |
| Price (Multi-AZ) | $212/mo | $106/mo |

**Connection Analysis:**
- With 2-4 EC2 instances at 20 connections each = 40-80 total connections
- 340 max connections provides **4-8x headroom**
- Sufficient for 1,000 concurrent users

### ElastiCache Redis (cache.t4g.small)

| Property | Value |
|----------|-------|
| vCPU | 2 |
| Memory | 1.37 GB |
| Network | Up to 5 Gbps |
| Price | $25/mo |
| Latency | Sub-millisecond |

**Cache Capacity:**
- ~1.2 GB usable for caching
- Can store ~50,000-100,000 cached objects
- Sufficient for user sessions, frequent queries, API responses

---

## 4. Performance Impact

### Response Time Improvement

| Operation | Without Cache | With Cache | Improvement |
|-----------|---------------|------------|-------------|
| User profile lookup | 15-50ms | <1ms | **50x faster** |
| Booking slot list | 20-80ms | <1ms | **80x faster** |
| Schedule view | 30-100ms | <1ms | **100x faster** |
| Authentication check | 10-30ms | <1ms | **30x faster** |

### Database Load Reduction

| Metric | Without Cache | With Cache | Reduction |
|--------|---------------|------------|-----------|
| Queries/second | 500 | 50-100 | **80-90%** |
| Connection usage | 40-80 | 20-40 | **50%** |
| CPU utilization | 40-60% | 15-25% | **60%** |

### Expected Cache Hit Rates

| Data Type | Hit Rate | Reason |
|-----------|----------|--------|
| User profiles | 95% | Rarely changes |
| Booking slots | 85% | Changes on booking |
| Schedules | 90% | Weekly updates |
| Activity lists | 80% | Periodic changes |
| **Overall** | **85-90%** | Read-heavy workload |

---

## 5. Application Changes Required

### New Dependencies

```json
// package.json additions
{
  "dependencies": {
    "ioredis": "^5.3.2"
  }
}
```

### Cache Configuration

```javascript
// backend/src/config/cache.js (NEW FILE)
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

module.exports = redis;
```

### Cache Utility Functions

```javascript
// backend/src/utils/cacheUtils.js (NEW FILE)
const redis = require('../config/cache');

const CACHE_TTL = {
  USER_PROFILE: 3600,      // 1 hour
  BOOKING_SLOTS: 300,      // 5 minutes
  SCHEDULE: 1800,          // 30 minutes
  ACTIVITY_LIST: 600,      // 10 minutes
};

/**
 * Get cached data or fetch from database
 */
async function getOrSet(key, fetchFn, ttl = 3600) {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Cache error:', error);
    // Fallback to database on cache failure
    return fetchFn();
  }
}

/**
 * Invalidate cache entries
 */
async function invalidate(pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Clear all cache
 */
async function flush() {
  await redis.flushdb();
}

module.exports = { getOrSet, invalidate, flush, CACHE_TTL };
```

### Example: Caching User Profile

```javascript
// backend/src/controllers/userController.js (MODIFIED)
const { getOrSet, invalidate, CACHE_TTL } = require('../utils/cacheUtils');

// Before (direct database query)
async function getUserProfile(req, res) {
  const { id } = req.params;
  const result = await db.query('SELECT * FROM trainees WHERE id = $1', [id]);
  res.json(result.rows[0]);
}

// After (with caching)
async function getUserProfile(req, res) {
  const { id } = req.params;

  const user = await getOrSet(
    `user:profile:${id}`,
    async () => {
      const result = await db.query('SELECT * FROM trainees WHERE id = $1', [id]);
      return result.rows[0];
    },
    CACHE_TTL.USER_PROFILE
  );

  res.json(user);
}

// Invalidate on update
async function updateUserProfile(req, res) {
  const { id } = req.params;
  // ... update logic ...

  await invalidate(`user:profile:${id}`);
  res.json({ success: true });
}
```

### Example: Caching Booking Slots

```javascript
// backend/src/controllers/bookingController.js (MODIFIED)
const { getOrSet, invalidate, CACHE_TTL } = require('../utils/cacheUtils');

async function getAvailableSlots(req, res) {
  const { date, type } = req.query;

  const slots = await getOrSet(
    `slots:${type}:${date}`,
    async () => {
      const result = await db.query(
        'SELECT * FROM booking_slots WHERE date = $1 AND type = $2 AND available > 0',
        [date, type]
      );
      return result.rows;
    },
    CACHE_TTL.BOOKING_SLOTS
  );

  res.json(slots);
}

async function createBooking(req, res) {
  // ... booking creation logic ...

  // Invalidate slot cache after booking
  await invalidate(`slots:*:${booking.date}`);
  res.json({ success: true });
}
```

### Environment Variables

```bash
# backend/.env.production (additions)
REDIS_HOST=prepdoc-cache.xxxxx.ca-central-1.cache.amazonaws.com
REDIS_PORT=6379
CACHE_ENABLED=true
```

---

## 6. Implementation Plan

### Phase 1: Foundation (Week 1) ✅ COMPLETE
- [x] Create ALB and target groups — `prepdoc-alb-production`
- [x] Set up Auto Scaling Group — `prepdoc-asg-production` (AMI-based)
- [x] Configure health checks — `/health` endpoint
- **Cost:** +$50/mo

### Phase 2: Database + Cache (Week 2) ✅ COMPLETE (infrastructure)
- [x] Deploy RDS db.t4g.medium Multi-AZ — `prepdoc-rds-production`
- [x] Enable Multi-AZ — Included in stack
- [x] Create ElastiCache Redis cluster — `prepdoc-elasticache-production`
- [x] Configure security groups for Redis access — `prepdoc-security-groups-production`
- [ ] Update connection pool settings — Pending (app code)
- **Cost:** +$81/mo (vs +$160 for original)

### Phase 3: Application Integration (Week 2-3) ⏳ PENDING
- [ ] Install ioredis dependency
- [ ] Create cache configuration module
- [ ] Create cache utility functions
- [ ] Implement caching for high-frequency queries:
  - User profiles
  - Booking slots
  - Schedules
  - Activity lists
- [ ] Add cache invalidation on writes
- [ ] Test cache hit rates
- **Development Effort:** 2-3 days

### Phase 4: Development Isolation (Week 3) ✅ COMPLETE
- [x] Launch dedicated dev EC2 instance — `prepdoc-dev-instance-production` (15.223.25.180)
- [x] Set up dev database (shared RDS)
- [x] Configure CI/CD for dev environment — Workflows created
- **Cost:** +$25/mo

### Phase 5: Auto Scaling + Monitoring (Week 4) ✅ COMPLETE (infrastructure)
- [x] Configure ASG scaling policies — CPU 70% target tracking
- [x] Set up CloudWatch alarms — `prepdoc-cloudwatch-production` stack
- [ ] Test scaling behavior — Pending (load test)
- **Cost:** Included

---

## 7. Monitoring Requirements

### ElastiCache CloudWatch Metrics

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| CPUUtilization | >75% | Consider larger instance |
| CurrConnections | >200 | Monitor for leaks |
| CacheHitRate | <70% | Review caching strategy |
| Evictions | >100/min | Increase memory |
| FreeableMemory | <200MB | Increase memory |

### Recommended CloudWatch Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                  PrepDoctors Infrastructure                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   EC2 CPU (%)   │   RDS CPU (%)   │   Cache Hit Rate (%)        │
│   ████████░░    │   ██░░░░░░░░    │   ████████████████░░        │
│      65%        │      15%        │         90%                  │
├─────────────────┼─────────────────┼─────────────────────────────┤
│  RDS Connections│ Cache Memory    │   Response Time (ms)        │
│   ███░░░░░░░    │   ████░░░░░░    │   █░░░░░░░░░░               │
│    45/340       │   550MB/1.2GB   │      25ms avg               │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

## 8. Risk Assessment

### Original Option B Risks

| Risk | Probability | Impact |
|------|-------------|--------|
| Migration downtime | Medium | High |
| Cost overrun | Low | Medium |
| Database bottleneck | Low | High |

### Additional Risks with Optimized Option B

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cache failure | Low | Medium | Graceful fallback to DB |
| Stale data | Medium | Low | Proper invalidation |
| Development complexity | Medium | Low | Code review, testing |
| Cache cold start | Low | Low | Warm-up on deploy |

### Risk Mitigation Strategies

1. **Cache Failure Handling**
   ```javascript
   // Always fallback to database
   try {
     return await redis.get(key);
   } catch (error) {
     console.error('Cache unavailable, using database');
     return await database.query(...);
   }
   ```

2. **Cache Invalidation Strategy**
   - Invalidate on write operations
   - Use short TTL for volatile data
   - Implement cache versioning for schema changes

3. **Monitoring**
   - Alert on cache hit rate drops
   - Monitor for memory pressure
   - Track invalidation patterns

---

## 9. When to Choose Each Option

### Choose Original Option B ($350/mo) If:

- ✅ Want minimal application changes
- ✅ Team unfamiliar with Redis
- ✅ Write-heavy workload (>40% writes)
- ✅ Need to deploy quickly (<1 week)
- ✅ Budget is not a primary concern

### Choose Optimized Option B ($270/mo) If:

- ✅ Cost optimization is important
- ✅ Willing to invest 2-3 days development
- ✅ Read-heavy workload (>60% reads) ← **Your app**
- ✅ Team comfortable with Redis
- ✅ Want better response times

---

## 10. Summary

### Optimized Option B Specifications

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| **Load Balancer** | Application Load Balancer | $30 |
| **Compute** | 2x t3.medium (ASG) + 1x t3.small (dev) | $153 |
| **Database** | db.t4g.medium Multi-AZ | $106 |
| **Cache** | cache.t4g.small Redis | $25 |
| **Storage** | 50GB gp3 x 3 | $15 |
| **Network** | Data transfer + Route 53 | $7 |
| **Tax** | 13% HST | $34 |
| **Total** | | **$270/mo** |

### Capacity

| Metric | Capacity |
|--------|----------|
| Concurrent Users | 1,000+ |
| Database Connections | 340 (4-8x headroom) |
| Cache Memory | 1.2 GB |
| Expected Cache Hit | 85-90% |

### Trade-offs

| Aspect | Original B | Optimized B |
|--------|------------|-------------|
| **Cost** | $350/mo | **$270/mo** ✓ |
| **Performance** | Good | **Better** ✓ |
| **Complexity** | **Lower** ✓ | Higher |
| **Setup Time** | **1-2 weeks** ✓ | 2-3 weeks |
| **Code Changes** | **None** ✓ | 2-3 days |

---

## Quick Decision

| If your priority is... | Choose |
|------------------------|--------|
| **Lower cost** | Optimized B ($270/mo) |
| **Faster response times** | Optimized B |
| **Simpler setup** | Original B ($350/mo) |
| **Minimal code changes** | Original B |

---

**Document Version:** 1.0
**Author:** Infrastructure Analysis Agent
**Related:** [03-EXPANSION-ANALYSIS.md](./03-EXPANSION-ANALYSIS.md)
