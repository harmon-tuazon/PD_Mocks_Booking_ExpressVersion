const router = require('express').Router();

router.use('/bookings', require('./bookings.routes'));
router.use('/mock-exams', require('./mockExams.routes'));
router.use('/mock-discussions', require('./mockDiscussions.routes'));
router.use('/user', require('./user.routes'));

module.exports = router;
