const router = require('express').Router();

router.use('/admin/auth', require('./auth.routes'));
router.use('/admin/mock-exams', require('./mockExams.routes'));
router.use('/admin/bookings', require('./bookings.routes'));
router.use('/admin/trainees', require('./trainees.routes'));
router.use('/admin/sync', require('./sync.routes'));
router.use('/bookings', require('./publicBookings.routes'));

module.exports = router;
