#!/bin/bash
# =============================================================================
# PM2 Setup Script for user-app
# Run this on any new EC2 instance to configure PM2 identically.
#
# Usage:
#   chmod +x scripts/setup-pm2.sh
#   ./scripts/setup-pm2.sh
#
# This script is idempotent — safe to run multiple times.
# =============================================================================

set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="user-app"

echo "=== PM2 Setup for $APP_NAME ==="
echo "App directory: $APP_DIR"

# 1. Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
else
  echo "PM2 already installed: $(pm2 -v)"
fi

# 2. Install pm2-logrotate if not present
if ! pm2 describe pm2-logrotate &> /dev/null 2>&1; then
  echo "Installing pm2-logrotate..."
  pm2 install pm2-logrotate

  # Configure log rotation
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 10
  pm2 set pm2-logrotate:compress true
  pm2 set pm2-logrotate:workerInterval 30
  echo "pm2-logrotate configured"
else
  echo "pm2-logrotate already installed"
fi

# 3. Create logs directory
mkdir -p "$APP_DIR/logs"

# 4. Install app dependencies
echo "Installing dependencies..."
cd "$APP_DIR"
npm ci --only=production

# 5. Build frontend
echo "Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npm run build
cd "$APP_DIR"

# 6. Stop existing app if running
pm2 delete "$APP_NAME" 2>/dev/null || true

# 7. Start app with ecosystem config
echo "Starting $APP_NAME..."
pm2 start "$APP_DIR/ecosystem.config.js"

# 8. Configure PM2 to start on boot
echo "Configuring boot persistence..."
pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || pm2 startup
pm2 save

echo ""
echo "=== Setup Complete ==="
pm2 status
