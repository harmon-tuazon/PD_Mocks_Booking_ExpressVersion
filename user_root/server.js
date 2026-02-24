/**
 * Express Wrapper for User Root
 *
 * Thin wrapper that maps Vercel serverless function files to Express routes.
 * No handler files are modified — this just wires them up to an Express server.
 *
 * Handlers are loaded LAZILY on first request (matching Vercel behavior)
 * to avoid top-level initialization crashes at startup.
 *
 * Usage: node server.js
 * Port: process.env.PORT || 3001
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Bookings (static before dynamic :id)
route('/api/bookings/create', './api/bookings/create');
route('/api/bookings/list', './api/bookings/list');

// Mock Exams (static before dynamic :id)
route('/api/mock-exams/available', './api/mock-exams/available');
route('/api/mock-exams/validate-credits', './api/mock-exams/validate-credits');

// Mock Discussions
route('/api/mock-discussions/available', './api/mock-discussions/available');
route('/api/mock-discussions/create-booking', './api/mock-discussions/create-booking');
route('/api/mock-discussions/validate-credits', './api/mock-discussions/validate-credits');

// User
route('/api/user/login', './api/user/login');
route('/api/user/update-ndecc-date', './api/user/update-ndecc-date');

// ---------------------------------------------------------------------------
// API Routes — Dynamic (registered AFTER static)
// ---------------------------------------------------------------------------

// Mock Exams > [id] sub-routes (specific paths BEFORE catch-all)
route('/api/mock-exams/:id/capacity', './api/mock-exams/[id]/capacity', true);

// Bookings > [id] (GET detail, DELETE cancel)
route('/api/bookings/:id', './api/bookings/[id]', true);

// ---------------------------------------------------------------------------
// Static file serving (SPA)
// ---------------------------------------------------------------------------
const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for non-API routes (Express 5 syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`User server listening on port ${PORT}`);
  console.log(`  API:      http://localhost:${PORT}/api/health`);
  console.log(`  Frontend: http://localhost:${PORT}/`);
});
