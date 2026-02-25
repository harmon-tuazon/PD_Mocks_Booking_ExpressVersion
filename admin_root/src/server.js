require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { initScheduler } = require('./jobs/scheduler');

const app = express();

// Security middleware (CSP disabled for React SPA compatibility)
app.use(helmet({ contentSecurityPolicy: false }));

// Global rate limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: { message: 'Too many requests' } }
});
app.use(limiter);

// Request parsing & compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check (before routes for reliability)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-api'
  });
});

// API Routes
app.use('/api', routes);

// Serve frontend static files (built Vite output)
app.use(express.static(path.join(__dirname, '../admin_frontend/dist')));

// SPA fallback - all non-API routes serve index.html for client-side routing
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin_frontend/dist/index.html'));
});

// Error handler (must be last middleware)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`Admin app running on port ${PORT} (API + Frontend)`);
      initScheduler();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

module.exports = app;
