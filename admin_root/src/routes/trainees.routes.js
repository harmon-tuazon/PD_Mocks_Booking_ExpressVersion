const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { search } = require('../controllers/trainees/search');
const { getBookings } = require('../controllers/trainees/getBookings');
const { updateTokens } = require('../controllers/trainees/updateTokens');

router.use(requireAdmin);

router.get('/search', search);
router.get('/:contactId/bookings', getBookings);
router.patch('/:contactId/tokens', updateTokens);

module.exports = router;
