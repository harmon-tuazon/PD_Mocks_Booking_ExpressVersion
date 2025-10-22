# Vercel Configuration Audit Report

**Date**: October 22, 2025
**Purpose**: Verify Vercel configurations for GitHub-connected monorepo
**Status**: ⚠️ **Issues Found - Action Required**

## 📊 Current Configuration Analysis

### Root Directory Settings (Vercel Dashboard)
- **User Project**: Root directory set to `user_root` ✅ (Correct)
- **Admin Project**: Root directory will be set to `admin_root` ✅ (Correct)

### Configuration Files Found

1. **Root `.vercel/project.json`**
   - Location: `/.vercel/project.json`
   - Project ID: `prj_vNCwad25abdgzfHIjAhTWuDcZpHi`
   - **Status**: ❌ **Should be removed** (old structure)

2. **User Frontend `.vercel/project.json`**
   - Location: `/user_root/frontend/.vercel/project.json`
   - Project ID: `prj_vNCwad25abdgzfHIjAhTWuDcZpHi` (same as root)
   - **Status**: ❌ **Should be removed** (conflicts with root)

3. **User `vercel.json`**
   - Location: `/user_root/vercel.json`
   - **Status**: ✅ **Correct** (paths are relative to user_root)

4. **Admin `vercel.json`**
   - Location: `/admin_root/vercel.json`
   - **Status**: ⚠️ **Needs Fix** (references non-existent admin_frontend)

## 🚨 Issues Found

### Issue 1: Conflicting `.vercel` Folders
**Problem**: Multiple `.vercel` folders with same project ID
- Root `.vercel/` - From old structure
- `user_root/frontend/.vercel/` - From frontend deployment

**Impact**: May cause deployment confusion and conflicts

**Solution**: Remove both folders, let Vercel recreate when linking

### Issue 2: Admin Build Command Error
**Problem**: `admin_root/vercel.json` references `admin_frontend` directory that doesn't exist
```json
"buildCommand": "cd admin_frontend && npm install && npm run build"
```

**Impact**: Admin deployment will fail

**Solution**: Update to match actual structure or create placeholder

### Issue 3: Path Configurations
**Review of Paths**:

#### User Project (`user_root/vercel.json`) ✅
```json
{
  "buildCommand": "npm run build",  // ✅ Calls package.json script
  "outputDirectory": "frontend/dist", // ✅ Relative to user_root
  "functions": {
    "api/**/*.js": { // ✅ Matches user_root/api/
      "maxDuration": 60
    }
  }
}
```

#### Admin Project (`admin_root/vercel.json`) ⚠️
```json
{
  "buildCommand": "cd admin_frontend && ...", // ❌ admin_frontend doesn't exist
  "outputDirectory": "admin_frontend/dist",   // ❌ admin_frontend doesn't exist
  "functions": {
    "admin_api/**/*.js": { // ✅ Matches admin_root/admin_api/
      "maxDuration": 60
    }
  }
}
```

## ✅ Recommended Fixes

### Fix 1: Remove Conflicting `.vercel` Folders
```bash
# Remove old .vercel folders
rm -rf .vercel
rm -rf user_root/frontend/.vercel

# These will be recreated when you run 'vercel link' in each project
```

### Fix 2: Update Admin vercel.json
Since admin frontend doesn't exist yet, update for API-only deployment:
```json
{
  "name": "mocks_booking_admin",
  "buildCommand": "echo 'No frontend build needed'",
  "outputDirectory": "public",
  "functions": {
    "admin_api/**/*.js": {
      "maxDuration": 60
    }
  },
  // ... rest of config
}
```

### Fix 3: Create Placeholder for Admin
```bash
# Create minimal public directory for admin
mkdir -p admin_root/public
echo "<h1>Admin Dashboard - Coming Soon</h1>" > admin_root/public/index.html
```

## 📋 Deployment Checklist

### For User Project
1. ✅ Root directory in Vercel: `user_root`
2. ✅ Build command: `npm run build`
3. ✅ Output directory: `frontend/dist`
4. ✅ Functions: `api/**/*.js`

### For Admin Project
1. ⚠️ Root directory in Vercel: `admin_root` (needs setup)
2. ❌ Build command: Needs fix
3. ❌ Output directory: Needs fix
4. ✅ Functions: `admin_api/**/*.js`

## 🔧 Action Items

### Immediate Actions
```bash
# 1. Clean up .vercel folders
rm -rf .vercel
rm -rf user_root/frontend/.vercel

# 2. Fix admin build config (choose one):

# Option A: API-only deployment
cat > admin_root/vercel.json << 'EOF'
{
  "name": "mocks_booking_admin",
  "buildCommand": "echo 'API-only deployment'",
  "outputDirectory": "public",
  "functions": {
    "admin_api/**/*.js": {
      "maxDuration": 60
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/admin_api/$1"
    }
  ],
  "env": {
    "ADMIN_MODE": "true"
  }
}
EOF

# Option B: Create placeholder
mkdir -p admin_root/public
echo "<!DOCTYPE html><html><body><h1>Admin Dashboard - Coming Soon</h1></body></html>" > admin_root/public/index.html
```

### Deployment Steps

#### User Project
```bash
cd user_root
vercel link  # Will create new .vercel folder
# Select: Link to existing project
# Choose: mocks_booking

vercel       # Deploy to staging
vercel --prod # Deploy to production
```

#### Admin Project (After fixes)
```bash
cd admin_root
vercel link  # Will create new .vercel folder
# Select: Set up and deploy new project
# Name: mocks_booking_admin

vercel       # Deploy to staging
```

## ⚠️ Important Notes

1. **GitHub Integration**: Since projects are connected to GitHub monorepo:
   - Each push to main will trigger deployment
   - Vercel uses root directory setting (`user_root` or `admin_root`)
   - No need for `.vercel` folders in git (add to .gitignore)

2. **Project Isolation**: Each project should:
   - Have its own Vercel project ID
   - Deploy independently
   - Not share `.vercel` folders

3. **Build Commands**: Must be relative to project root:
   - User: Commands run from `user_root/`
   - Admin: Commands run from `admin_root/`

## 📊 Summary

**Critical Issues**:
- 🔴 Conflicting `.vercel` folders need removal
- 🟡 Admin build configuration needs update

**After fixes**:
- User project: Ready to deploy ✅
- Admin project: Ready for API deployment (frontend pending)