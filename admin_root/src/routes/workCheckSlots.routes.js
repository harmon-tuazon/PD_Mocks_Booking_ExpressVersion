const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { list } = require('../controllers/workCheckSlots/list');
const { create } = require('../controllers/workCheckSlots/create');
const { getById } = require('../controllers/workCheckSlots/getById');
const { update } = require('../controllers/workCheckSlots/update');
const { remove } = require('../controllers/workCheckSlots/remove');
const { bulkDelete } = require('../controllers/workCheckSlots/bulkDelete');
const { bulkEdit } = require('../controllers/workCheckSlots/bulkEdit');
const { bulkToggle } = require('../controllers/workCheckSlots/bulkToggle');
const { clone } = require('../controllers/workCheckSlots/clone');

// All routes require admin auth
router.use(requireAdmin);

router.get('/list', list);
router.post('/create', create);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/bulk-delete', bulkDelete);
router.post('/bulk-edit', bulkEdit);
router.post('/bulk-toggle', bulkToggle);
router.post('/clone', clone);

module.exports = router;
