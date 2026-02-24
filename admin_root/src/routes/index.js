const router = require('express').Router();

router.use('/admin/auth', require('./auth.routes'));
router.use('/admin/mock-exams', require('./mockExams.routes'));
router.use('/admin/bookings', require('./bookings.routes'));
router.use('/admin/trainees', require('./trainees.routes'));
router.use('/admin/work-check-slots', require('./workCheckSlots.routes'));
router.use('/admin/work-check-bookings', require('./workCheckBookings.routes'));
router.use('/admin/instructors', require('./instructors.routes'));
router.use('/admin/instructor', require('./instructorPortal.routes'));
router.use('/admin/students', require('./students.routes'));
router.use('/admin/sync', require('./sync.routes'));
router.use('/admin/groups', require('./groups.routes'));
router.use('/admin/cron', require('./cron.routes'));
router.use('/bookings', require('./publicBookings.routes'));

module.exports = router;
