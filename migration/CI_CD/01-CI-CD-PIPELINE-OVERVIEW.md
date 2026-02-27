# CI/CD Pipeline Overview — PrepDoctors Richmond Hill

**Created:** February 9, 2026
**Updated:** February 16, 2026
**Status:** Configured — Awaiting End-to-End Pipeline Test
**Application:** PrepDoctors Richmond Hill (Next.js + Express.js)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State](#2-current-state)
3. [Target Architecture](#3-target-architecture)
4. [Pipeline Stages](#4-pipeline-stages)
5. [Environment Strategy](#5-environment-strategy)
6. [Branch Strategy](#6-branch-strategy)
7. [Infrastructure Components](#7-infrastructure-components)
8. [Security Considerations](#8-security-considerations)
9. [Cost Impact](#9-cost-impact)

---

## 1. Executive Summary

This document outlines the CI/CD pipeline strategy for PrepDoctors Richmond Hill. The pipeline adopts an **AMI-based deployment model** where:

- Code is developed and tested on a **dedicated development EC2 instance** (t3.small, public subnet)
- Developers connect to the dev instance via **SSH-MCP** (VS Code Remote SSH + Claude Code) — no IDE installed on the instance
- After successful testing, an **AMI is created from the dev instance**
- Production instances (ASG) are launched from this AMI — **no bootstrap UserData needed**
- The pipeline is triggered by merges to `main` branch, automating AMI creation and ASG instance refresh

### Why This Approach?

| Problem | Solution |
|---------|----------|
| ASG bootstrap UserData takes 20+ min (npm install, build) causing instance cycling | AMI has everything pre-installed — boot to production in ~1 min |
| Current t2.medium EC2 hosts both dev and prod — costly and risky | Separate dev instance (t3.small) + production ASG |
| Manual deployments via SSH are error-prone | Automated pipeline: push to main → tests → AMI → deploy |
| No staging/testing environment before production | Dev instance serves as integration testing environment |

---

## 2. Current State

### Existing GitHub Actions Workflows

| Workflow | Trigger | What It Does |
|----------|---------|-------------|
| `ci.yml` | Push to `main`/`develop`, PRs to `main` | Backend tests (Postgres), frontend build, security audit |
| `deploy.yml` | Push to `main`, manual dispatch | SSH into EC2, git pull, npm install, build, PM2 restart |

### Current Deployment Flow

```
Developer pushes to main
        │
        ▼
GitHub Actions: ci.yml (tests on ubuntu runner)
        │
        ▼
GitHub Actions: deploy.yml (SSH into EC2)
        │  - git pull
        │  - npm ci (backend + frontend)
        │  - npm run build (frontend)
        │  - pm2 restart
        ▼
Live on single EC2 instance
```

### Problems with Current Approach

1. **Single point of failure** — one EC2 hosts everything
2. **Downtime during deploy** — PM2 restart causes brief outage
3. **No real integration testing** — CI tests run on GitHub's ubuntu runner, not on actual AWS infra
4. **deploy.yml SSH approach won't work with ASG** — can't SSH into instances that scale dynamically
5. **No rollback mechanism** — if deploy breaks, manual intervention required

---

## 3. Target Architecture

### High-Level Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKSTATION                         │
│                                                                      │
│  VS Code ──SSH-MCP──▶ Dev Instance (t3.small, public subnet)       │
│  Claude Code ────────▶ No IDE/Claude installed on instance          │
│                                                                      │
│  Push to 'develop' branch → saves work, triggers CI                 │
│  Push to 'main' branch → triggers full deployment pipeline          │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS PIPELINE                            │
│                                                                      │
│  ┌─────────┐    ┌──────────────┐    ┌───────────┐    ┌───────────┐ │
│  │ CI Tests │───▶│ Deploy to Dev│───▶│ Create AMI│───▶│ ASG Refresh│ │
│  │ (runner) │    │ (SSH to dev) │    │ (AWS CLI) │    │ (AWS CLI)  │ │
│  └─────────┘    └──────────────┘    └───────────┘    └───────────┘ │
│                                                                      │
│  Only on push to 'main'                                             │
└──────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      AWS PRODUCTION (ASG)                             │
│                                                                      │
│  ASG Instance Refresh (rolling replacement)                         │
│  ┌────────┐    ┌────────┐                                           │
│  │ Old EC2 │    │ New EC2 │ ◀── Launched from new AMI               │
│  │ (v1.0) │    │ (v1.1) │     Minimal UserData:                    │
│  └────────┘    └────────┘     - Fetch secrets from Secrets Manager  │
│       │                       - Write .env.production                │
│       ▼                       - Stop dev PM2, start prod PM2        │
│   Terminated                  - cfn-signal success                  │
│   after new                                                         │
│   is healthy                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Pipeline Stages

### Stage 1: CI Tests (GitHub Actions Runner)

**Trigger:** Push to `develop` or `main`, PRs to `main`
**Runs on:** `ubuntu-latest` (GitHub hosted runner)
**Existing workflow:** `ci.yml` (no changes needed)

| Check | Status |
|-------|--------|
| Backend tests (with Postgres service) | Already implemented |
| Frontend build (`npm run build`) | Already implemented |
| Frontend lint + TypeScript type check | Already implemented |
| Security audit (`npm audit`) | Already implemented |
| ci-success gate (all must pass) | Already implemented |

### Stage 2: Deploy to Dev Instance

**Trigger:** Push to `main` (after CI passes)
**Action:** SSH into dev instance, pull latest code, install deps, build, run integration tests

```
SSH into dev instance
    │
    ├── git pull origin main
    ├── cd backend && npm ci
    ├── cd frontend && npm ci && npm run build
    ├── pm2 restart prepdoc-development prepdoc-frontend-development
    ├── Wait for services to stabilize
    ├── Run health checks (backend /health, frontend responds)
    └── Run integration tests against dev environment
```

### Stage 3: Create AMI

**Trigger:** Stage 2 passes
**Action:** Create AMI from dev instance, tag it, wait for availability

```
Stop PM2 processes (clean state)
    │
    ├── aws ec2 create-image --instance-id <dev-instance-id>
    │   --name "prepdoc-v{timestamp}" --no-reboot
    ├── Tag AMI with: version, git-sha, branch, timestamp
    ├── Wait for AMI to become available
    ├── Clean up old AMIs (keep last 3)
    └── Store AMI ID as pipeline artifact
```

### Stage 4: ASG Instance Refresh

**Trigger:** Stage 3 completes
**Action:** Update launch template, trigger rolling refresh

```
Update Launch Template with new AMI ID
    │
    ├── aws ec2 create-launch-template-version
    │   --source-version $Latest --image-id <new-ami>
    ├── aws autoscaling start-instance-refresh
    │   --auto-scaling-group-name prepdoc-asg-production
    │   --preferences MinHealthyPercentage=100
    ├── Wait for instance refresh to complete
    └── Verify new instances are healthy via ALB health checks
```

---

## 5. Environment Strategy

### Development Instance

| Aspect | Configuration |
|--------|--------------|
| **Instance** | t3.small (2 vCPU, 2 GB RAM) |
| **Subnet** | Public (direct internet access) |
| **SSH** | Open to 0.0.0.0/0 (key-pair protected) |
| **Application ports** | 3001 (frontend dev), 5001 (backend dev) |
| **PM2 processes** | `prepdoc-development`, `prepdoc-frontend-development` |
| **Database** | Connects to RDS (`prepdoc-db-production` or dedicated dev DB) |
| **Cache** | Connects to ElastiCache Redis endpoint |
| **Env file** | `.env.development` with real RDS/Redis endpoints from Secrets Manager |

### Production Instances (ASG)

| Aspect | Configuration |
|--------|--------------|
| **Instance** | t3.medium (2 vCPU, 4 GB RAM) |
| **Subnet** | Private (behind ALB + NAT Gateway) |
| **SSH** | Disabled (SSM Session Manager only) |
| **Application ports** | 3000 (frontend prod), 5000 (backend prod) |
| **PM2 processes** | `prepdoc-production`, `prepdoc-frontend-production` |
| **Database** | Connects to RDS via Secrets Manager |
| **Cache** | Connects to ElastiCache Redis endpoint |
| **Env file** | `.env.production` written by UserData at boot |

### Dev-to-Production Switch Mechanism

The AMI is created from the dev instance. When an ASG instance boots from this AMI:

1. **UserData script** detects it's a production instance (launched by ASG, not dev)
2. Stops any running dev PM2 processes (`pm2 delete all`)
3. Fetches production credentials from **Secrets Manager**
4. Writes `.env.production` with real RDS endpoint, Redis endpoint, JWT secrets
5. Rebuilds frontend with production `NEXT_PUBLIC_API_URL=/api` (or uses existing build)
6. Starts PM2 with `--only prepdoc-production` and `--only prepdoc-frontend-production`
7. Sends `cfn-signal` to CloudFormation — instance is ready in ~1-2 minutes

---

## 6. Branch Strategy

### Git Flow

```
feature/* ──▶ develop ──▶ main
                │           │
                │           └── Triggers: CI → Deploy to Dev → AMI → ASG Refresh
                │
                └── Triggers: CI tests only (no deployment)
```

### Rules

| Branch | Purpose | CI | Deploy to Dev | AMI + Production |
|--------|---------|-----|--------------|-----------------|
| `feature/*` | Feature development | On PR to develop | No | No |
| `develop` | Integration branch, save work | Yes (tests only) | No | No |
| `main` | Production-ready code | Yes | Yes | Yes |

### Workflow

1. Developer creates `feature/xyz` branch from `develop`
2. Developer works via SSH-MCP on dev instance, tests manually
3. Push to `develop` to save work → CI tests run
4. When ready for production: merge `develop` → `main`
5. Full pipeline triggers: CI → Dev deploy → AMI → ASG refresh

> **IMPORTANT:** This branching strategy must be documented in:
> - `CLAUDE.md` (root) — so AI assistants follow it
> - `.claude/commands/` — as a reference command
> - Team documentation / README

---

## 7. Infrastructure Components

### Required AWS Resources

| Resource | Template | Purpose |
|----------|----------|---------|
| Dev Instance | `08-dev-instance.yaml` | Development & testing environment |
| Security Groups | `02-security-groups.yaml` | Network access control (includes Dev SG) |
| RDS PostgreSQL | `03-rds.yaml` | Database (shared by dev and prod) |
| ElastiCache Redis | `04-elasticache.yaml` | Cache (shared by dev and prod) |
| ALB | `05-alb.yaml` | Load balancer for production |
| ASG | `06-asg.yaml` | Production auto-scaling (AMI-based mode) |
| CloudWatch | `07-cloudwatch.yaml` | Monitoring and alarms |

### GitHub Actions Secrets Required

| Secret | Purpose | Status |
|--------|---------|--------|
| `AWS_ACCESS_KEY_ID` | AWS credentials for AMI creation + ASG refresh | ✅ Configured |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | ✅ Configured |
| `DEV_INSTANCE_HOST` | Dev instance Elastic IP (15.223.25.180) | ✅ Configured |
| `DEV_INSTANCE_ID` | Dev instance EC2 ID (i-0483fd0272543eda4) | ✅ Configured |
| `EC2_HOST` | Production EC2 host (used by deploy.yml) | ✅ Configured |
| `EC2_SSH_KEY` | SSH private key for dev instance access | ✅ Configured |
| `ASG_NAME` | Auto Scaling Group name | ✅ Configured |
| `LAUNCH_TEMPLATE_ID` | Launch template ID (`lt-0d59cc6155329cdd1`) — static, only versions change | ✅ Configured |

> **Note:** `AWS_ECR_REGISTRY` was removed (Feb 16, 2026) — leftover from Docker era, not referenced by any workflow.

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| AMI contains dev .env files | Production UserData overwrites with Secrets Manager values |
| SSH open to 0.0.0.0/0 on dev | Key-pair authentication required; only dev instance, not prod |
| AWS credentials in GitHub Actions | Use IAM user with minimal permissions (AMI + ASG only) |
| Secrets in AMI snapshot | Dev .env uses placeholder/dev values; real secrets fetched at boot |
| Old AMIs accumulate | Automated cleanup: keep only last 3 AMIs |

### IAM Policy for GitHub Actions (Least Privilege)

The GitHub Actions IAM user needs only:
- `ec2:CreateImage`, `ec2:DescribeImages`, `ec2:DeregisterImage`
- `ec2:CreateLaunchTemplateVersion`, `ec2:DescribeLaunchTemplateVersions`
- `autoscaling:StartInstanceRefresh`, `autoscaling:DescribeInstanceRefreshes`
- `ec2:DescribeSnapshots`, `ec2:DeleteSnapshot` (for AMI cleanup)

---

## 9. Cost Impact

### Before (Current Single EC2)

| Resource | Monthly Cost |
|----------|-------------|
| t2.medium EC2 (dev + prod) | ~$48 |
| **Total** | **~$48** |

### After (Dev Instance + ASG)

| Resource | Monthly Cost |
|----------|-------------|
| t3.small dev instance | ~$17 |
| t3.medium production (ASG min=1) | ~$68 |
| NAT Gateway | ~$35 |
| ALB | ~$30 |
| RDS Multi-AZ | ~$106 |
| ElastiCache Redis | ~$25 |
| AMI storage (~3 AMIs × 30GB) | ~$3 |
| **Total baseline** | **~$284** |

> **Note:** The t2.medium currently hosting everything will be decommissioned after migration to the new architecture, saving $48/month from the combined total.

---

## Related Documents

- [02-AMI-LIFECYCLE-STRATEGY.md](./02-AMI-LIFECYCLE-STRATEGY.md) — AMI creation, tagging, cleanup, rollback
- [03-IMPLEMENTATION-PLAN.md](./03-IMPLEMENTATION-PLAN.md) — Step-by-step implementation plan
- [04-PATH-MIGRATION-ANALYSIS.md](./04-PATH-MIGRATION-ANALYSIS.md) — Analysis of moving app to `/home/appuser/app/`

---

**Document Version:** 1.1.0
**Last Updated:** February 16, 2026
**Author:** Development Team

### Implementation Status (February 10, 2026)

All infrastructure deployed and healthy. Key resources:
- **Dev Instance:** `i-0483fd0272543eda4`, EIP `15.223.25.180`
- **Production AMI:** `ami-0aef6cb1159ea1754`
- **ASG Instance:** `i-0bee2529fda0273db` — InService
- **ALB:** `prepdoc-alb-production-57060640.ca-central-1.elb.amazonaws.com`
- **Workflows created:** `deploy-and-ami.yml`, `create-ami.yml`, `ci.yml` (updated)
- **IAM policy file:** `infrastructure/cloudformation/iam-github-actions-cicd-policy.json`
- **Bootstrap mode removed** from 06-asg.yaml — AMI-only deployment

**Remaining:** Create IAM user, configure GitHub secrets, set branch protections, point DNS to ALB, end-to-end pipeline test.
