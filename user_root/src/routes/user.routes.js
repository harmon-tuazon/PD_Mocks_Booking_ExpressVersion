const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const { login } = require('../controllers/user/login');
const { updateNdeccDate } = require('../controllers/user/updateNdeccDate');

// Login - public
router.post('/login', login);

// Protected routes
router.use(authenticate);

router.put('/update-ndecc-date',
  validateBody(schemas.updateNdeccDate),
  updateNdeccDate
);

module.exports = router;
