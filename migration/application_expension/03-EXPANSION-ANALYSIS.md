# Infrastructure Expansion Analysis

**Generated:** January 25, 2026
**Target:** 1,000 concurrent users + zero-downtime development
**Current:** ~15 concurrent users

---

## Executive Summary

Scaling from 15 to 1,000 concurrent users (67x increase) requires significant infrastructure changes. The application architecture (JWT-based, stateless) is **well-suited for horizontal scaling**.

**Recommended approach:** Multi-tier architecture with load balancing, upgraded database, and separate development environment.

| Scenario | Monthly Cost | Notes |
|----------|--------------|-------|
| **Current** | ~$50 | 15 concurrent users |
| **Option A: Vertical Scale** | ~$180 | Simple, 100-200 users |
| **Option B: Horizontal Scale** | ~$350 | Production-ready, 1000+ users |
| **Option C: High Availability** | ~$550 | Enterprise-grade, redundant |

---

## 1. Current State Analysis

### Architecture Assessment

```
Current Architecture (Single-Tier):
┌─────────────────────────────────────────────────────┐
│                    Internet                         │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────▼───────┐
              │    NGINX      │
              │  (Reverse     │
              │   Proxy)      │
              └───────┬───────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼────┐              ┌────▼────┐
    │ Next.js │              │ Express │
    │ :3000   │              │  :5000  │
    │ (200MB) │              │ (90MB)  │
    └─────────┘              └────┬────┘
                                  │
                           ┌──────▼──────┐
                           │   RDS       │
                           │ PostgreSQL  │
                           │ (14/85 conn)│
                           └─────────────┘
```

### Current Resources

| Component | Spec | Utilization | Bottleneck Risk |
|-----------|------|-------------|-----------------|
| EC2 | t2.medium (2 vCPU, 4GB) | 50% mem, 100% CPU on builds | ⚠️ High |
| RDS | db.t4g.micro (1GB, 85 conn) | 16% connections | ✅ Low |
| Storage | 30GB gp3 | 60% | ⚠️ Medium |
| Network | ~300 Mbps | ~17% | ✅ Low |

### Scaling Compatibility Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Stateless Authentication | ✅ Ready | JWT-based, no server sessions |
| Database Connection Pool | ✅ Ready | pg Pool configured |
| Static Assets | ✅ Ready | Next.js handles bundling |
| File Uploads | ✅ Ready | S3-based storage |
| Environment Config | ✅ Ready | AWS Secrets Manager |
| Session Storage | ✅ N/A | No server-side sessions |

**Conclusion:** Application is architecturally ready for horizontal scaling.

---

## 2. Expansion Requirements Analysis

### Target Workload

| Metric | Current | Target | Multiplier |
|--------|---------|--------|------------|
| Concurrent Users | 15 | 1,000 | 67x |
| Branches | 1 | 6 | 6x |
| Trainees | 156 | ~1,000 | 6.4x |
| Instructors | 6 | 50-100 | 10-17x |
| Requests/Second | 640 peak | ~5,000 est. | 8x |
| DB Connections | 14 | ~200 | 14x |

### Development Requirements

| Requirement | Current | Target |
|-------------|---------|--------|
| Dev Environments | Shared production | Isolated dev/staging |
| Developers | 1 | 2-3 |
| Deployment Impact | Downtime during builds | Zero-downtime |
| CI/CD | Direct to prod | Staged pipeline |

---

## 3. Expansion Options

### Option A: Vertical Scaling (Simple)

**Best for:** Quick wins, 100-200 concurrent users

```
┌─────────────────────────────────────────────────────┐
│                    Internet                         │
└─────────────────────┬───────────────────────────────┘
                      │
              ┌───────▼───────┐
              │  EC2 t3.xlarge│  (Upgraded)
              │  4 vCPU, 16GB │
              │  NGINX+Apps   │
              └───────┬───────┘
                      │
              ┌───────▼───────┐
              │ RDS t4g.medium│  (Upgraded)
              │  4GB, 340 conn│
              └───────────────┘
```

**Changes Required:**
- Upgrade EC2: t2.medium → t3.xlarge
- Upgrade RDS: db.t4g.micro → db.t4g.medium
- Increase EBS: 30GB → 50GB
- Add development EC2 instance

**Cost Breakdown:**

| Resource | Current | New | Monthly Cost |
|----------|---------|-----|--------------|
| EC2 Production | t2.medium | t3.xlarge | $135 |
| EC2 Development | - | t3.small | $17 |
| RDS | db.t4g.micro | db.t4g.medium | $53 |
| EBS (50GB gp3) | 30GB | 50GB | $5 |
| VPC/Network | - | - | $4 |
| Tax (13% HST) | - | - | $28 |
| **Total** | $50 | - | **~$180/mo** |

