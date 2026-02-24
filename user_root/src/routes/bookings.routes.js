const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const { create } = require('../controllers/bookings/create');
const { list } = require('../controllers/bookings/list');
const { getById } = require('../controllers/bookings/getById');
const { cancel } = require('../controllers/bookings/cancel');

// All booking routes require authentication
router.use(authenticate);

// Create booking - most critical endpoint
router.post('/create',
  validateBody(schemas.bookingCreation),
  create
);

// List user's bookings
router.get('/list', list);

// Get booking by ID
router.get('/:id', getById);

// Cancel booking
router.delete('/:id', cancel);

module.exports = router;
