/**
 * Instructor Portal Routes
 * Base path: /api/admin/instructor
 *
 * NOTE: No requireAdmin middleware applied at router level.
 * Instructor portal uses requireRole('instructor') inline in each controller.
 */

const router = require('express').Router();

const { me } = require('../controllers/instructorPortal/me');
const { schedule } = require('../controllers/instructorPortal/schedule');
const { analytics } = require('../controllers/instructorPortal/analytics');
const { dashboardStats } = require('../controllers/instructorPortal/dashboardStats');
const { markBookings } = require('../controllers/instructorPortal/markBookings');
const { listGroups } = require('../controllers/instructorPortal/groups');
const { groupDetail } = require('../controllers/instructorPortal/groupDetail');

router.get('/me', me);
router.get('/schedule', schedule);
router.get('/analytics', analytics);
router.get('/dashboard/stats', dashboardStats);
router.post('/bookings/mark', markBookings);
router.get('/groups', listGroups);
router.get('/groups/:groupId', groupDetail);

module.exports = router;
