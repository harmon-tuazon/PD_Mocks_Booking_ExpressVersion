const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { forceSupabase } = require('../controllers/sync/forceSupabase');

router.use(requireAdmin);

router.post('/force-supabase', forceSupabase);

module.exports = router;
