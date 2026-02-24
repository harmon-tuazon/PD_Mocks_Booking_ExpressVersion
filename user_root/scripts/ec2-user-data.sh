#!/bin/bash
# =============================================================================
# EC2 User Data — paste this into your Launch Template
#
# Runs automatically on EVERY new instance boot (first boot + auto-scaling).
# Installs Node.js, clones the repo, builds the app, and starts PM2.
#
# All output is logged to /var/log/user-data.log for debugging.
# =============================================================================

exec > /var/log/user-data.log 2>&1
set -e

echo "=== EC2 User Data Start: $(date) ==="

# -----------------------------------------------------------------------------
# CONFIGURATION — update these for your environment
# -----------------------------------------------------------------------------
APP_USER="ec2-user"
APP_DIR="/home/${APP_USER}/user_root"
REPO_URL="https://github.com/your-org/your-repo.git"  # TODO: update this
REPO_BRANCH="main"
NODE_VERSION="18"

# Environment variables — in production, pull from AWS Secrets Manager or
# Parameter Store instead of hardcoding. Example using Parameter Store:
#   SUPABASE_URL=$(aws ssm get-parameter --name "/user-app/SUPABASE_URL" --with-decryption --query "Parameter.Value" --output text)
#
# For now, set these in the Launch Template environment or use an .env file
# stored in S3:
#   aws s3 cp s3://your-bucket/user-app/.env /home/ec2-user/user_root/.env

# -----------------------------------------------------------------------------
# 1. Install Node.js (skip if already installed via AMI)
# -----------------------------------------------------------------------------
if ! command -v node &> /dev/null; then
  echo "Installing Node.js ${NODE_VERSION}..."
  curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
  yum install -y nodejs
fi
echo "Node: $(node -v), npm: $(npm -v)"

# -----------------------------------------------------------------------------
# 2. Install Git (Amazon Linux 2023 may already have it)
# -----------------------------------------------------------------------------
if ! command -v git &> /dev/null; then
  echo "Installing Git..."
  yum install -y git
fi

# -----------------------------------------------------------------------------
# 3. Install PM2 globally
# -----------------------------------------------------------------------------
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi
echo "PM2: $(pm2 -v)"

# -----------------------------------------------------------------------------
# 4. Clone or pull the repo
# -----------------------------------------------------------------------------
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo exists, pulling latest..."
  cd "$APP_DIR"
  sudo -u "$APP_USER" git fetch origin
  sudo -u "$APP_USER" git checkout "$REPO_BRANCH"
  sudo -u "$APP_USER" git pull origin "$REPO_BRANCH"
else
  echo "Cloning repo..."
  sudo -u "$APP_USER" git clone -b "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# -----------------------------------------------------------------------------
# 5. Pull .env from S3 (if using S3 for secrets)
# -----------------------------------------------------------------------------
# Uncomment and update the bucket path:
# aws s3 cp s3://your-bucket/user-app/.env "$APP_DIR/.env"
# chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
# chmod 600 "$APP_DIR/.env"

# -----------------------------------------------------------------------------
# 6. Run the PM2 setup script (installs deps, builds, starts app)
# -----------------------------------------------------------------------------
echo "Running PM2 setup..."
chmod +x "$APP_DIR/scripts/setup-pm2.sh"
sudo -u "$APP_USER" bash "$APP_DIR/scripts/setup-pm2.sh"

# -----------------------------------------------------------------------------
# 7. Verify health
# -----------------------------------------------------------------------------
echo "Waiting for app to start..."
sleep 5

RETRIES=10
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "Health check passed on attempt $i"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "ERROR: Health check failed after $RETRIES attempts"
    pm2 logs user-app --lines 50 --nostream
    exit 1
  fi
  echo "Health check attempt $i failed, retrying in 3s..."
  sleep 3
done

echo "=== EC2 User Data Complete: $(date) ==="
