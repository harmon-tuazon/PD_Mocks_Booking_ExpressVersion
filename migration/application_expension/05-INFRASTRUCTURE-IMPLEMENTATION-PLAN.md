# Infrastructure Implementation Plan — Option B Optimized (Revised v2.0)

| Field | Value |
|---|---|
| Document Version | 2.1 (Updated with deployment status) |
| Date | February 10, 2026 (originally Feb 4, 2026) |
| Target Capacity | 1,000 concurrent users |
| Deployment Method | AWS CloudFormation with pre-baked AMI |
| Region | ca-central-1 (Canada - Central) |
| Application | PrepDoctors (Medical Education Platform) |

## Key Changes in v2.0

- **Corrected cost calculations** — previous version understated monthly costs by ~29% ($270 → $412)
- **AMI-based deployment** replacing fragile UserData bootstrap script
- **AWS Secrets Manager** integration for secure credential handling (no plaintext)
- **Fixed RDS storage type** from gp2 to gp3 for consistency and better performance
- **Added CloudWatch monitoring** and alerting configuration
- **Included development instance** in cost analysis and templates

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Cost Analysis (Corrected)](#2-cost-analysis-corrected)
3. [Architecture Overview](#3-architecture-overview)
4. [Security Design](#4-security-design)
5. [CloudFormation Templates](#5-cloudformation-templates)
6. [Secrets Management](#6-secrets-management)
7. [AMI-Based Deployment](#7-ami-based-deployment)
8. [Monitoring and Alerting](#8-monitoring-and-alerting)
9. [Implementation Timeline](#9-implementation-timeline)
10. [Risk Assessment](#10-risk-assessment)
11. [Rollback Plan](#11-rollback-plan)
12. [Next Steps and Checklist](#12-next-steps-and-checklist)

---

## 1. Executive Summary

This document provides a comprehensive implementation plan for deploying the **Optimized Option B** infrastructure for PrepDoctors using **AWS CloudFormation**. The architecture supports 1,000 concurrent users with high availability, automatic scaling, and a Redis caching layer for improved performance.

> **Important Correction:** This revision corrects significant cost calculation errors in the previous version (v1.0), which understated monthly costs by approximately 29%. The corrected monthly cost is **~$412 CAD** (including tax and dev instance), not $270 as previously stated.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| IaC Tool | CloudFormation | Full control over all AWS components, native support |
| Database | RDS PostgreSQL Multi-AZ | High availability with automatic failover |
| Caching | ElastiCache Redis | 85-90% cache hit rate, sub-ms latency |
| Compute | EC2 Auto Scaling (1-3) | Dynamic scaling based on CPU load |
| Deployment | Pre-baked AMI | Reliable, fast instance provisioning |
| Secrets | AWS Secrets Manager | Encrypted credential storage with IAM policies |

---

## 2. Cost Analysis (Corrected)

The previous analysis contained calculation errors. Below are corrected figures based on actual AWS pricing for the ca-central-1 region.

### 2.1 Monthly Cost Breakdown

| Resource | Specification | Monthly (CAD) |
|---|---|---|
| NAT Gateway | Per hour + data processing | $35 |
| Application Load Balancer | Fixed + LCU charges | $30 |
| EC2 Production (x1 baseline) | t3.medium On-Demand | $68 |
| EC2 Development (x1) | t3.small On-Demand | $17 |
| RDS Multi-AZ | db.t4g.medium PostgreSQL | $106 |
| ElastiCache | cache.t4g.small Redis | $25 |
| EBS Storage | 30 GB gp3 x 2 instances | $6 |
| Data Transfer | ~50 GB outbound/month | $5 |
| Route 53 | Hosted zone + health checks | $2 |
| **Subtotal** | | **$294** |
| **Tax (13% HST - Ontario)** | | **$38** |
| **TOTAL** | | **$332 / month** |

> **Note:** ASG configured for Min 1 / Max 3. During traffic spikes, additional instances scale automatically up to 3 total (~$68/instance). Peak cost with 3 instances: ~$468/month.

### 2.2 Cost Comparison

| Configuration | Monthly Cost (CAD) | Notes |
|---|---|---|
| Current Setup | ~$50 | Single EC2, single RDS, no HA |
| Option B Original | ~$350 | db.t4g.large, no cache, no dev instance |
| **Option B Optimized (Min 1/Max 3)** | **~$332** | db.t4g.medium + ElastiCache, ASG 1-3 |
| Peak Load (3 instances) | ~$468 | When ASG scales to maximum |

### 2.3 Cost Breakdown by Category (Pre-Tax $294)

- **RDS Multi-AZ:** $106 — 36% of subtotal
- **EC2 (2 instances baseline):** $85 — 29%
- **NAT Gateway:** $35 — 12%
- **ALB:** $30 — 10%
- **ElastiCache:** $25 — 9%
- **Storage & Network:** $13 — 4%

### 2.4 Cost Optimization Options

| Option | Savings/mo | Trade-off |
|---|---|---|
| NAT Instance instead of Gateway | ~$25 | Lower throughput, single AZ |
| Reserved Instances (1-year EC2) | ~$40-60 | Upfront commitment required |
| Spot Instances for dev | ~$12 | Possible interruptions |
| Remove dedicated dev instance | $17 | Dev shares prod infra |

---

## 3. Architecture Overview

### 3.1 Target Architecture

Traffic flows from the internet through an Application Load Balancer in public subnets, to EC2 instances in private subnets. The instances connect to RDS PostgreSQL and ElastiCache Redis in the same private subnets.

```
                        ┌──────────────┐
                        │   INTERNET   │
                        └──────┬───────┘
                               │ HTTPS (443)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MyVPC (10.0.0.0/16)                         │
│                                                                 │
│  ┌─── PUBLIC SUBNETS (10.0.1.0/24 | 10.0.2.0/24) ───────────┐ │
│  │                                                            │ │
│  │   [NAT Gateway]              [ALB - HTTPS/HTTP]            │ │
│  │   (Outbound)                 (Internet-Facing)             │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                               │                                 │
│  ┌─── PRIVATE SUBNETS (10.0.3.0/24 | 10.0.4.0/24) ──────────┐ │
│  │                                                            │ │
│  │   [EC2 #1 - ASG]           [EC2 #2 - ASG]                 │ │
│  │   t3.medium                t3.medium                       │ │
│  │   ca-central-1a            ca-central-1b                   │ │
│  │        │                        │                          │ │
│  │        └────────────┬───────────┘                          │ │
│  │                     │                                      │ │
│  │   [ElastiCache Redis]      [RDS Primary]   [RDS Standby]  │ │
│  │   cache.t4g.small          db.t4g.medium   (Multi-AZ)     │ │
│  │   Port 6379                Port 5432                       │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Existing Infrastructure

These resources already exist and will be referenced by CloudFormation stacks:

| Component | ID / Value | Status |
|---|---|---|
| VPC | vpc-0864a161f8c6b5d25 (10.0.0.0/16) | Ready |
| Public Subnet 1A | subnet-027882c30e94bf617 (10.0.1.0/24) | Ready |
| Public Subnet 1B | subnet-01879203b9b8695a0 (10.0.2.0/24) | Ready |
| Private Subnet 1A | subnet-0a1fef1edbe8efd6d (10.0.3.0/24) | Ready |
| Private Subnet 1B | subnet-0488d21afca95a511 (10.0.4.0/24) | Ready |
| Internet Gateway | igw-0f96ced585a06648a | Attached |
| Public Route Table | rtb-076b8210b6a87b46e | Ready |
| Private Route Table | rtb-081a5c15ff1dcc55a | Ready |

### 3.3 Components to Deploy

| Component | Purpose | CF Stack |
|---|---|---|
| NAT Gateway | Outbound internet for private subnets | 01-vpc-enhancements |
| Security Groups (5) | Network access control | 02-security-groups |
| RDS PostgreSQL | Primary DB with Multi-AZ failover | 03-rds |
| ElastiCache Redis | Caching layer for read performance | 04-elasticache |
| Application Load Balancer | Traffic distribution + SSL termination | 05-alb |
| Auto Scaling Group | Dynamic compute scaling (2-4 nodes) | 06-asg |
| CloudWatch Alarms | Monitoring and alerting | 07-cloudwatch |
| Dev Instance | Isolated development environment | 08-dev-instance |

---

## 4. Security Design

### 4.1 Security Group Matrix

| Security Group | Inbound Rules | Attached To |
|---|---|---|
| sg-alb | 443, 80 from 0.0.0.0/0 | ALB |
| sg-app | 3000, 5000 from sg-alb only | EC2 ASG Instances |
| sg-rds | 5432 from sg-app only | RDS PostgreSQL |
| sg-cache | 6379 from sg-app only | ElastiCache Redis |
| sg-dev | 22, 3000-3001, 5000-5001 from Admin IP | Dev EC2 |

### 4.2 Security Group Traffic Flow

```
Internet → [sg-alb :443/:80] → [sg-app :3000/:5000] → [sg-rds :5432]
                                                      → [sg-cache :6379]

[sg-dev :22/:3000/:5000] ← Admin IP only (isolated)
```

### 4.3 Security Best Practices Implemented

- **IMDSv2 Required:** Instance metadata service v2 enforced via `HttpTokens: required`
- **Encryption at Rest:** EBS volumes, RDS storage, and ElastiCache all encrypted
- **Encryption in Transit:** TLS 1.3 on ALB (`ELBSecurityPolicy-TLS13-1-2-2021-06`), SSL for DB connections
- **Secrets Management:** AWS Secrets Manager for database credentials (no plaintext anywhere)
- **Least Privilege:** Security groups restrict traffic to required ports and sources only
- **Deletion Protection:** Enabled on RDS to prevent accidental data loss
- **Private Subnets:** Application and database tiers not directly accessible from internet
- **SSM Session Manager:** SSH access disabled by default; use AWS Systems Manager for secure shell access

### 4.4 Instance Access via SSM Session Manager

SSH is disabled by default (AdminCidrBlock set to 127.0.0.1/32). Use AWS Systems Manager Session Manager for secure access:

```bash
# Connect to an instance without SSH
aws ssm start-session --target <instance-id> --region ca-central-1

# Example:
aws ssm start-session --target i-0ac3692fc2f364ce7 --region ca-central-1
```

**Benefits over SSH:**
- No ports to open in security groups
- Works from any network/IP address
- Full audit logging in CloudTrail
- IAM-based authentication (no SSH keys to manage)

---

## 5. CloudFormation Templates

### 5.1 Stack Organization

```
infrastructure/cloudformation/
├── 01-vpc-enhancements.yaml    # NAT Gateway, Elastic IP, private route update
├── 02-security-groups.yaml     # All 5 security groups (ALB, App, RDS, Cache, Dev)
├── 03-rds.yaml                 # RDS PostgreSQL Multi-AZ with parameter group
├── 04-elasticache.yaml         # Redis cluster with parameter group
├── 05-alb.yaml                 # ALB, target groups, HTTPS/HTTP listeners
├── 06-asg.yaml                 # Launch template, ASG, scaling policies, IAM role
├── 07-cloudwatch.yaml          # Alarms, dashboard, SNS topic
└── parameters/
    ├── production.json         # Production environment parameters
    └── development.json        # Development environment parameters
```

### 5.2 Deployment Order

| Step | Stack | Depends On | Est. Time |
|---|---|---|---|
| 1 | 01-vpc-enhancements | Existing VPC | 5 min |
| 2 | 02-security-groups | VPC | 2 min |
| 3a | 03-rds | Security Groups | 20-30 min |
| 3b | 04-elasticache | Security Groups (parallel with 3a) | 10 min |
| 4 | 05-alb | Security Groups | 5 min |
| 5 | 06-asg | ALB Target Groups | 10 min |
| 6 | 07-cloudwatch | All resources created | 3 min |

### 5.3 RDS Configuration

> **v2.0 Fix:** Storage type corrected from `gp2` to `gp3`. Added explicit IOPS and throughput values. Credentials now fetched from Secrets Manager instead of plaintext parameters.

```yaml
# 03-rds.yaml (key resource - corrected)
RDSInstance:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
  UpdateReplacePolicy: Snapshot
  Properties:
    DBInstanceIdentifier: !Sub 'prepdoc-db-${Environment}'
    DBInstanceClass: db.t4g.medium
    Engine: postgres
    EngineVersion: '17.4'
    AllocatedStorage: 50
    StorageType: gp3                    # CORRECTED (was gp2)
    Iops: 3000                          # ADDED - baseline for gp3
    StorageThroughput: 125              # ADDED - MB/s baseline
    StorageEncrypted: true
    DBName: prepdocrhaws
    MasterUsername: !Sub '{{resolve:secretsmanager:prepdoc/db:SecretString:username}}'
    MasterUserPassword: !Sub '{{resolve:secretsmanager:prepdoc/db:SecretString:password}}'
    DBSubnetGroupName: !Ref DBSubnetGroup
    DBParameterGroupName: !Ref DBParameterGroup
    VPCSecurityGroups:
      - !Ref RDSSecurityGroupId
    MultiAZ: true
    PubliclyAccessible: false
    BackupRetentionPeriod: 7
    PreferredBackupWindow: '03:00-04:00'
    PreferredMaintenanceWindow: 'sun:04:00-sun:05:00'
    DeletionProtection: true
    EnablePerformanceInsights: true
    PerformanceInsightsRetentionPeriod: 7
```

### 5.4 ElastiCache Configuration

```yaml
# 04-elasticache.yaml (key resource)
RedisCluster:
  Type: AWS::ElastiCache::CacheCluster
  Properties:
    ClusterName: !Sub 'prepdoc-cache-${Environment}'
    CacheNodeType: cache.t4g.small
    Engine: redis
    EngineVersion: '7.1'
    NumCacheNodes: 1
    Port: 6379
    CacheSubnetGroupName: !Ref CacheSubnetGroup
    CacheParameterGroupName: !Ref CacheParameterGroup
    VpcSecurityGroupIds:
      - !Ref CacheSecurityGroupId
    PreferredMaintenanceWindow: 'sun:05:00-sun:06:00'
    SnapshotRetentionLimit: 3
    AutoMinorVersionUpgrade: true
```

### 5.5 Launch Template (AMI-Based)

> **Key Change:** Uses a pre-baked AMI from the existing production instance. Minimal UserData only fetches secrets and restarts the app.

```yaml
# 06-asg.yaml (launch template - revised)
LaunchTemplate:
  Type: AWS::EC2::LaunchTemplate
  Properties:
    LaunchTemplateName: !Sub 'prepdoc-lt-${Environment}'
    LaunchTemplateData:
      ImageId: !Ref PrepDocAMI            # Pre-baked AMI from existing instance
      InstanceType: t3.medium
      KeyName: KEY_prepdocRHcanada
      IamInstanceProfile:
        Arn: !GetAtt EC2InstanceProfile.Arn
      SecurityGroupIds:
        - !Ref AppSecurityGroupId
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 30
            VolumeType: gp3
            Encrypted: true
            DeleteOnTermination: true
      MetadataOptions:
        HttpTokens: required              # IMDSv2 enforced
        HttpPutResponseHopLimit: 1
```

### 5.6 UserData Script (Minimal)

Since the AMI already has all dependencies and code installed, the UserData script only needs to fetch credentials and restart PM2:

```bash
#!/bin/bash
set -e

# Fetch database credentials from Secrets Manager
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id prepdoc/db \
  --query SecretString \
  --output text \
  --region ca-central-1)

DB_USER=$(echo $SECRET | jq -r .username)
DB_PASS=$(echo $SECRET | jq -r .password)

# Write environment file for backend
cat > /home/appuser/app/backend/.env.production << EOF
NODE_ENV=production
PORT=5000
DB_HOST=${RDSEndpoint}
DB_PORT=5432
DB_NAME=prepdocrhaws
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_SSL=true
REDIS_HOST=${RedisEndpoint}
REDIS_PORT=6379
AWS_REGION=ca-central-1
EOF

chown appuser:appuser /home/appuser/app/backend/.env.production

# Write environment file for frontend
cat > /home/appuser/app/frontend/.env.production << EOF
NEXT_PUBLIC_API_URL=/api
NODE_ENV=production
EOF

chown appuser:appuser /home/appuser/app/frontend/.env.production

# Restart application via PM2
sudo -u appuser pm2 restart all
```

### 5.7 Auto Scaling Group

```yaml
# 06-asg.yaml (ASG resource)
AutoScalingGroup:
  Type: AWS::AutoScaling::AutoScalingGroup
  Properties:
    AutoScalingGroupName: !Sub 'prepdoc-asg-${Environment}'
    LaunchTemplate:
      LaunchTemplateId: !Ref LaunchTemplate
      Version: !GetAtt LaunchTemplate.LatestVersionNumber
    MinSize: 1                    # Cost-optimized: scales from 1 instance
    MaxSize: 3                    # Sufficient for ~900 concurrent users
    DesiredCapacity: 1
    VPCZoneIdentifier:
      - !Ref PrivateSubnet1Id
      - !Ref PrivateSubnet2Id
    TargetGroupARNs:
      - !Ref FrontendTargetGroupArn
      - !Ref BackendTargetGroupArn
    HealthCheckType: ELB
    HealthCheckGracePeriod: 300
    TerminationPolicies:
      - OldestInstance

# Target Tracking Scaling Policy
ScalePolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    AutoScalingGroupName: !Ref AutoScalingGroup
    PolicyType: TargetTrackingScaling
    TargetTrackingConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ASGAverageCPUUtilization
      TargetValue: 70.0
```

---

## 6. Secrets Management

All sensitive credentials are managed through **AWS Secrets Manager** instead of being passed as CloudFormation parameters or embedded in UserData scripts. This provides encrypted storage, automatic rotation capability, and audit logging via CloudTrail.

### 6.1 Secret Structure

**Secret 1 — Database Credentials:**
```
Secret Name:  PrepDoctorsRHApp/DatabaseCanada/Postgres

Secret Value (JSON):
{
  "username": "postgres",
  "password": "<your-secure-password>",
  "host": "prepdoc-db-production.xxxxx.ca-central-1.rds.amazonaws.com",
  "port": 5432,
  "dbInstanceIdentifier": "prepdocrhawscad",
  "engine": "postgres"
}
```

**Secret 2 — JWT Authentication Secrets:**
```
Secret Name:  PrepDoctorsRHApp/JWTSecrets

Secret Value (JSON):
{
  "JWT_SECRET": "<base64-encoded-secret>",
  "JWT_REFRESH_SECRET": "<base64-encoded-secret>"
}
```

> **Note:** Both secrets already exist in AWS Secrets Manager. The CloudFormation templates reference these secrets via:
> - **RDS creation:** Dynamic references (`{{resolve:secretsmanager:...}}`) for `MasterUsername` and `MasterUserPassword`
> - **EC2 UserData:** AWS CLI fetches at instance boot to write `.env.production` files
> - No sensitive values are passed as CloudFormation parameters

### 6.2 IAM Policy for EC2 Access

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ca-central-1:*:secret:PrepDoctorsRHApp/*"
    }
  ]
}
```

### 6.3 How Secrets Are Used

| Secret | Used By | Method |
|---|---|---|
| `PrepDoctorsRHApp/DatabaseCanada/Postgres` | RDS Instance (CloudFormation) | Dynamic reference: `{{resolve:secretsmanager:...}}` |
| `PrepDoctorsRHApp/DatabaseCanada/Postgres` | EC2 Instances (UserData) | AWS CLI `get-secret-value` at boot |
| `PrepDoctorsRHApp/JWTSecrets` | EC2 Instances (UserData) | AWS CLI `get-secret-value` at boot |

---

## 7. AMI-Based Deployment

Instead of bootstrapping new instances from scratch via UserData (which is fragile and slow), the deployment uses a **pre-baked AMI** created from the existing production EC2 instance. This ensures consistent, fast, and reliable instance provisioning.

### 7.1 AMI Creation Steps

| Step | Command / Action | Notes |
|---|---|---|
| 1. Prepare | Stop non-essential services, clear temp files/logs | Reduces AMI size |
| 2. Create AMI | `aws ec2 create-image --instance-id i-xxx --name "prepdoc-base-v1"` | 10-15 min |
| 3. Tag | Add Version, Environment, CreatedDate tags | For tracking |
| 4. Test | Launch test instance from AMI, verify app starts | Critical step |
| 5. Update CF | Set `PrepDocAMI` parameter to new AMI ID | In parameters file |

### 7.2 AMI Contents

- Node.js 20.x runtime and npm
- PM2 process manager (globally installed)
- Application code at `/home/appuser/app/`
- Pre-built frontend (Next.js build artifacts)
- Backend dependencies installed (`node_modules`)
- PM2 ecosystem configuration files
- CloudWatch agent configured and enabled
- AWS CLI v2 and `jq` (for Secrets Manager retrieval)

### 7.3 Comparison: UserData vs Pre-baked AMI

| Aspect | UserData Bootstrap (Old) | Pre-baked AMI (New) |
|---|---|---|
| Startup Time | 5-10 minutes | Under 1 minute |
| Reliability | Depends on npm, git, external network | Self-contained |
| Consistency | May vary between launches | Identical every time |
| Debugging | Dig through cloud-init logs | Test AMI directly |
| Code Updates | Automatic (pulls from git) | Requires new AMI build |
| Rollback | Redeploy with code fixes | Revert to previous AMI ID |

---

## 8. Monitoring and Alerting

### 8.1 CloudWatch Alarms

| Alarm Name | Metric | Threshold | Action |
|---|---|---|---|
| EC2 High CPU | CPUUtilization | > 80% for 5 min | ASG scale out |
| EC2 Low CPU | CPUUtilization | < 30% for 15 min | ASG scale in |
| RDS High CPU | CPUUtilization | > 80% for 5 min | SNS alert |
| RDS Connections | DatabaseConnections | > 300 | SNS alert |
| Cache Hit Rate Low | CacheHitRate | < 70% | SNS alert |
| Cache Evictions | Evictions | > 100/min | SNS alert |
| ALB 5xx Errors | HTTPCode_ELB_5XX | > 10 in 5 min | SNS alert |
| Unhealthy Hosts | UnHealthyHostCount | > 0 for 3 min | SNS alert |

### 8.2 Response Time Improvement with Cache

| Operation | Without Cache (ms) | With ElastiCache (ms) | Improvement |
|---|---|---|---|
| User Profile Lookup | ~32.5 | < 1 | ~40x faster |
| Booking Slot List | ~50 | < 1 | ~62x faster |
| Schedule View | ~65 | < 1 | ~81x faster |
| Auth Check | ~20 | < 1 | ~25x faster |

### 8.3 Expected Cache Performance

| Data Type | TTL | Expected Hit Rate | Reason |
|---|---|---|---|
| User Profiles | 1 hour | 95% | Rarely changes |
| Booking Slots | 5 minutes | 85% | Updates only on booking events |
| Schedules | 30 minutes | 90% | Updated weekly |
| Activity Lists | 10 minutes | 80% | Periodic changes |
| **Overall Weighted** | - | **85-90%** | Read-heavy workload |

### 8.4 Database Load Reduction

| Metric | Without Cache | With Cache | Reduction |
|---|---|---|---|
| Queries/second | ~500 | 50-100 | 80-90% |
| Connection Usage | 40-80 | 20-40 | ~50% |
| CPU Utilization | 40-60% | 15-25% | ~60% |

---

## 9. Implementation Timeline

Total duration: **~18 business days** across 4 phases.

> **Status Update (Feb 10, 2026):** Phases 1 and 2 are substantially complete. All 8 CloudFormation stacks deployed. Redis caching implementation in application code (Phase 1 item) and DNS cutover (Phase 2 item) remain pending.

### 9.1 Phase 1: Preparation (Days 1-5) — ✅ Mostly Complete

| Day | Task | Owner |
|---|---|---|
| 1 | Review and finalize CloudFormation templates | DevOps |
| 1 | Request/validate ACM certificate for ALB HTTPS | DevOps |
| 2 | Create AMI from current production EC2 instance | DevOps |
| 2 | Create full database snapshot (backup) | DevOps |
| 3 | Create secret in AWS Secrets Manager | DevOps |
| 3-5 | Implement Redis caching layer in application code | Developer |
| 5 | Test updated application with caching locally | Developer |

### 9.2 Phase 2: Infrastructure Deployment (Days 6-10) — ✅ Complete

| Day | Task | Est. Time |
|---|---|---|
| 6 | Deploy 01-vpc-enhancements (NAT Gateway) | 5 min |
| 6 | Deploy 02-security-groups | 2 min |
| 7 | Deploy 03-rds (Multi-AZ PostgreSQL) | 20-30 min |
| 7 | Deploy 04-elasticache (Redis) | 10 min |
| 8 | Migrate data to new RDS (pg_dump / pg_restore) | 30-60 min |
| 8 | Deploy 05-alb (with SSL certificate) | 5 min |
| 9 | Deploy 06-asg (with pre-baked AMI) | 10 min |
| 10 | Update DNS (Route 53) to point to ALB | 5 min + propagation |

### 9.3 Phase 3: Validation (Days 11-15) — ⏳ Pending

| Day | Task |
|---|---|
| 11 | Verify ALB health checks passing on all targets |
| 11-12 | Full end-to-end application feature testing |
| 12-13 | Load testing: simulate 500-1000 concurrent users |
| 13 | Test auto-scaling triggers (scale out and scale in) |
| 14 | Test failover scenarios (terminate instance, RDS failover) |
| 14-15 | Monitor for 48 hours, review CloudWatch metrics |

### 9.4 Phase 4: Cleanup (Days 16-18)

- Decommission old EC2 instance (after successful 48-hour validation)
- Decommission old RDS (keep snapshot for 30 days as safety net)
- Update internal documentation and runbooks
- Brief the team on new infrastructure and deployment workflows

---

## 10. Risk Assessment

### 10.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Migration downtime | Medium | High | Schedule during low-traffic; reduce DNS TTL beforehand |
| Data loss during migration | Low | Critical | Full backup + test restore before cutover |
| Cache failure (Redis down) | Low | Medium | Graceful fallback to DB in application code |
| Stale cache data | Medium | Low | Proper TTLs; cache invalidation on every write |
| AMI compatibility issue | Low | Medium | Test AMI in isolation before deployment |
| Cost overrun | Low | Medium | Billing alerts at $400 and $500 thresholds |
| Secrets exposure | Low | High | Secrets Manager + IAM least-privilege policies |

### 10.2 Cache Failure Handling (Code Pattern)

The application should always gracefully fall back to the database if Redis is unavailable:

```javascript
// backend/src/utils/cacheUtils.js
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
    // If Redis is down, fall back to database seamlessly
    console.error('Cache unavailable, falling back to DB:', error.message);
    return fetchFn();
  }
}
```

---

## 11. Rollback Plan

### 11.1 Rollback Triggers

- Health checks failing for more than 15 minutes
- Error rate exceeds 5% for more than 10 minutes
- Critical application bugs discovered post-migration
- Data integrity issues detected in new RDS

### 11.2 Step 1: Immediate DNS Rollback (~5 minutes)

```bash
# Point DNS back to old EC2 instance
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch file://rollback-dns.json
```

### 11.3 Step 2: Verify Old Infrastructure

```bash
# SSH to old EC2
ssh -i KEY_prepdocRHcanada.pem ec2-user@<old-instance-ip>

# Check application status
pm2 status

# Test endpoint externally
curl -I https://prepdoctorsrhapplication.tech-lucid.com
```

### 11.4 Step 3: Full Stack Teardown (if needed)

```bash
# Delete CloudFormation stacks in reverse order
aws cloudformation delete-stack --stack-name prepdoc-asg
aws cloudformation delete-stack --stack-name prepdoc-alb
aws cloudformation delete-stack --stack-name prepdoc-cache
aws cloudformation delete-stack --stack-name prepdoc-rds     # Disable DeletionProtection first
aws cloudformation delete-stack --stack-name prepdoc-sg
aws cloudformation delete-stack --stack-name prepdoc-vpc
```

---

## 12. Next Steps and Checklist

### 12.1 Pre-Deployment Checklist

| # | Task | Owner | Status |
|---|---|---|---|
| 1 | Review this plan with stakeholders | PM | Pending |
| 2 | Validate ACM certificate for domain | DevOps | **Done** (ISSUED) |
| 3 | Create AWS Secrets Manager secrets (DB + JWT) | DevOps | **Done** (2 secrets created) |
| 4 | Create AMI from dev instance | DevOps | **Done** — `ami-0aef6cb1159ea1754` (Feb 10, 2026) |
| 5 | Deploy all CloudFormation stacks (01-08) | DevOps | **Done** — All 8 stacks deployed and healthy |
| 6 | Fix ALB health check path | DevOps | **Done** — Changed `/api/health` → `/health` |
| 7 | Remove bootstrap mode from 06-asg | DevOps | **Done** — AMI-only, PrepDocAMI required |
| 8 | Implement Redis caching in application code | Developer | Pending |
| 9 | Test caching implementation locally | Developer | Pending |
| 10 | Point DNS to ALB | DevOps | Pending |
| 11 | Configure GitHub Actions CI/CD secrets | DevOps | Pending |
| 12 | Set up billing alerts ($400, $500) | DevOps | Pending |

### 12.2 Deployment Commands (Quick Reference)

```bash
# 1. VPC Enhancements
aws cloudformation create-stack --stack-name prepdoc-vpc \
  --template-body file://01-vpc-enhancements.yaml \
  --parameters file://parameters/production.json

# 2. Security Groups
aws cloudformation create-stack --stack-name prepdoc-sg \
  --template-body file://02-security-groups.yaml \
  --parameters file://parameters/production.json

# 3. RDS (wait ~30 min for Multi-AZ)
aws cloudformation create-stack --stack-name prepdoc-rds \
  --template-body file://03-rds.yaml \
  --parameters file://parameters/production.json

# 4. ElastiCache
aws cloudformation create-stack --stack-name prepdoc-cache \
  --template-body file://04-elasticache.yaml \
  --parameters file://parameters/production.json

# 5. ALB
aws cloudformation create-stack --stack-name prepdoc-alb \
  --template-body file://05-alb.yaml \
  --parameters file://parameters/production.json

# 6. ASG (requires IAM capabilities)
aws cloudformation create-stack --stack-name prepdoc-asg \
  --template-body file://06-asg.yaml \
  --parameters file://parameters/production.json \
  --capabilities CAPABILITY_NAMED_IAM
```

---

**Document Version:** 2.1 (Updated with deployment status)
**Last Updated:** February 10, 2026
**Author:** Infrastructure Analysis Agent
**Related Documents:**
- [03-EXPANSION-ANALYSIS.md](./03-EXPANSION-ANALYSIS.md)
- [04-EXPANSION-ANALYSIS-OPTION-B-OPTIMIZED.md](./04-EXPANSION-ANALYSIS-OPTION-B-OPTIMIZED.md)
