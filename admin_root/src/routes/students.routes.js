/**
 * Students Routes
 * Base path: /api/admin/students
 */

const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { search } = require('../controllers/students/search');

router.use(requireAdmin);

router.get('/search', search);

module.exports = router;
