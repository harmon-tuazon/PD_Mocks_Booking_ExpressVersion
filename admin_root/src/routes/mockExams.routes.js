const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');
const { list } = require('../controllers/mockExams/list');
const { get } = require('../controllers/mockExams/get');
const { create } = require('../controllers/mockExams/create');
const { update } = require('../controllers/mockExams/update');
const { remove } = require('../controllers/mockExams/delete');
const { bulkCreate } = require('../controllers/mockExams/bulkCreate');
const { bulkCreateCsv } = require('../controllers/mockExams/bulkCreateCsv');
const { bulkUpdate } = require('../controllers/mockExams/bulkUpdate');
const { bulkToggleStatus } = require('../controllers/mockExams/bulkToggleStatus');
const { batchDelete } = require('../controllers/mockExams/batchDelete');
const { clone } = require('../controllers/mockExams/clone');
const { exportCsv } = require('../controllers/mockExams/exportCsv');
const { metrics } = require('../controllers/mockExams/metrics');
const { aggregates } = require('../controllers/mockExams/aggregates');
const { aggregateSessions } = require('../controllers/mockExams/aggregateSessions');
const { availableForRebook } = require('../controllers/mockExams/availableForRebook');
const { getById } = require('../controllers/mockExams/getById');
const { getBookings } = require('../controllers/mockExams/getBookings');
const { updateAttendance } = require('../controllers/mockExams/updateAttendance');
const { cancelBookings } = require('../controllers/mockExams/cancelBookings');
const { getPrerequisites, addPrerequisite } = require('../controllers/mockExams/prerequisites');
const { updatePrerequisitesDelta } = require('../controllers/mockExams/prerequisitesDelta');
const { removePrerequisite } = require('../controllers/mockExams/removePrerequisite');

// All routes require admin auth
router.use(requireAdmin);

// List & CRUD
router.get('/list', list);
router.get('/get', get);
router.post('/create', create);
router.patch('/update', update);
router.delete('/delete', remove);

// Bulk operations
router.post('/bulk-create', bulkCreate);
router.post('/bulk-create-csv', bulkCreateCsv);
router.patch('/bulk-update', bulkUpdate);
router.post('/bulk-toggle-status', bulkToggleStatus);
router.post('/batch-delete', batchDelete);
router.post('/clone', clone);

// Exports & metrics
router.get('/export-csv', exportCsv);
router.get('/metrics', metrics);
router.get('/aggregates', aggregates);
router.get('/aggregates/:key/sessions', aggregateSessions);
router.get('/available-for-rebook', availableForRebook);

// Nested routes for specific exam
router.get('/:id', getById);
router.get('/:id/bookings', getBookings);
router.patch('/:id/attendance', updateAttendance);
router.patch('/:id/cancel-bookings', cancelBookings);

// Prerequisites
router.get('/:id/prerequisites', getPrerequisites);
router.post('/:id/prerequisites', addPrerequisite);
router.patch('/:id/prerequisites/delta', updatePrerequisitesDelta);
router.delete('/:id/prerequisites/:prerequisiteId', removePrerequisite);

module.exports = router;
