# AMI Lifecycle Strategy — PrepDoctors Richmond Hill

**Created:** February 9, 2026
**Updated:** February 10, 2026
**Status:** Implemented — First AMI created, ASG deployed and healthy

---

## Table of Contents

1. [Overview](#1-overview)
2. [AMI Creation Process](#2-ami-creation-process)
3. [AMI Contents](#3-ami-contents)
4. [Production Boot Sequence](#4-production-boot-sequence)
5. [Tagging Convention](#5-tagging-convention)
6. [Retention & Cleanup](#6-retention--cleanup)
7. [Rollback Procedure](#7-rollback-procedure)
8. [Dev-to-Prod Environment Switch](#8-dev-to-prod-environment-switch)

---

## 1. Overview

The AMI-based deployment model eliminates the fragile bootstrap UserData that caused ASG instance cycling (instances created and terminated within minutes because the 10-minute `cfn-signal` timeout was exceeded by 20+ minute npm install + build).

### Key Principle

> The dev instance is the "golden source." After testing, its disk becomes the AMI. Production instances boot from this AMI and only need to fetch secrets and switch PM2 to production mode.

### Lifecycle

```
Dev Instance (testing)
    │
    ▼
Create AMI ──▶ Tag with version, sha, timestamp
    │
    ▼
Update ASG Launch Template with new AMI
    │
    ▼
ASG Instance Refresh (rolling)
    │
    ├── New instance boots from AMI (~30 seconds)
    ├── Minimal UserData runs (~1-2 minutes):
    │   - Fetch secrets from Secrets Manager
    │   - Write .env.production
    │   - Switch PM2 to production mode
    │   - cfn-signal success
    └── Old instance terminated after new is healthy
```

---

## 2. AMI Creation Process

### Pre-AMI Steps (on dev instance)

Before creating the AMI, ensure the dev instance is in a clean state:

```bash
# 1. Pull latest code
cd /home/appuser/app
git checkout main
git pull origin main

# 2. Install all dependencies
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..

# 3. Build frontend for production
cd frontend
NEXT_PUBLIC_API_URL=/api npm run build
cd ..

# 4. Stop PM2 processes (clean state for AMI)
pm2 stop all
pm2 delete all
pm2 save --force

# 5. Clean up temporary files
rm -rf /tmp/npm-*
rm -rf /home/appuser/.npm/_cacache
npm cache clean --force

# 6. Remove sensitive files (secrets fetched at boot)
rm -f /home/appuser/app/backend/.env.production
rm -f /home/appuser/app/frontend/.env.production
# Keep .env.development for dev use after AMI is restored
```

### AMI Creation Command

```bash
# Create AMI (no-reboot to avoid disrupting dev work)
AMI_ID=$(aws ec2 create-image \
  --instance-id <DEV_INSTANCE_ID> \
  --name "prepdoc-$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)" \
  --description "PrepDoctors app - commit $(git rev-parse --short HEAD)" \
  --no-reboot \
  --tag-specifications \
    "ResourceType=image,Tags=[
      {Key=Project,Value=PrepDoctors},
      {Key=Environment,Value=production},
      {Key=GitSHA,Value=$(git rev-parse HEAD)},
      {Key=GitBranch,Value=main},
      {Key=CreatedBy,Value=CI-CD-Pipeline},
      {Key=Version,Value=$(date +%Y%m%d-%H%M%S)}
    ]" \
  --query ImageId --output text \
  --region ca-central-1)

echo "Created AMI: $AMI_ID"

# Wait for AMI to be available
aws ec2 wait image-available --image-ids $AMI_ID --region ca-central-1
echo "AMI $AMI_ID is now available"
```

### Post-AMI: Restart Dev Processes

```bash
# Restart dev environment after AMI creation
cd /home/appuser/app
pm2 start backend/ecosystem.config.js --only prepdoc-development
pm2 start frontend/ecosystem.config.js --only prepdoc-frontend-development
pm2 save
```

---

## 3. AMI Contents

### What's IN the AMI

| Component | Path | Details |
|-----------|------|---------|
| Amazon Linux 2023 | — | Base OS with updates |
| Node.js 20 | `/usr/bin/node` | Via nodesource |
| PM2 | `/usr/bin/pm2` | Global install |
| Git, jq | `/usr/bin/` | System packages |
| Application code | `/home/appuser/app/` | Full repo clone |
| Backend deps | `/home/appuser/app/backend/node_modules/` | `npm ci` completed |
| Frontend deps | `/home/appuser/app/frontend/node_modules/` | `npm ci` completed |
| Frontend build | `/home/appuser/app/frontend/.next/` | `npm run build` completed |
| PM2 ecosystem configs | `/home/appuser/app/*/ecosystem.config.js` | Both dev and prod defined |
| `.env.development` | `/home/appuser/app/backend/.env.development` | Dev config (non-sensitive) |
| `aws-cfn-bootstrap` | `/opt/aws/bin/` | CloudFormation signal helper |

### What's NOT in the AMI

| Item | Why |
|------|-----|
| `.env.production` | **Security** — contains DB password, JWT secrets. Fetched from Secrets Manager at boot. |
| Running PM2 processes | Stopped before AMI creation. Production UserData starts the correct ones. |
| SSH keys / credentials | Instance profile handles AWS auth. SSH key pair set via Launch Template. |

---

## 4. Production Boot Sequence (Minimal UserData)

When an ASG instance launches from the AMI, the UserData script is minimal (~1-2 min):

```bash
#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

EXIT_CODE=0
trap 'EXIT_CODE=1' ERR
trap '/opt/aws/bin/cfn-signal -e $EXIT_CODE --stack <STACK_NAME> --resource AutoScalingGroup --region ca-central-1 || true' EXIT

echo "=== PrepDoctors Production Boot (AMI-based) ==="

# 1. Fetch DB credentials from Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsRHApp/DatabaseCanada/Postgres \
  --query SecretString --output text --region ca-central-1)

DB_USER=$(echo $DB_SECRET | jq -r '.username')
DB_PASS=$(echo $DB_SECRET | jq -r '.password')

# 2. Fetch JWT secrets from Secrets Manager
JWT_SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsRHApp/JWTSecrets \
  --query SecretString --output text --region ca-central-1)

JWT_SECRET_VAL=$(echo $JWT_SECRET_JSON | jq -r '.JWT_SECRET')
JWT_REFRESH_VAL=$(echo $JWT_SECRET_JSON | jq -r '.JWT_REFRESH_SECRET')

# 3. Write production environment files
cat > /home/appuser/app/backend/.env.production << ENVEOF
NODE_ENV=production
PORT=5000
DB_HOST=<RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=prepdocrhaws
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_SSL=true
REDIS_HOST=<REDIS_ENDPOINT>
REDIS_PORT=6379
CACHE_ENABLED=true
AWS_REGION=ca-central-1
AWS_S3_BUCKET=prepdoctors-richmondhill-app-bucket
JWT_SECRET=$JWT_SECRET_VAL
JWT_REFRESH_SECRET=$JWT_REFRESH_VAL
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
ENVEOF

cat > /home/appuser/app/frontend/.env.production << 'ENVEOF'
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_API_BASE_URL=/api
NODE_ENV=production
ENVEOF

chown appuser:appuser /home/appuser/app/backend/.env.production
chown appuser:appuser /home/appuser/app/frontend/.env.production
chmod 600 /home/appuser/app/backend/.env.production
chmod 600 /home/appuser/app/frontend/.env.production

# 4. Clean any dev state and start production PM2
sudo -u appuser pm2 delete all 2>/dev/null || true
cd /home/appuser/app
sudo -u appuser pm2 start backend/ecosystem.config.js --only prepdoc-production
sudo -u appuser pm2 start frontend/ecosystem.config.js --only prepdoc-frontend-production
sudo -u appuser pm2 save

# 5. Set PM2 to start on boot
env PATH=$PATH:/usr/bin pm2 startup systemd -u appuser --hp /home/appuser
systemctl enable pm2-appuser

echo "=== Production Boot Complete ==="
EXIT_CODE=0
```

**Total time:** ~1-2 minutes (vs 20+ minutes with bootstrap)

---

## 5. Tagging Convention

### AMI Tags

| Tag | Value | Example |
|-----|-------|---------|
| `Name` | `prepdoc-YYYYMMDD-HHMMSS-<sha>` | `prepdoc-20260209-143022-a1b2c3d` |
| `Project` | `PrepDoctors` | — |
| `Environment` | `production` | — |
| `GitSHA` | Full commit SHA | `a1b2c3d4e5f6...` |
| `GitBranch` | `main` | — |
| `CreatedBy` | `CI-CD-Pipeline` or `Manual` | — |
| `Version` | `YYYYMMDD-HHMMSS` | `20260209-143022` |
| `Status` | `active` / `previous` / `deprecated` | — |

### Snapshot Tags

AMI creation automatically creates EBS snapshots. These inherit the AMI tags plus:

| Tag | Value |
|-----|-------|
| `AMI-ID` | The parent AMI ID |
| `DeleteWithAMI` | `true` |

---

## 6. Retention & Cleanup

### Policy: Keep Last 3 AMIs

| Slot | Purpose |
|------|---------|
| AMI #1 (latest) | **Active** — currently used by ASG Launch Template |
| AMI #2 | **Previous** — immediate rollback target |
| AMI #3 | **Backup** — secondary rollback |
| AMI #4+ | **Deleted** — deregistered + snapshots cleaned |

### Automated Cleanup Script

```bash
#!/bin/bash
# Clean up old PrepDoctors AMIs, keeping the 3 most recent

KEEP_COUNT=3
PROJECT_TAG="PrepDoctors"
REGION="ca-central-1"

# Get all PrepDoctors AMIs sorted by creation date (newest first)
AMI_LIST=$(aws ec2 describe-images \
  --owners self \
  --filters "Name=tag:Project,Values=$PROJECT_TAG" \
  --query "Images | sort_by(@, &CreationDate) | reverse(@) | [*].ImageId" \
  --output text \
  --region $REGION)

COUNT=0
for AMI_ID in $AMI_LIST; do
  COUNT=$((COUNT + 1))

  if [ $COUNT -le $KEEP_COUNT ]; then
    echo "KEEPING: $AMI_ID (slot #$COUNT)"
    # Tag as active/previous/backup
    if [ $COUNT -eq 1 ]; then STATUS="active";
    elif [ $COUNT -eq 2 ]; then STATUS="previous";
    else STATUS="backup"; fi
    aws ec2 create-tags --resources $AMI_ID --tags Key=Status,Value=$STATUS --region $REGION
  else
    echo "DELETING: $AMI_ID (older than $KEEP_COUNT)"

    # Get associated snapshots before deregistering
    SNAPSHOTS=$(aws ec2 describe-images \
      --image-ids $AMI_ID \
      --query "Images[0].BlockDeviceMappings[*].Ebs.SnapshotId" \
      --output text --region $REGION)

    # Deregister AMI
    aws ec2 deregister-image --image-id $AMI_ID --region $REGION

    # Delete associated snapshots
    for SNAP_ID in $SNAPSHOTS; do
      aws ec2 delete-snapshot --snapshot-id $SNAP_ID --region $REGION
      echo "  Deleted snapshot: $SNAP_ID"
    done
  fi
done
```

---

## 7. Rollback Procedure

### Automatic Rollback (ASG Instance Refresh Failure)

If new instances fail health checks during ASG instance refresh:
- ASG automatically cancels the refresh
- Existing instances remain running
- No manual intervention needed

### Manual Rollback to Previous AMI

```bash
# 1. Find the previous AMI (Status=previous)
PREVIOUS_AMI=$(aws ec2 describe-images \
  --owners self \
  --filters "Name=tag:Project,Values=PrepDoctors" "Name=tag:Status,Values=previous" \
  --query "Images[0].ImageId" --output text --region ca-central-1)

echo "Rolling back to AMI: $PREVIOUS_AMI"

# 2. Create new Launch Template version with previous AMI
TEMPLATE_ID="<LAUNCH_TEMPLATE_ID>"
aws ec2 create-launch-template-version \
  --launch-template-id $TEMPLATE_ID \
  --source-version '$Latest' \
  --launch-template-data "{\"ImageId\":\"$PREVIOUS_AMI\"}" \
  --region ca-central-1

# 3. Trigger instance refresh
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name prepdoc-asg-production \
  --preferences '{"MinHealthyPercentage":100,"InstanceWarmup":300}' \
  --region ca-central-1

echo "Rollback initiated. Monitor with:"
echo "aws autoscaling describe-instance-refreshes --auto-scaling-group-name prepdoc-asg-production"
```

### Rollback Decision Matrix

| Scenario | Action |
|----------|--------|
| New instances fail ALB health check | ASG auto-cancels refresh; no action needed |
| New instances boot but app errors | Manual rollback to previous AMI |
| AMI creation failed | Pipeline stops; no production impact |
| Dev instance tests failed | Pipeline stops before AMI creation; no production impact |

---

## 8. Dev-to-Prod Environment Switch

### How It Works

The AMI contains both `prepdoc-development` and `prepdoc-production` PM2 configs in the ecosystem files. The key difference is:

| Aspect | Development (on dev instance) | Production (on ASG instance) |
|--------|------------------------------|------------------------------|
| PM2 processes | `prepdoc-development` (5001), `prepdoc-frontend-development` (3001) | `prepdoc-production` (5000), `prepdoc-frontend-production` (3000) |
| Env file | `.env.development` (bundled in AMI) | `.env.production` (written by UserData from Secrets Manager) |
| DB connection | RDS endpoint (dev or shared) | RDS endpoint (production) |
| Redis | ElastiCache endpoint | ElastiCache endpoint |
| Frontend | `next dev` (hot reload) | `next start` (pre-built) |

### The Switch Mechanism

The production UserData (Section 4) handles this by:

1. `pm2 delete all` — removes any saved dev processes
2. Writes `.env.production` with production RDS/Redis endpoints
3. Starts only `--only prepdoc-production` and `--only prepdoc-frontend-production`
4. `pm2 save` — saves the production process list

The dev instance is unaffected because the AMI is a snapshot — it doesn't modify the running dev instance.

---

## Related Documents

- [01-CI-CD-PIPELINE-OVERVIEW.md](./01-CI-CD-PIPELINE-OVERVIEW.md) — Full pipeline overview
- [03-IMPLEMENTATION-PLAN.md](./03-IMPLEMENTATION-PLAN.md) — Step-by-step implementation plan
- [04-PATH-MIGRATION-ANALYSIS.md](./04-PATH-MIGRATION-ANALYSIS.md) — Path migration analysis

---

**Document Version:** 1.1.0
**Last Updated:** February 10, 2026
**Author:** Development Team

### Current AMI Inventory (February 10, 2026)

| AMI ID | Status | Source Instance | Created |
|--------|--------|----------------|---------|
| `ami-0aef6cb1159ea1754` | Active | `i-0483fd0272543eda4` (dev instance) | Feb 10, 2026 |

**ASG Instance:** `i-0bee2529fda0273db` — InService, both ALB targets healthy
**Launch Template:** From `prepdoc-asg-production` stack outputs

> **Important Note:** Bootstrap mode was completely removed from 06-asg.yaml after it caused instance cycling. The `PrepDocAMI` parameter is now required (no default). Placeholder values like `<RDS_ENDPOINT>` and `<REDIS_ENDPOINT>` in the UserData template (Section 4) are resolved dynamically via CloudFormation `!ImportValue` in the actual template.
