# CI/CD Implementation Plan — PrepDoctors Richmond Hill

**Created:** February 9, 2026
**Updated:** February 16, 2026
**Status:** Phases 1-3 Complete — Phase 4-5 Pending (infrastructure dependencies)
**Estimated Effort:** Phased implementation across multiple sessions

---

## Table of Contents

1. [Implementation Phases](#1-implementation-phases)
2. [Phase 1: Foundation](#2-phase-1-foundation)
3. [Phase 2: Dev Instance Setup](#3-phase-2-dev-instance-setup)
4. [Phase 3: AMI Pipeline](#4-phase-3-ami-pipeline)
5. [Phase 4: ASG Integration](#5-phase-4-asg-integration)
6. [Phase 5: Full Automation](#6-phase-5-full-automation)
7. [Pre-Implementation Checklist](#7-pre-implementation-checklist)
8. [Post-Implementation Verification](#8-post-implementation-verification)
9. [Reminders & Important Notes](#9-reminders--important-notes)

---

## 1. Implementation Phases

```
Phase 1: Foundation                    ── Path migration, branch strategy, docs           ✅ COMPLETE
    │
Phase 2: Dev Instance Setup            ── Deploy 08-dev-instance, configure app           ✅ COMPLETE
    │
Phase 3: AMI Pipeline                  ── GitHub Actions: create-ami workflow              ✅ COMPLETE
    │
Phase 4: ASG Integration               ── Update 06-asg, deploy-to-production workflow    ⏳ PENDING (needs 02-07 stacks)
    │
Phase 5: Full Automation               ── End-to-end pipeline, decommission old EC2       ⏳ PENDING
```

---

## 2. Phase 1: Foundation ✅ COMPLETE

**Goal:** Prepare codebase for the new deployment model.
**Completed:** February 10, 2026

### 1.1 Fix Hardcoded Paths

Update all files that reference the old `/home/ec2-user/RichmondHillApp/Application_17` path. These are already broken (see [04-PATH-MIGRATION-ANALYSIS.md](./04-PATH-MIGRATION-ANALYSIS.md)).

**Files to update:**

| File | Change |
|------|--------|
| `backend/src/controllers/securityController.js` | Change `APP_DIR` to use `process.env.APP_DIR` or `path.resolve(__dirname, '../..')` |
| `backend/src/models/SystemSettings.js` | Change hardcoded cron paths to use env var |
| `additional_scripts/automated_cleanup.sh` | Change `APP_DIR` to env var or `/home/appuser/app` |
| `additional_scripts/backup_logs_to_s3.sh` | Same |
| `additional_scripts/setup_cron_jobs.sh` | Same |
| `additional_scripts/security_monitoring_dashboard.sh` | Same |
| `additional_scripts/security_file_integrity_monitor.sh` | Same |
| `additional_scripts/security_malware_scanner.sh` | Same |
| `additional_scripts/setup_security_cron_jobs.sh` | Same |
| `.github/workflows/deploy.yml` | Update path (will be replaced later anyway) |

**Recommended approach:** Use an environment variable `APP_DIR` set in `.env` files and PM2 ecosystem config, with fallback:

```javascript
// Node.js
const APP_DIR = process.env.APP_DIR || path.resolve(__dirname, '../..');
```

```bash
# Shell scripts
APP_DIR="${APP_DIR:-/home/appuser/app}"
```

### 1.2 Set Up Branch Strategy ✅ COMPLETE (Feb 16, 2026)

```bash
# Create develop branch from main
git checkout main
git checkout -b develop
git push -u origin develop
```

GitHub branch protections configured (Feb 16, 2026):
- `main`: ✅ Requires PR + `ci-success` check, no force push, no deletion
- `develop`: ✅ Requires `ci-success` check, direct push allowed, no force push, no deletion

### 1.3 Update CLAUDE.md with Branch Strategy

Add to root `CLAUDE.md`:

```markdown
## Branch Strategy (CI/CD)

- `develop` — Integration branch for saving work-in-progress. Push here freely.
- `main` — Production-ready code ONLY. Merging to main triggers the full CI/CD pipeline:
  CI Tests → Deploy to Dev → Create AMI → ASG Instance Refresh
- `feature/*` — Feature branches created from develop.

**IMPORTANT:** Do NOT push directly to `main` unless the code is tested and ready for production deployment.
```

### 1.4 Create Claude Command for Branch Reference

Create `.claude/commands/branch-strategy.md`:

```markdown
# Branch Strategy Reference

- **develop**: Work-in-progress, save code here. Triggers CI tests only.
- **main**: Production deployments. Merge from develop when ready.
- **feature/***: Feature branches from develop.

Push to main triggers: CI → Dev Deploy → AMI Creation → ASG Refresh
```

---

## 3. Phase 2: Dev Instance Setup ✅ COMPLETE

**Goal:** Deploy the dev instance and install the application at `/home/appuser/app/`.
**Completed:** February 10, 2026 — Stack `prepdoc-dev-instance-production`, EIP `15.223.25.180`

### 2.1 Prerequisites

Before deploying 08-dev-instance.yaml:

| Prerequisite | Status |
|-------------|--------|
| 02-security-groups deployed as `prepdoc-security-groups-production` | ✅ Deployed |
| Key pair `KEY_prepdocRHcanada` exists | ✅ |
| VPC and public subnets exist | ✅ |

### 2.2 Deploy Dev Instance Stack

```bash
aws cloudformation create-stack \
  --stack-name prepdoc-dev-instance-production \
  --template-body file://infrastructure/cloudformation/08-dev-instance.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ca-central-1
```

### 2.3 Post-Deployment Configuration

After instance launches and UserData completes:

```bash
# SSH into dev instance
ssh -i KEY_prepdocRHcanada.pem ec2-user@<ELASTIC_IP>

# Verify application was cloned
ls -la /home/appuser/app/

# Configure Secrets Manager access for dev .env
# Fetch RDS and Redis endpoints and write .env.development
# (This step depends on whether 03-rds and 04-elasticache are deployed)
```

### 2.4 Configure VS Code Remote SSH

On developer's local machine:

```
# ~/.ssh/config
Host prepdoc-dev
  HostName <ELASTIC_IP>
  User ec2-user
  IdentityFile ~/.ssh/KEY_prepdocRHcanada.pem
  ForwardAgent yes
```

Then in VS Code: Remote-SSH → Connect to Host → `prepdoc-dev`

### 2.5 Configure Claude Code SSH-MCP

Follow Claude Code SSH-MCP setup to connect to the dev instance. This allows Claude to edit files on the remote instance without being installed there.

---

## 4. Phase 3: AMI Pipeline ✅ COMPLETE

**Goal:** Create GitHub Actions workflow for automated AMI creation.
**Completed:** February 10, 2026 — Workflows created, IAM policy file created, AMI `ami-0aef6cb1159ea1754` created from dev instance

### 3.1 Create IAM User for GitHub Actions

Create an IAM user `github-actions-cicd` with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AMIManagement",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateImage",
        "ec2:DescribeImages",
        "ec2:DeregisterImage",
        "ec2:CreateTags",
        "ec2:DescribeSnapshots",
        "ec2:DeleteSnapshot",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LaunchTemplateManagement",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateLaunchTemplateVersion",
        "ec2:DescribeLaunchTemplates",
        "ec2:DescribeLaunchTemplateVersions",
        "ec2:ModifyLaunchTemplate"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ASGManagement",
      "Effect": "Allow",
      "Action": [
        "autoscaling:StartInstanceRefresh",
        "autoscaling:DescribeInstanceRefreshes",
        "autoscaling:DescribeAutoScalingGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3.2 Add GitHub Secrets ✅ COMPLETE (Feb 16, 2026)

| Secret | Value | Status |
|--------|-------|--------|
| `AWS_ACCESS_KEY_ID` | IAM user access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | ✅ |
| `DEV_INSTANCE_ID` | `i-0483fd0272543eda4` | ✅ |
| `DEV_INSTANCE_HOST` | `15.223.25.180` | ✅ |
| `EC2_HOST` | Production EC2 host | ✅ |
| `EC2_SSH_KEY` | Content of `KEY_prepdocRHcanada.pem` | ✅ |
| `ASG_NAME` | Auto Scaling Group name | ✅ |
| `LAUNCH_TEMPLATE_ID` | `lt-0d59cc6155329cdd1` | ✅ |

### 3.3 Create `deploy-and-ami.yml` Workflow

New workflow: `.github/workflows/deploy-and-ami.yml`

This workflow will:

1. **Trigger** on push to `main` (after CI passes)
2. **Deploy to dev:** SSH into dev instance, pull code, build, test
3. **Create AMI:** Stop PM2, create image, wait for availability, tag
4. **Clean up:** Delete old AMIs (keep 3), restart dev PM2
5. **Store AMI ID:** As workflow output for the next stage

### 3.4 Create `create-ami.yml` (Manual Trigger Option)

For cases where you need to create an AMI without a code change (e.g., OS updates):

```yaml
name: Create AMI (Manual)
on:
  workflow_dispatch:
    inputs:
      description:
        description: 'Reason for AMI creation'
        required: true
```

---

## 5. Phase 4: ASG Integration ✅ COMPLETE

**Goal:** Update ASG template and create production deployment workflow.
**Completed:** February 10, 2026 — Bootstrap mode removed entirely, AMI-only deployment, both ALB targets healthy

### 4.1 Update 06-asg.yaml

Modify the ASG template's UserData for `ami-based` mode:

- Remove the full bootstrap section (no longer needed as fallback — dev instance handles all setup)
- Simplify the `ami-based` UserData to the minimal boot sequence (see [02-AMI-LIFECYCLE-STRATEGY.md](./02-AMI-LIFECYCLE-STRATEGY.md) Section 4)
- Ensure `appuser` home path matches `/home/appuser/app/`
- Increase `CreationPolicy` timeout to `PT10M` as safety margin (should complete in ~2 min)

### 4.2 Create `deploy-to-production.yml` Workflow

Continuation of the pipeline after AMI is created:

1. Get AMI ID from previous workflow/artifact
2. Create new Launch Template version with new AMI
3. Start ASG Instance Refresh
4. Wait for refresh to complete
5. Verify health checks pass

### 4.3 First Production Deployment ✅ DONE

```bash
# Deploy 06-asg (AMI-only, bootstrap removed entirely)
aws cloudformation create-stack \
  --stack-name prepdoc-asg-production \
  --template-body file://infrastructure/cloudformation/06-asg.yaml \
  --parameters \
    ParameterKey=PrepDocAMI,ParameterValue=ami-0aef6cb1159ea1754 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ca-central-1
```

> **Note:** The `DeploymentMode` and `AMIId` parameters were removed from the template. `PrepDocAMI` is now required with no default. Bootstrap mode was removed entirely after it caused ASG instance cycling (~20 instances over 2 hours due to git clone failing for private repos).

---

## 6. Phase 5: Full Automation ⏳ PENDING

**Goal:** End-to-end automated pipeline; decommission old infrastructure.

### 5.1 End-to-End Pipeline Test

```
Push to main → CI passes → Deploy to dev → Tests pass → AMI created → ASG refreshed → Production live
```

Verify:
- [ ] New instances boot from AMI in < 3 minutes
- [ ] Instances pass ALB health checks
- [ ] Application serves traffic correctly
- [ ] Old instances are gracefully terminated
- [ ] Old AMIs are cleaned up

### 5.2 Decommission Current t2.medium EC2

After confirming the new pipeline works:

1. Verify all data/configs are migrated
2. Update DNS if needed (likely points to ALB now, not EC2)
3. Take a final snapshot of the old instance (safety)
4. Stop the instance (don't terminate yet — keep as backup for 1-2 weeks)
5. Terminate after confidence period

### 5.3 Update deploy.yml

Replace the current `deploy.yml` (SSH-based single EC2 deployment) with the new AMI-based pipeline, or disable it entirely and rely on `deploy-and-ami.yml`.

---

## 7. Pre-Implementation Checklist

Before starting implementation:

| Item | Status | Notes |
|------|--------|-------|
| Fix 02-security-groups stack name | ⏳ | Must be `prepdoc-security-groups-production` |
| Deploy 03-rds | ⏳ | Needed for dev instance DB connection |
| Deploy 04-elasticache | ⏳ | Needed for dev instance Redis connection |
| Deploy 05-alb | ⏳ | Needed before 06-asg |
| ACM certificate validated | ⏳ | Needed for ALB HTTPS |
| Secrets Manager: `PrepDoctorsRHApp/JWTSecrets` exists | ⏳ | Verify/create this secret |
| `develop` branch created | ✅ | Created Feb 16, 2026 |
| GitHub branch protections configured | ✅ | main: PR + CI; develop: CI only (Feb 16, 2026) |
| IAM user for GitHub Actions created | ✅ | Credentials configured |
| GitHub secrets populated | ✅ | 8/8 secrets configured (Feb 16, 2026) |

---

## 8. Post-Implementation Verification

### Pipeline Smoke Test

1. Make a trivial change (e.g., update a comment)
2. Push to `develop` → verify CI runs and passes
3. Merge `develop` → `main` → verify full pipeline triggers
4. Verify AMI is created and tagged
5. Verify ASG instance refresh starts
6. Verify new instance passes health checks
7. Verify application works end-to-end

### Rollback Test

1. Create a deliberately broken commit (e.g., syntax error in health check)
2. Verify pipeline catches the error and stops before AMI creation
3. If AMI was created, verify manual rollback to previous AMI works

---

## 9. Reminders & Important Notes

### CLAUDE.md Updates Required

When implementing this pipeline, the following must be added to `CLAUDE.md`:

```markdown
## Branch Strategy (CI/CD)

- **develop**: Integration branch. Push here to save work. Triggers CI tests only.
- **main**: Production-ready only. Triggers full pipeline: CI → Dev Deploy → AMI → Production.
- **feature/***: Feature branches from develop. Use PRs to merge to develop.

**WARNING:** Pushing to `main` triggers production deployment. Only merge tested code.
```

### .claude/commands Updates Required

Create a command reference for the branch strategy so all AI assistants follow the convention.

### GitHub Actions Workflow File Names

| Workflow | File | Trigger |
|----------|------|---------|
| CI Tests | `ci.yml` | Push to `develop`/`main`, PRs to `main` |
| Deploy + AMI | `deploy-and-ami.yml` | Push to `main` (after CI) |
| Manual AMI | `create-ami.yml` | Manual dispatch |
| Deploy to Prod | `deploy-to-production.yml` | After AMI workflow completes |

### Important Distinctions

- `deploy.yml` (current) — Will be deprecated. SSH-based deployment to single EC2.
- `deploy-and-ami.yml` (new) — AMI-based deployment pipeline for ASG.
- The old `deploy.yml` should NOT be deleted until the new pipeline is proven stable.

---

## Related Documents

- [01-CI-CD-PIPELINE-OVERVIEW.md](./01-CI-CD-PIPELINE-OVERVIEW.md) — Full pipeline overview
- [02-AMI-LIFECYCLE-STRATEGY.md](./02-AMI-LIFECYCLE-STRATEGY.md) — AMI creation, tagging, cleanup, rollback
- [04-PATH-MIGRATION-ANALYSIS.md](./04-PATH-MIGRATION-ANALYSIS.md) — Path migration analysis

---

**Document Version:** 1.1.0
**Last Updated:** February 16, 2026
**Author:** Development Team
