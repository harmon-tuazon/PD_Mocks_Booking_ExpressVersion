const router = require('express').Router();
const { requireAdmin } = require('../middleware/requireAdmin');

// Controllers
const { list } = require('../controllers/groups/list');
const { create } = require('../controllers/groups/create');
const { statistics } = require('../controllers/groups/statistics');
const { getById } = require('../controllers/groups/getById');
const { update } = require('../controllers/groups/update');
const { deleteGroup } = require('../controllers/groups/delete');
const { assignInstructor } = require('../controllers/groups/assignInstructor');
const { assignStudent } = require('../controllers/groups/assignStudent');
const { bulkAssignStudents } = require('../controllers/groups/bulkAssignStudents');
const { bulkDelete } = require('../controllers/groups/bulkDelete');
const { bulkToggleStatus } = require('../controllers/groups/bulkToggleStatus');
const { clone } = require('../controllers/groups/clone');
const { removeInstructor } = require('../controllers/groups/removeInstructor');
const { removeStudent } = require('../controllers/groups/removeStudent');

router.use(requireAdmin);

// Specific routes BEFORE parameterized routes
router.get('/list', list);
router.post('/create', create);
router.get('/statistics', statistics);
router.post('/assign-instructor', assignInstructor);
router.post('/assign-student', assignStudent);
router.post('/bulk-assign-students', bulkAssignStudents);
router.post('/bulk-delete', bulkDelete);
router.post('/bulk-toggle-status', bulkToggleStatus);

// Parameterized routes
router.get('/:groupId', getById);
router.put('/:groupId', update);
router.delete('/:groupId', deleteGroup);
router.post('/:groupId/clone', clone);
router.delete('/:groupId/instructors/:instructorId', removeInstructor);
router.delete('/:groupId/students/:studentId', removeStudent);

module.exports = router;
