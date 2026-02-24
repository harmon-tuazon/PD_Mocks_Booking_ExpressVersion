const router = require('express').Router();

const { activateScheduledExams } = require('../controllers/cron/activateScheduledExams');
const { activateScheduledSlots } = require('../controllers/cron/activateScheduledSlots');
const { syncBookingsFromSupabase } = require('../controllers/cron/syncBookingsFromSupabase');
const { syncExamsBackfillFromHubspot } = require('../controllers/cron/syncExamsBackfillFromHubspot');

router.get('/activate-scheduled-exams', activateScheduledExams);
router.get('/activate-scheduled-slots', activateScheduledSlots);
router.get('/sync-bookings-from-supabase', syncBookingsFromSupabase);
router.get('/sync-exams-backfill-bookings-from-hubspot', syncExamsBackfillFromHubspot);

module.exports = router;
