const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const { available } = require('../controllers/mockDiscussions/available');
const { createBooking } = require('../controllers/mockDiscussions/createBooking');
const { validateCredits } = require('../controllers/mockDiscussions/validateCredits');

// Public route
router.get('/available', available);

// Protected routes
router.use(authenticate);

router.post('/validate-credits',
  validateBody(schemas.creditValidation),
  validateCredits
);

router.post('/create-booking',
  validateBody(schemas.bookingCreation),
  createBooking
);

module.exports = router;