**Pros:**
- Simple implementation (resize instances)
- No architectural changes
- Quick to implement (<1 day)

**Cons:**
- Single point of failure
- Builds still affect production
- Limited to ~200 concurrent users
- Not truly scalable

---

### Option B: Horizontal Scaling (Recommended)

**Best for:** 500-1,500 concurrent users, production workloads

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Application     │
                    │   Load Balancer   │
                    │   (ALB)           │
                    └────────┬──────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
    │  EC2 #1     │   │  EC2 #2     │   │  EC2 #3     │
    │  t3.medium  │   │  t3.medium  │   │  t3.medium  │
    │  (auto-scale│   │  (auto-scale│   │  (dev only) │
    │   group)    │   │   group)    │   │             │
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

**Changes Required:**
1. **Application Load Balancer (ALB)**
   - Distributes traffic across instances
   - Health checks and automatic failover
   - SSL termination

2. **Auto Scaling Group (ASG)**
   - Min: 2, Max: 4 instances
   - Scale based on CPU (>70%) or connections
   - Automatic replacement of failed instances

3. **RDS Upgrade + Multi-AZ**
   - db.t4g.large (8GB, 680 connections)
   - Multi-AZ for automatic failover
   - Automated backups (7 days)

4. **Separate Development Environment**
   - Dedicated t3.small instance
   - Separate from production ASG
   - Own database (or dev schema)

**Cost Breakdown:**

| Resource | Spec | Monthly Cost |
|----------|------|--------------|
| ALB | Fixed + LCU | $30 |
| EC2 Production (x2) | t3.medium | $68 x 2 = $136 |
| EC2 Development | t3.small | $17 |
| RDS Multi-AZ | db.t4g.large | $212 |
| EBS (50GB x 3) | gp3 | $15 |
| Data Transfer | ~50GB | $5 |
| Route 53 | Hosted zone + checks | $2 |
| Tax (13% HST) | - | $40 |
| **Total** | - | **~$350/mo** |

**Pros:**
- No single point of failure
- Zero-downtime deployments (rolling updates)
- Auto-scaling for traffic spikes
- Developers don't affect production
- Can handle 1,000+ concurrent users

**Cons:**
- More complex setup
- Requires infrastructure-as-code knowledge
- Higher baseline cost

---

### Option C: High Availability (Enterprise)

**Best for:** Mission-critical, 1,500+ users, strict SLA requirements

```
┌───────────────────────────────────────────────────────────────────────┐
│                            Internet                                   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │      CloudFront       │  (CDN)
                    │   Static Assets       │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Application        │
                    │    Load Balancer      │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
 ┌──────▼──────┐        ┌───────▼───────┐       ┌──────▼──────┐
 │  EC2 AZ-a   │        │   EC2 AZ-b    │       │  EC2 Dev    │
 │  t3.large   │        │   t3.large    │       │  t3.medium  │
 │ (ASG: 2-6)  │        │  (ASG: 2-6)   │       │  (isolated) │
 └──────┬──────┘        └───────┬───────┘       └─────────────┘
        │                       │
        └───────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │   ElastiCache       │  (Optional: Session/Cache)
         │   Redis Cluster     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   RDS Multi-AZ      │
         │   db.m6g.large      │
         │   + Read Replica    │
         └─────────────────────┘
```

**Additional Components:**
- CloudFront CDN for static assets
- ElastiCache Redis for API response caching
- RDS Read Replica for read-heavy operations
- Multi-AZ deployment across availability zones
- Enhanced monitoring and alerting

**Cost Breakdown:**

| Resource | Spec | Monthly Cost |
|----------|------|--------------|
| CloudFront | 100GB transfer | $10 |
| ALB | Fixed + LCU | $35 |
| EC2 Production (x3 avg) | t3.large | $80 x 3 = $240 |
| EC2 Development | t3.medium | $34 |
| ElastiCache | cache.t4g.small | $25 |
| RDS Primary Multi-AZ | db.m6g.large | $260 |
| RDS Read Replica | db.m6g.large | $130 |
| EBS Storage | 150GB total | $15 |
| Data Transfer | ~100GB | $10 |
| Route 53 + Health | - | $5 |
| Tax (13% HST) | - | $65 |
| **Total** | - | **~$550/mo** |

**Pros:**
- Enterprise-grade reliability
- Geographic distribution ready
- Handles traffic spikes automatically
- Read replica offloads database
- Sub-100ms response times with caching

