const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { batchCancel } = require('../controllers/publicBookings/batchCancel');
const { rebook } = require('../controllers/publicBookings/rebook');

router.use(requireAdmin);

router.post('/batch-cancel', batchCancel);
router.patch('/rebook', rebook);

module.exports = router;
