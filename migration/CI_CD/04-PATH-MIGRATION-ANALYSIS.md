# Path Migration Analysis — Moving to `/home/appuser/app/`

**Created:** February 9, 2026
**Updated:** February 10, 2026
**Status:** ✅ MIGRATION COMPLETE — All 15 files fixed (Feb 10, 2026)
**Current Path:** `/home/ec2-user/applications/prepdoctors-richmond-hill`
**Target Path:** `/home/appuser/app/`

---

## Table of Contents

1. [Summary](#1-summary)
2. [Core Application — SAFE](#2-core-application--safe)
3. [Files with Hardcoded Paths — MUST FIX](#3-files-with-hardcoded-paths--must-fix)
4. [Recommended Fix Strategy](#4-recommended-fix-strategy)
5. [Detailed File List](#5-detailed-file-list)

---

## 1. Summary

### Verdict: ✅ Migration Complete

The **core application code** (backend/src, frontend/src, PM2 configs, .env files) uses relative paths with `__dirname` and `process.cwd()`. These work at any filesystem location.

**15 files** had hardcoded absolute paths and were **all fixed on February 10, 2026**:
- Backend JS files: Use `process.env.APP_DIR || path.resolve(__dirname, '../../..')`
- Shell scripts: Use `APP_DIR="${APP_DIR:-/home/appuser/app}"`
- JS utility scripts: Use `path.join(__dirname, '..', 'backend', '.env')`
- GitHub Actions: Updated to `/home/appuser/app`

### Impact Matrix

| Category | File Count | Risk | Path Used |
|----------|-----------|------|-----------|
| Core backend (src/) | 100+ | SAFE | `__dirname` (relative) |
| Core frontend (src/) | 100+ | SAFE | No filesystem paths |
| PM2 ecosystem configs | 2 | SAFE | `__dirname`, `process.cwd()` |
| .env files | 6+ | SAFE | No filesystem paths |
| package.json scripts | 2 | SAFE | Relative commands |
| **Backend controllers** | **2** | **MUST FIX** | Hardcoded `/home/ec2-user/RichmondHillApp/Application_17` |
| **Shell scripts** | **8** | **MUST FIX** | Hardcoded `/home/ec2-user/RichmondHillApp/Application_17` |
| **JS utility scripts** | **3** | **MUST FIX** | Hardcoded `/home/ec2-user/...` |
| **GitHub Actions** | **1** | **MUST FIX** | Hardcoded `/home/ec2-user/applications/prepdoctors-richmond-hill` |

---

## 2. Core Application — SAFE

These files use dynamic path resolution and will work at any location:

### Backend Source Code

All files in `backend/src/` use `path.join(__dirname, ...)` for file references:
- `backend/src/routes/bulk.js` → `path.join(__dirname, '../../temp')`
- `backend/src/controllers/bulkController.js` → relative imports
- All other controllers, models, routes → relative imports only

### Frontend Source Code

All files in `frontend/src/` use Next.js conventions (no filesystem paths):
- Page components, API calls, hooks — all use relative imports
- Next.js config uses `process.cwd()` internally

### PM2 Ecosystem Configs

```javascript
// backend/ecosystem.config.js
DOTENV_CONFIG_PATH: path.join(__dirname, '.env.production')  // ✅ Relative

// frontend/ecosystem.config.js
cwd: process.cwd()  // ✅ Dynamic
```

### Additional Scripts (most of them)

77+ scripts in `additional_scripts/` use the safe pattern:
```javascript
const envPath = path.join(__dirname, '..', 'backend', '.env');  // ✅ Relative
```

---

## 3. Files with Hardcoded Paths — ✅ ALL FIXED (Feb 10, 2026)

### Category A: Backend Source Files (Critical)

These are part of the running application and will cause runtime errors:

#### `backend/src/controllers/securityController.js` (Lines 16-19)
```javascript
const APP_DIR = '/home/ec2-user/RichmondHillApp/Application_17';  // ❌ WRONG
const SCRIPTS_DIR = path.join(APP_DIR, 'additional_scripts');
const LOGS_DIR = path.join(APP_DIR, 'logs');
const SECURITY_DIR = path.join(APP_DIR, 'security');
```
**Impact:** Security monitoring, file integrity scanning, malware scanning endpoints fail.

#### `backend/src/models/SystemSettings.js` (Lines 194-195)
```javascript
const backupJob = `${backupSchedule} /home/ec2-user/RichmondHillApp/Application_17/additional_scripts/backup_logs_to_s3.sh ...`;  // ❌ WRONG
const cleanupJob = `${cleanupSchedule} /home/ec2-user/RichmondHillApp/Application_17/additional_scripts/automated_cleanup.sh ...`;  // ❌ WRONG
```
**Impact:** Cron job configuration from admin panel generates invalid paths.

### Category B: Shell Scripts (8 files)

All define `APP_DIR` with the old path:

| File | Line | Current Value |
|------|------|---------------|
| `additional_scripts/automated_cleanup.sh` | 18 | `/home/ec2-user/RichmondHillApp/Application_17` |
| `additional_scripts/backup_logs_to_s3.sh` | 17 | Same |
| `additional_scripts/setup_cron_jobs.sh` | 13 | Same |
| `additional_scripts/security_monitoring_dashboard.sh` | 10 | Same |
| `additional_scripts/security_file_integrity_monitor.sh` | 10 | Same |
| `additional_scripts/security_malware_scanner.sh` | 10 | Same |
| `additional_scripts/setup_security_cron_jobs.sh` | 10 | Same |
| `Dump/aws_deployment/deployment/setup_backups.sh` | 21 | `/home/ec2-user/Application_17` |

### Category C: JavaScript Utility Scripts (3+ files)

| File | Issue |
|------|-------|
| `additional_scripts/create_canvas_notifications_table.js` | `require('dotenv').config({ path: '/home/ec2-user/RichmondHillApp/Application_17/backend/.env' })` |
| `additional_scripts/create_email_templates_and_recipient_sets.js` | Same dotenv path |
| `additional_scripts/execute_trainee_allocation.js` | Hardcoded CSV paths and report output paths |

### Category D: GitHub Actions

| File | Line | Issue |
|------|------|-------|
| `.github/workflows/deploy.yml` | 102 | `cd /home/ec2-user/applications/prepdoctors-richmond-hill` |

---

## 4. Recommended Fix Strategy

### Option A: Environment Variable (Recommended)

Define `APP_DIR` as an environment variable set in `.env` files and PM2 config:

**In `.env.production` and `.env.development`:**
```
APP_DIR=/home/appuser/app
```

**In PM2 ecosystem config:**
```javascript
env: {
  APP_DIR: '/home/appuser/app',
  // ... other vars
}
```

**In JavaScript files:**
```javascript
const APP_DIR = process.env.APP_DIR || path.resolve(__dirname, '../..');
```

**In shell scripts:**
```bash
APP_DIR="${APP_DIR:-/home/appuser/app}"
```

### Option B: Relative Paths with __dirname

For files within the project, use `__dirname` relative resolution:

```javascript
// In backend/src/controllers/securityController.js
const APP_DIR = path.resolve(__dirname, '../../..');  // Goes up from src/controllers/ to app root
```

### Recommendation

Use **Option A** (env var) for shell scripts and backend files that need the absolute path, and **Option B** for JS files where relative resolution is natural. The env var approach also makes the dev-to-prod switch easier — each environment defines its own `APP_DIR`.

---

## 5. Detailed File List

### All Files Fixed (February 10, 2026)

| # | File | Category | Fix Applied | Status |
|---|------|----------|-------------|--------|
| 1 | `backend/src/controllers/securityController.js` | Backend | `process.env.APP_DIR \|\| path.resolve(__dirname, '../../..')` | ✅ |
| 2 | `backend/src/models/SystemSettings.js` | Backend | Added `path` import, `APP_DIR` constant with env fallback | ✅ |
| 3 | `backend/src/controllers/maintenanceStatusController.js` | Backend | Added `path` import, `APP_DIR` constant | ✅ |
| 4 | `additional_scripts/automated_cleanup.sh` | Shell | `APP_DIR="${APP_DIR:-/home/appuser/app}"` | ✅ |
| 5 | `additional_scripts/backup_logs_to_s3.sh` | Shell | Same | ✅ |
| 6 | `additional_scripts/setup_cron_jobs.sh` | Shell | Same | ✅ |
| 7 | `additional_scripts/security_monitoring_dashboard.sh` | Shell | Same | ✅ |
| 8 | `additional_scripts/security_file_integrity_monitor.sh` | Shell | Same | ✅ |
| 9 | `additional_scripts/security_malware_scanner.sh` | Shell | Same | ✅ |
| 10 | `additional_scripts/setup_security_cron_jobs.sh` | Shell | Same | ✅ |
| 11 | `additional_scripts/create_canvas_notifications_table.js` | JS util | `path.join(__dirname, '..', 'backend', '.env')` | ✅ |
| 12 | `additional_scripts/create_email_templates_and_recipient_sets.js` | JS util | Same | ✅ |
| 13 | `additional_scripts/execute_trainee_allocation.js` | JS util | Relative paths for CSV/report files | ✅ |
| 14 | `.github/workflows/deploy.yml` | CI/CD | Updated to `/home/appuser/app` | ✅ |
| 15 | `Dump/aws_deployment/deployment/setup_backups.sh` | Legacy | Updated | ✅ |

### Files That Are Already Correct (No Changes Needed)

- All `backend/src/**/*.js` (except #1 and #2 above)
- All `frontend/src/**/*`
- `backend/ecosystem.config.js`
- `frontend/ecosystem.config.js`
- All `.env*` files
- Both `package.json` files
- 77+ additional_scripts that use `__dirname`

---

## Related Documents

- [01-CI-CD-PIPELINE-OVERVIEW.md](./01-CI-CD-PIPELINE-OVERVIEW.md) — Full pipeline overview
- [02-AMI-LIFECYCLE-STRATEGY.md](./02-AMI-LIFECYCLE-STRATEGY.md) — AMI lifecycle
- [03-IMPLEMENTATION-PLAN.md](./03-IMPLEMENTATION-PLAN.md) — Implementation plan (Phase 1.1 covers the path fixes)

---

**Document Version:** 2.0.0
**Last Updated:** February 10, 2026
**Author:** Development Team
