const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { list } = require('../controllers/instructors/list');
const { create } = require('../controllers/instructors/create');
const { getById } = require('../controllers/instructors/getById');
const { update } = require('../controllers/instructors/update');
const { remove } = require('../controllers/instructors/remove');
const { dropdown } = require('../controllers/instructors/dropdown');
const { bulkDelete } = require('../controllers/instructors/bulkDelete');
const { bulkToggleStatus } = require('../controllers/instructors/bulkToggleStatus');
const { clone } = require('../controllers/instructors/clone');
const { groups } = require('../controllers/instructors/groups');
const { provisionAccess } = require('../controllers/instructors/provisionAccess');
const { resetPassword } = require('../controllers/instructors/resetPassword');

// All routes require admin auth
router.use(requireAdmin);

// List/search routes (before parameterized routes)
router.get('/list', list);
router.get('/dropdown', dropdown);
router.post('/create', create);
router.post('/bulk-delete', bulkDelete);
router.post('/bulk-toggle-status', bulkToggleStatus);

// Single instructor routes
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/:id/clone', clone);
router.get('/:id/groups', groups);
router.post('/:id/provision-access', provisionAccess);
router.post('/:id/reset-password', resetPassword);

module.exports = router;
