const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { list } = require('../controllers/workCheckBookings/list');
const { create } = require('../controllers/workCheckBookings/create');
const { getById } = require('../controllers/workCheckBookings/getById');
const { update } = require('../controllers/workCheckBookings/update');
const { remove } = require('../controllers/workCheckBookings/remove');
const { aggregates } = require('../controllers/workCheckBookings/aggregates');
const { bulkDelete } = require('../controllers/workCheckBookings/bulkDelete');
const { bulkToggle } = require('../controllers/workCheckBookings/bulkToggle');
const { clone } = require('../controllers/workCheckBookings/clone');
const { diagramData } = require('../controllers/workCheckBookings/diagramData');

router.use(requireAdmin);

// Specific routes BEFORE parameterized routes to avoid conflicts
router.get('/aggregates', aggregates);
router.get('/diagram-data', diagramData);
router.post('/bulk-delete', bulkDelete);
router.post('/bulk-toggle', bulkToggle);
router.post('/clone', clone);

// CRUD routes
router.get('/list', list);
router.post('/create', create);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
