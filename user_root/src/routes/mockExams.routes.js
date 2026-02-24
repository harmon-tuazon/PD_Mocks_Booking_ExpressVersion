const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const { available } = require('../controllers/mockExams/available');
const { validateCredits } = require('../controllers/mockExams/validateCredits');
const { capacity } = require('../controllers/mockExams/capacity');

// Public route - available exams
router.get('/available', available);

// Protected routes
router.use(authenticate);

router.post('/validate-credits',
  validateBody(schemas.creditValidation),
  validateCredits
);

router.get('/:id/capacity', capacity);

module.exports = router;
