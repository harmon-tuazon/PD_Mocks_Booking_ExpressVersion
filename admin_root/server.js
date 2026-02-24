/**
 * Express Wrapper for Admin Root
 *
 * Thin wrapper that maps Vercel serverless function files to Express routes.
 * No handler files are modified — this just wires them up to an Express server.
 *
 * Handlers are loaded LAZILY on first request (matching Vercel behavior)
 * to avoid top-level initialization crashes at startup.
 *
 * Usage: node server.js
 * Port: process.env.PORT || 3000
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a lazy-loading handler wrapper.
 * The handler file is require()'d on first request, not at startup.
 * This matches Vercel's behavior where each function is loaded on-demand.
 */
function lazyHandler(filePath, isDynamic = false) {
  let handler = null;

  return async (req, res) => {
    // Lazy load on first request
    if (!handler) {
      try {
        const mod = require(filePath);
        handler = mod.default || mod;
      } catch (err) {
        console.error(`Failed to load handler: ${filePath}`, err.message);
        return res.status(500).json({
          error: 'HANDLER_LOAD_ERROR',
          message: `Failed to load ${filePath}: ${err.message}`
        });
      }
    }

    // Bridge dynamic route params: copy req.params → req.query
    if (isDynamic) {
      Object.assign(req.query, req.params);
    }

    return handler(req, res);
  };
}

/**
 * Register a route. Uses app.all() since handlers check req.method internally.
 */
function route(urlPath, filePath, isDynamic = false) {
  app.all(urlPath, lazyHandler(filePath, isDynamic));
}

// ---------------------------------------------------------------------------
// API Routes — Static (registered FIRST to avoid :id collisions)
// ---------------------------------------------------------------------------

// Health
route('/api/health', './api/health');

// Bookings
route('/api/bookings/batch-cancel', './api/bookings/batch-cancel');
route('/api/bookings/rebook', './api/bookings/rebook');

// Admin > Auth
route('/api/admin/auth/login', './api/admin/auth/login');
route('/api/admin/auth/logout', './api/admin/auth/logout');
route('/api/admin/auth/me', './api/admin/auth/me');
route('/api/admin/auth/refresh', './api/admin/auth/refresh');
route('/api/admin/auth/request-otp', './api/admin/auth/request-otp');
route('/api/admin/auth/update-password', './api/admin/auth/update-password');
route('/api/admin/auth/validate', './api/admin/auth/validate');
route('/api/admin/auth/verify-otp', './api/admin/auth/verify-otp');

// Admin > Bookings
route('/api/admin/bookings/bulk-create', './api/admin/bookings/bulk-create');
route('/api/admin/bookings/create', './api/admin/bookings/create');

// Admin > Cron
route('/api/admin/cron/activate-scheduled-exams', './api/admin/cron/activate-scheduled-exams');
route('/api/admin/cron/sync-bookings-from-supabase', './api/admin/cron/sync-bookings-from-supabase');
route('/api/admin/cron/sync-exams-backfill-bookings-from-hubspot', './api/admin/cron/sync-exams-backfill-bookings-from-hubspot');

// Admin > Mock Exams (static routes BEFORE dynamic :id routes)
route('/api/admin/mock-exams/aggregates', './api/admin/mock-exams/aggregates');
route('/api/admin/mock-exams/available-for-rebook', './api/admin/mock-exams/available-for-rebook');
route('/api/admin/mock-exams/batch-delete', './api/admin/mock-exams/batch-delete');
route('/api/admin/mock-exams/bulk-create', './api/admin/mock-exams/bulk-create');
route('/api/admin/mock-exams/bulk-create-csv', './api/admin/mock-exams/bulk-create-csv');
route('/api/admin/mock-exams/bulk-toggle-status', './api/admin/mock-exams/bulk-toggle-status');
route('/api/admin/mock-exams/bulk-update', './api/admin/mock-exams/bulk-update');
route('/api/admin/mock-exams/clone', './api/admin/mock-exams/clone');
route('/api/admin/mock-exams/create', './api/admin/mock-exams/create');
route('/api/admin/mock-exams/delete', './api/admin/mock-exams/delete');
route('/api/admin/mock-exams/export-csv', './api/admin/mock-exams/export-csv');
route('/api/admin/mock-exams/get', './api/admin/mock-exams/get');
route('/api/admin/mock-exams/list', './api/admin/mock-exams/list');
route('/api/admin/mock-exams/metrics', './api/admin/mock-exams/metrics');
route('/api/admin/mock-exams/update', './api/admin/mock-exams/update');

// Admin > Sync
route('/api/admin/sync/force-supabase', './api/admin/sync/force-supabase');

// Admin > Trainees (static routes BEFORE dynamic :contactId routes)
route('/api/admin/trainees/search', './api/admin/trainees/search');
route('/api/admin/trainees/test-endpoints', './api/admin/trainees/test-endpoints');

// ---------------------------------------------------------------------------
// API Routes — Dynamic (registered AFTER static to prevent collisions)
// ---------------------------------------------------------------------------

// Admin > Mock Exams > Aggregates (dynamic)
route('/api/admin/mock-exams/aggregates/:key/sessions', './api/admin/mock-exams/aggregates/[key]/sessions', true);

// Admin > Mock Exams > [id] sub-routes (specific paths BEFORE the catch-all :id)
route('/api/admin/mock-exams/:id/attendance', './api/admin/mock-exams/[id]/attendance', true);
route('/api/admin/mock-exams/:id/bookings', './api/admin/mock-exams/[id]/bookings', true);
route('/api/admin/mock-exams/:id/cancel-bookings', './api/admin/mock-exams/[id]/cancel-bookings', true);
route('/api/admin/mock-exams/:id/prerequisites/delta', './api/admin/mock-exams/[id]/prerequisites/delta', true);
route('/api/admin/mock-exams/:id/prerequisites/:prerequisiteId', './api/admin/mock-exams/[id]/prerequisites/[prerequisiteId]', true);
route('/api/admin/mock-exams/:id/prerequisites', './api/admin/mock-exams/[id]/prerequisites/index', true);

// Admin > Mock Exams > [id] (catch-all for GET/PATCH single exam)
route('/api/admin/mock-exams/:id', './api/admin/mock-exams/[id]', true);

// Admin > Trainees > [contactId]
route('/api/admin/trainees/:contactId/bookings', './api/admin/trainees/[contactId]/bookings', true);
route('/api/admin/trainees/:contactId/tokens', './api/admin/trainees/[contactId]/tokens', true);

// ---------------------------------------------------------------------------
// Static file serving (SPA)
// ---------------------------------------------------------------------------
const distPath = path.join(__dirname, 'admin_frontend', 'dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for non-API routes (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Admin server listening on port ${PORT}`);
  console.log(`  API:      http://localhost:${PORT}/api/health`);
  console.log(`  Frontend: http://localhost:${PORT}/`);
});