**Cons:**
- Highest cost
- Most complex to manage
- May be overkill for 1,000 users

---

## 4. Recommendation

### For 1,000 Concurrent Users: **Option B (Horizontal Scaling)**

**Rationale:**
1. **Right-sized for target:** Handles 1,000 users with room to grow
2. **Zero-downtime development:** Separate dev instance + rolling deployments
3. **Cost-effective:** 7x more users for 7x cost ($50 → $350)
4. **Future-proof:** Easy to scale further with ASG adjustments

### Implementation Phases

> **Status Update (Feb 10, 2026):** Infrastructure deployment complete. All 8 CloudFormation stacks deployed. See `05-INFRASTRUCTURE-IMPLEMENTATION-PLAN.md` for detailed v2.0 plan with corrected costs ($332/mo baseline, not $350).

#### Phase 1: Foundation (Week 1) ✅ COMPLETE
- [x] Create ALB and target groups — `prepdoc-alb-production` stack
- [x] Set up Auto Scaling Group — `prepdoc-asg-production` stack (AMI-based)
- [x] Configure health checks — Fixed to `/health` (was `/api/health`)
- [x] Test load balancer routing — Both targets healthy
- **Estimated Cost:** +$50/mo (ALB only)

#### Phase 2: Database (Week 2) ✅ COMPLETE
- [x] Deploy RDS Multi-AZ — `prepdoc-rds-production` stack (db.t4g.medium, gp3)
- [x] Enable Multi-AZ — Included in stack
- [x] Backup retention 7 days — Configured
- [ ] Update connection pool settings — Pending (app code change)
- **Estimated Cost:** +$106/mo

#### Phase 3: Development Isolation (Week 3) ✅ COMPLETE
- [x] Launch dedicated dev EC2 instance — `prepdoc-dev-instance-production` (t3.small, 15.223.25.180)
- [x] Set up dev database (shared RDS) — Connected via Secrets Manager
- [x] Configure CI/CD for dev environment — Workflows created
- [x] Update GitHub Actions workflow — `deploy-and-ami.yml`, `create-ami.yml`
- **Estimated Cost:** +$17/mo

#### Phase 4: Auto Scaling + Monitoring (Week 4) ✅ COMPLETE
- [x] Configure ASG scaling policies — CPU-based (70% threshold)
- [x] Set up CloudWatch alarms — `prepdoc-cloudwatch-production` stack
- [x] Deploy ElastiCache Redis — `prepdoc-elasticache-production` stack
- [ ] Test scaling behavior — Pending (load test)
- [ ] Document runbooks — Pending
- **Estimated Cost:** +$25/mo (Redis)

### Configuration Recommendations

#### EC2 Instance (t3.medium for production nodes)
```
Instance Type: t3.medium
vCPU: 2
Memory: 4 GB
Network: Up to 5 Gbps
EBS: 25 GB gp3

PM2 Configuration:
- Frontend: 1 instance (cluster mode)
- Backend: 2 instances (cluster mode)
```

#### RDS Configuration (db.t4g.large)
```
Instance: db.t4g.large
vCPU: 2
Memory: 8 GB
Max Connections: ~680
Storage: 50 GB gp2 (auto-scaling enabled)
Multi-AZ: Yes
Backup Retention: 7 days
```

#### Connection Pool Settings
```javascript
// backend/src/config/database.js
const pool = new Pool({
  max: 20,           // Connections per EC2 instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// With 2-4 EC2 instances: 40-80 total connections
// Well within 680 limit
```

#### Auto Scaling Policy
```yaml
MinSize: 2
MaxSize: 4
DesiredCapacity: 2

ScaleOut:
  Metric: CPUUtilization
  Threshold: 70%
  Action: Add 1 instance
  Cooldown: 300 seconds

ScaleIn:
  Metric: CPUUtilization
  Threshold: 30%
  Action: Remove 1 instance
  Cooldown: 300 seconds
```

---

## 5. Cost Comparison Summary

| Scenario | Users | Monthly Cost | Cost/User |
|----------|-------|--------------|-----------|
| **Current** | 15 | $50 | $3.33 |
| **Option A** | 200 | $180 | $0.90 |
| **Option B** | 1,000 | $350 | $0.35 |
| **Option C** | 2,000+ | $550 | $0.28 |

### Projected Annual Costs

| Option | Monthly | Annual | vs Current |
|--------|---------|--------|------------|
| Current | $50 | $600 | - |
| Option A | $180 | $2,160 | +$1,560 |
| **Option B** | **$350** | **$4,200** | **+$3,600** |
| Option C | $550 | $6,600 | +$6,000 |

