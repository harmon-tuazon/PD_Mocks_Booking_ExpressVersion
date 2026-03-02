#!/bin/bash
# =============================================================================
# EC2 User Data — Admin App (admin_root)
#
# Paste this into your Launch Template (or append to existing user data).
# Assumes the app is pre-baked into the AMI at /home/appuser/app/admin_root/
#
# Fetches secrets from AWS Secrets Manager, writes .env, starts PM2.
# All output is logged to /var/log/user-data.log for debugging.
# =============================================================================

exec > >(tee /var/log/user-data-admin.log|logger -t user-data-admin -s 2>/dev/console) 2>&1

EXIT_CODE=0
trap 'EXIT_CODE=1' ERR
trap '/opt/aws/bin/cfn-signal -e $EXIT_CODE --stack prepdoc-asg-production --resource AutoScalingGroup --region ca-central-1 || true' EXIT

dnf install -y aws-cfn-bootstrap || pip3 install aws-cfn-bootstrap || true

echo "=== PrepDoctors Admin App Boot - $(date) ==="

# -----------------------------------------------------------------------------
# 1. Fetch secrets from AWS Secrets Manager
# -----------------------------------------------------------------------------

# Database credentials
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsApp/DatabaseProduction/Postgres \
  --query SecretString --output text \
  --region ca-central-1 2>/dev/null || echo '{}')

DB_USER=$(echo $DB_SECRET | jq -r '.username // "postgres"')
DB_PASS=$(echo $DB_SECRET | jq -r '.password // ""')

# Admin-specific secrets (HubSpot, Supabase, CRON, etc.)
# TODO: Create this secret in Secrets Manager with keys:
#   HS_PRIVATE_APP_TOKEN, HUBSPOT_PORTAL_ID, SUPABASE_URL, SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, PD_Bookings_Cache_REDIS_URL,
#   SHAKY_MOCKS_KEY, SUPABASE_EDGE_FUNCTION_URL
ADMIN_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id PrepDoctorsApp/AdminApp/Secret \
  --query SecretString --output text \
  --region ca-central-1 2>/dev/null || echo '{}')

HS_TOKEN=$(echo $ADMIN_SECRET | jq -r '.HS_PRIVATE_APP_TOKEN // ""')
HS_PORTAL=$(echo $ADMIN_SECRET | jq -r '.HUBSPOT_PORTAL_ID // ""')
SUPABASE_URL=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_URL // ""')
SUPABASE_ANON=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_ANON_KEY // ""')
SUPABASE_SERVICE=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_SERVICE_ROLE_KEY // ""')
CRON_SECRET_VAL=$(echo $ADMIN_SECRET | jq -r '.CRON_SECRET // ""')
REDIS_URL=$(echo $ADMIN_SECRET | jq -r '.PD_Bookings_Cache_REDIS_URL // ""')
SHAKY_KEY=$(echo $ADMIN_SECRET | jq -r '.SHAKY_MOCKS_KEY // ""')
EDGE_FUNC_URL=$(echo $ADMIN_SECRET | jq -r '.SUPABASE_EDGE_FUNCTION_URL // ""')

# -----------------------------------------------------------------------------
# 2. Write backend .env
# -----------------------------------------------------------------------------
APP_DIR="/home/appuser/app/admin_root"

cat > ${APP_DIR}/.env << ENVEOF
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

# -----------------------------------------------------------------------------
# 3. Write admin frontend .env
# -----------------------------------------------------------------------------
cat > ${APP_DIR}/admin_frontend/.env << ENVEOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON}
NODE_ENV=production
ENVEOF

chown appuser:appuser ${APP_DIR}/.env
chown appuser:appuser ${APP_DIR}/admin_frontend/.env
chmod 600 ${APP_DIR}/.env
chmod 600 ${APP_DIR}/admin_frontend/.env

# -----------------------------------------------------------------------------
# 4. Install dependencies and build frontend
# -----------------------------------------------------------------------------
cd ${APP_DIR}
sudo -u appuser npm ci --omit=dev
mkdir -p ${APP_DIR}/logs

cd ${APP_DIR}/admin_frontend
sudo -u appuser npm ci
sudo -u appuser npm run build

# -----------------------------------------------------------------------------
# 5. Start PM2 process
# -----------------------------------------------------------------------------
sudo -u appuser pm2 delete admin-app 2>/dev/null || true

cd ${APP_DIR}
sudo -u appuser pm2 start ecosystem.config.js --only admin-app

sudo -u appuser pm2 save

# PM2 boot persistence
env PATH=$PATH:/usr/bin pm2 startup systemd -u appuser --hp /home/appuser
systemctl enable pm2-appuser

# -----------------------------------------------------------------------------
# 6. Health check
# -----------------------------------------------------------------------------
echo "Waiting for admin app to start..."
sleep 5

RETRIES=10
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:5000/api/health > /dev/null; then
    echo "Admin health check passed on attempt $i"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "ERROR: Admin health check failed after $RETRIES attempts"
    sudo -u appuser pm2 logs admin-app --lines 50 --nostream
    EXIT_CODE=1
  fi
  echo "Admin health check attempt $i failed, retrying in 3s..."
  sleep 3
done

echo "=== PrepDoctors Admin App Boot Complete - $(date) ==="
