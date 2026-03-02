#!/bin/bash
# =============================================================================
# Restore .env files on the dev instance from AWS Secrets Manager
#
# Usage: sudo bash scripts/restore-dev-env.sh [APP_DIR]
#   APP_DIR defaults to /home/appuser/app
#
# Called by CI/CD pipeline after AMI creation to restore dev environment.
# Can also be run manually to recover from missing .env files.
# =============================================================================

set -e

APP_DIR="${1:-/home/appuser/app}"
REGION="ca-central-1"

echo "=== Restoring .env files from Secrets Manager ==="
echo "APP_DIR: ${APP_DIR}"

# -----------------------------------------------------------------------------
# 1. Fetch secrets from AWS Secrets Manager
# -----------------------------------------------------------------------------

# Database credentials
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsApp/DatabaseProduction/Postgres \
  --query SecretString --output text \
  --region ${REGION} 2>/dev/null || echo '{}')

DB_USER=$(echo $DB_SECRET | jq -r '.username // "postgres"')
DB_PASS=$(echo $DB_SECRET | jq -r '.password // ""')

# Admin app secrets
ADMIN_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsApp/AdminApp/Secret \
  --query SecretString --output text \
  --region ${REGION} 2>/dev/null || echo '{}')

HS_TOKEN=$(echo $ADMIN_SECRET | jq -r '.HS_PRIVATE_APP_TOKEN // ""')
HS_PORTAL=$(echo $ADMIN_SECRET | jq -r '.HUBSPOT_PORTAL_ID // ""')
SUPABASE_URL=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_URL // ""')
SUPABASE_ANON=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_ANON_KEY // ""')
SUPABASE_SERVICE=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_SERVICE_ROLE_KEY // ""')
CRON_SECRET_VAL=$(echo $ADMIN_SECRET | jq -r '.CRON_SECRET // ""')
REDIS_URL=$(echo $ADMIN_SECRET | jq -r '.PD_Bookings_Cache_REDIS_URL // ""')
SHAKY_KEY=$(echo $ADMIN_SECRET | jq -r '.SHAKY_MOCKS_KEY // ""')
EDGE_FUNC_URL=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_EDGE_FUNCTION_URL // ""')

# User app secrets
USER_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsApp/UserApp/Secret \
  --query SecretString --output text \
  --region ${REGION} 2>/dev/null || echo '{}')

USER_HS_TOKEN=$(echo $USER_SECRET | jq -r '.HS_PRIVATE_APP_TOKEN // ""')
USER_SUPABASE_URL=$(echo $USER_SECRET | jq -r '.SUPABASE_URL // ""')
USER_SUPABASE_SERVICE=$(echo $USER_SECRET | jq -r '.SUPABASE_SERVICE_ROLE_KEY // ""')
USER_REDIS_URL=$(echo $USER_SECRET | jq -r '.PD_Bookings_Cache_REDIS_URL // ""')
USER_CRON_SECRET=$(echo $USER_SECRET | jq -r '.CRON_SECRET // ""')

# -----------------------------------------------------------------------------
# 2. Write admin backend .env
# -----------------------------------------------------------------------------
cat > ${APP_DIR}/admin_root/.env << ENVEOF
NODE_ENV=production
PORT=5000

# Database (AWS RDS)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@prepdoc-db-production.cpaeeycwemvb.ca-central-1.rds.amazonaws.com:5432/prepdocrhaws?sslmode=require
DATABASE_SCHEMA=hubspot_sync

# HubSpot
HS_PRIVATE_APP_TOKEN=${HS_TOKEN}
HUBSPOT_PORTAL_ID=${HS_PORTAL}

# Supabase
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE}

# Redis
PD_Bookings_Cache_REDIS_URL=${REDIS_URL}
CACHE_ENABLED=true

# Auth & Security
CRON_SECRET=${CRON_SECRET_VAL}

# Supabase Webhooks
SHAKY_MOCKS_KEY=${SHAKY_KEY}
SUPABASE_EDGE_FUNCTION_URL=${EDGE_FUNC_URL}

# AWS
AWS_REGION=ca-central-1

# HubSpot Object Type IDs
CONTACTS_OBJECT_ID=0-1
DEALS_OBJECT_ID=0-3
COURSES_OBJECT_ID=0-410
TRANSACTIONS_OBJECT_ID=2-47045790
PAYMENT_SCHEDULES_OBJECT_ID=2-47381547
CREDIT_NOTES_OBJECT_ID=2-41609496
CAMPUS_VENUES_OBJECT_ID=2-41607847
ENROLLMENTS_OBJECT_ID=2-41701559
LAB_STATIONS_OBJECT_ID=2-41603799
BOOKINGS_OBJECT_ID=2-50158943
MOCK_EXAMS_OBJECT_ID=2-50158913
ENVEOF

echo "  Written: admin_root/.env"

# -----------------------------------------------------------------------------
# 3. Write admin frontend .env
# -----------------------------------------------------------------------------
cat > ${APP_DIR}/admin_root/admin_frontend/.env << ENVEOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON}
NODE_ENV=production
ENVEOF

echo "  Written: admin_root/admin_frontend/.env"

# -----------------------------------------------------------------------------
# 4. Write user backend .env
# -----------------------------------------------------------------------------
cat > ${APP_DIR}/user_root/.env << ENVEOF
NODE_ENV=production
PORT=3000

# Database (AWS RDS)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@prepdoc-db-production.cpaeeycwemvb.ca-central-1.rds.amazonaws.com:5432/prepdocrhaws?sslmode=require
DATABASE_SCHEMA=hubspot_sync

# HubSpot
HS_PRIVATE_APP_TOKEN=${USER_HS_TOKEN}

# Supabase
SUPABASE_URL=${USER_SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${USER_SUPABASE_SERVICE}

# Redis
PD_Bookings_Cache_REDIS_URL=${USER_REDIS_URL}
CACHE_ENABLED=true

# Auth & Security
CRON_SECRET=${USER_CRON_SECRET}

# AWS
AWS_REGION=ca-central-1
ENVEOF

echo "  Written: user_root/.env"

# -----------------------------------------------------------------------------
# 5. Write user frontend .env
# -----------------------------------------------------------------------------
cat > ${APP_DIR}/user_root/frontend/.env << ENVEOF
VITE_API_URL=/api
NODE_ENV=production
ENVEOF

echo "  Written: user_root/frontend/.env"

# -----------------------------------------------------------------------------
# 6. Set ownership and permissions
# -----------------------------------------------------------------------------
chown appuser:appuser ${APP_DIR}/admin_root/.env
chown appuser:appuser ${APP_DIR}/admin_root/admin_frontend/.env
chown appuser:appuser ${APP_DIR}/user_root/.env
chown appuser:appuser ${APP_DIR}/user_root/frontend/.env
chmod 600 ${APP_DIR}/admin_root/.env
chmod 600 ${APP_DIR}/admin_root/admin_frontend/.env
chmod 600 ${APP_DIR}/user_root/.env
chmod 600 ${APP_DIR}/user_root/frontend/.env

echo "=== .env files restored successfully ==="