### Cost Optimization Opportunities

1. **Reserved Instances (1-year):** Save ~30% on EC2 and RDS
   - Option B with RI: ~$245/mo (saves $105/mo)

2. **Savings Plans:** Save ~25% on compute
   - Option B with SP: ~$260/mo (saves $90/mo)

3. **Right-sizing after launch:** Monitor and adjust
   - Potential to reduce if traffic lower than expected

---

## 6. Development Workflow Changes

### Current Workflow (Single Environment)
```
Developer → Push to GitHub → CI builds on EC2 → Production
                                    ↓
                            (Downtime during build)
```

### Proposed Workflow (Option B)
```
Developer → Push to GitHub → CI builds artifact
                                    ↓
                            Deploy to Dev EC2
                                    ↓
                              Test & Verify
                                    ↓
                         Rolling deploy to ASG
                                    ↓
                        (Zero downtime - instances
                         updated one at a time)
```

### CI/CD Updates Required

```yaml
# .github/workflows/deploy.yml (updated)
jobs:
  build:
    # Build artifacts (unchanged)

  deploy-dev:
    needs: build
    # Deploy to development instance
    # Run automated tests

  deploy-prod:
    needs: deploy-dev
    # Rolling deployment to ASG
    # Health check verification
    # Automatic rollback on failure
```

---

## 7. Migration Checklist

> **Updated Feb 10, 2026** — Infrastructure deployed via CloudFormation. See `05-INFRASTRUCTURE-IMPLEMENTATION-PLAN.md` for full details.

### Pre-Migration ✅ COMPLETE
- [x] Document current configuration
- [x] Backup database
- [x] Export PM2 ecosystem config
- [x] Test application locally
- [x] Create AMI from dev EC2 — `ami-0aef6cb1159ea1754`

### Infrastructure Setup ✅ COMPLETE
- [x] VPC with public/private subnets — `prepdoc-vpc-enhancements-production`
- [x] Set up ALB with SSL certificate — `prepdoc-alb-production`
- [x] Create launch template for ASG — in `prepdoc-asg-production`
- [x] Configure Auto Scaling Group — AMI-based, 1-3 instances
- [x] Deploy RDS Multi-AZ — `prepdoc-rds-production` (db.t4g.medium, gp3)
- [x] Deploy ElastiCache Redis — `prepdoc-elasticache-production`

### Application Updates ⏳ PARTIALLY COMPLETE
- [x] Configure health check endpoint — `/health` confirmed working
- [ ] Implement Redis caching in app code — Pending
- [ ] Update CORS settings if needed — Pending verification
- [ ] Test database connection pooling — Pending

### Validation ⏳ PENDING
- [ ] Load test with simulated traffic
- [ ] Verify auto-scaling triggers
- [ ] Test failover scenarios
- [ ] Confirm zero-downtime deployment
- [ ] Monitor for 24-48 hours

### Post-Migration ⏳ PARTIALLY COMPLETE
- [x] Update documentation — Ongoing
- [ ] Point DNS to ALB
- [ ] Configure GitHub Actions CI/CD secrets
- [ ] Set up monitoring dashboards — CloudWatch deployed
- [x] Configure alerts — `prepdoc-cloudwatch-production` deployed

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration downtime | Medium | High | Schedule during off-hours, have rollback plan |
| Cost overrun | Low | Medium | Set budget alerts, monitor usage |
| Scaling issues | Low | High | Load test before production |
| Database bottleneck | Low | High | Monitor connections, read replica if needed |
| Developer conflicts | Low | Low | Clear branching strategy, separate environments |

---

## Appendix: AWS CLI Commands for Implementation

### Create Application Load Balancer
```bash
aws elbv2 create-load-balancer \
  --name prepdoc-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application
```

### Upgrade RDS Instance
```bash
aws rds modify-db-instance \
  --db-instance-identifier prepdocrhawscad \
  --db-instance-class db.t4g.large \
  --multi-az \
  --apply-immediately
```

### Create Auto Scaling Group
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name prepdoc-asg \
  --launch-template LaunchTemplateName=prepdoc-template \
  --min-size 2 \
  --max-size 4 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:...
```

---

**Document Version:** 1.0
**Author:** Infrastructure Analysis Agent
**Status:** Ready for Review

---

## Quick Decision Matrix

| If you need... | Choose | Cost |
|----------------|--------|------|
| Quick fix, <200 users | Option A | $180/mo |
| **1,000 users, zero-downtime dev** | **Option B** | **$350/mo** |
| Enterprise, 2,000+ users | Option C | $550/mo |
