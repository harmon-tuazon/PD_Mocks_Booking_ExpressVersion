/**
 * Dashboard Routes
 * Base path: /api/dashboard
 *
 * Uses session credential pattern (student_id + email in query params)
 * No authenticate middleware needed.
 */

const router = require('express').Router();
const { dashboard } = require('../controllers/dashboard');

router.get('/', dashboard);

module.exports = router;
