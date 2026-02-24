const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { create } = require('../controllers/bookings/create');
const { bulkCreate } = require('../controllers/bookings/bulkCreate');

router.use(requireAdmin);

router.post('/create', create);
router.post('/bulk-create', bulkCreate);

module.exports = router;
