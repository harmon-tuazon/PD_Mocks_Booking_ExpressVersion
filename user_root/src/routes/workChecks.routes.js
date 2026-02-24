/**
 * Work Check Routes
 * Base path: /api/work-checks
 *
 * NOTE: No authenticate middleware at router level.
 * Work check endpoints use session credential pattern (student_id + email)
 * validated inline in each controller.
 */

const router = require('express').Router();
const { validateBody } = require('../middleware/validateBody');
const { schemas } = require('../services/validation');
const { available } = require('../controllers/workChecks/available');
const { groups } = require('../controllers/workChecks/groups');
const { list } = require('../controllers/workChecks/list');
const { create } = require('../controllers/workChecks/create');
const { cancel } = require('../controllers/workChecks/cancel');

// GET routes (query param validation is inline in controllers)
router.get('/available', available);
router.get('/groups', groups);
router.get('/list', list);

// POST route with body validation middleware
router.post('/create',
  validateBody(schemas.workCheckCreate),
  create
);

// DELETE route with body validation middleware
router.delete('/:id',
  validateBody(schemas.workCheckCancel),
  cancel
);

module.exports = router;
