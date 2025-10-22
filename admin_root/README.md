# Admin Dashboard - Mock Booking System

## Overview

This is the admin dashboard for the PrepDoctors Mock Booking System. It provides administrative capabilities for managing users, mock exams, credits, and system monitoring.

## Features

- **User Management**: View, edit, and manage student accounts
- **Mock Exam Management**: Create, update, and manage mock exam sessions
- **Credit Management**: Adjust user credits and tokens
- **Reporting**: Generate reports on bookings, capacity, and usage
- **Audit Logging**: Track all admin actions for compliance

## Tech Stack

- **Backend**: Node.js serverless functions on Vercel
- **Frontend**: React 18 + Vite (to be implemented)
- **Authentication**: JWT with admin-specific validation
- **Data Store**: HubSpot CRM (same as user app)
- **Caching**: Redis (shared infrastructure)

## Project Structure

```
admin_root/
├── api/                          # Admin API endpoints (Vercel serverless functions)
│   ├── _shared/                 # Shared services (copied from user)
│   │   ├── hubspot.js          # HubSpot integration
│   │   ├── redis.js            # Redis caching
│   │   ├── cache.js            # Cache utilities
│   │   ├── validation.js       # Joi schemas
│   │   ├── auth.js             # Basic auth (from user)
│   │   ├── batch.js            # Batch operations
│   │   ├── admin-auth.js       # Admin-specific auth
│   │   └── audit-log.js        # Audit logging
│   ├── users/                   # User management endpoints
│   │   ├── list.js             # List users
│   │   ├── [id].js             # Get/update user
│   │   └── create.js           # Create user
│   ├── mock-exams/             # Mock exam management
│   │   ├── create.js           # Create exam session
│   │   ├── [id].js             # Update/delete exam
│   │   └── bulk-update.js      # Bulk operations
│   ├── credits/                # Credit management
│   │   ├── adjust.js           # Adjust user credits
│   │   └── bulk-adjust.js      # Bulk credit operations
│   ├── reports/                # Reporting endpoints
│   │   ├── bookings.js         # Booking reports
│   │   └── capacity.js         # Capacity reports
│   └── health.js              # Health check
├── admin_frontend/             # React admin dashboard
│   └── (to be implemented)
├── vercel.json                # Vercel configuration
├── package.json               # Dependencies
└── README.md                  # This file
```

## API Endpoints

### Authentication
All endpoints require admin JWT token in Authorization header:
```
Authorization: Bearer <admin-jwt-token>
```

### User Management
- `GET /api/users` - List users with filtering and pagination
- `GET /api/users/:id` - Get specific user details
- `PATCH /api/users/:id` - Update user information
- `POST /api/users` - Create new user

### Mock Exam Management
- `GET /api/mock-exams` - List exam sessions
- `POST /api/mock-exams` - Create new exam session
- `PATCH /api/mock-exams/:id` - Update exam session
- `DELETE /api/mock-exams/:id` - Delete exam session
- `PATCH /api/mock-exams/bulk` - Bulk update operations

### Credit Management
- `POST /api/credits/adjust` - Adjust user credits
- `POST /api/credits/bulk-adjust` - Bulk credit adjustments

### Reports
- `GET /api/reports/bookings` - Booking analytics
- `GET /api/reports/capacity` - Capacity utilization

### System
- `GET /api/health` - Health check with dependency status

## Environment Variables

```bash
# HubSpot Configuration (shared with user app)
HS_PRIVATE_APP_TOKEN=<hubspot-token>

# Redis Configuration (shared with user app)
REDIS_URL=<redis-connection-string>

# Admin-Specific Configuration
ADMIN_JWT_SECRET=<strong-secret-key>
ADMIN_SESSION_TIMEOUT=3600
ADMIN_MODE=true

# CORS Configuration
CORS_ORIGIN=https://admin-mocksbooking.vercel.app

# Optional: Audit Log Storage
HUBSPOT_AUDIT_LOG_OBJECT_ID=<custom-object-id>
```

## Security Features

### Authentication
- JWT-based authentication with admin-specific secret
- Role-based access control (admin, super_admin)
- Permission-based authorization
- Session timeout enforcement

### Rate Limiting
- 100 requests per 15 minutes per admin
- Configurable limits per endpoint

### Audit Logging
- All admin actions logged
- IP address tracking
- User agent recording
- Success/failure tracking
- HubSpot timeline integration

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run API locally
npm run dev:api

# Run frontend (when implemented)
npm run dev

# Run tests
npm test
```

### Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy
```

## Permissions

### Admin Roles

**Admin**
- users:read
- users:update
- mock-exams:read
- mock-exams:update
- credits:adjust
- reports:view

**Super Admin**
- All admin permissions
- users:create
- users:delete
- mock-exams:delete
- credits:bulk-adjust
- audit:export

## Code Synchronization

This project contains copies of shared services from the user project. When updating shared services:

1. Update in the primary project (user or admin)
2. Test thoroughly
3. Copy to other project if applicable
4. Document in SERVICE_SYNC_LOG.md

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific endpoint
npm test -- users/list.test.js
```

## Monitoring

### Health Check
```bash
curl https://admin-mocksbooking.vercel.app/api/health
```

### Logs
```bash
vercel logs --prod
```

### Audit Trail
All admin actions are logged to:
1. Console output (vercel logs)
2. HubSpot deal timelines (if dealId present)
3. HubSpot custom object (if configured)

## Support

For issues or questions:
- Check user_root/README.md for shared service documentation
- Review audit logs for action history
- Contact system administrator

## License

Private - PrepDoctors Internal Use Only

---

**Version**: 1.0.0
**Last Updated**: October 22, 2025
**Status**: Structure Ready, Frontend Pending