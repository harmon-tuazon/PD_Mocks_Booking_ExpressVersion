const router = require('express').Router();
const { login } = require('../controllers/auth/login');
const { logout } = require('../controllers/auth/logout');
const { me } = require('../controllers/auth/me');
const { refresh } = require('../controllers/auth/refresh');
const { requestOtp } = require('../controllers/auth/requestOtp');
const { verifyOtp } = require('../controllers/auth/verifyOtp');
const { updatePassword } = require('../controllers/auth/updatePassword');
const { validate } = require('../controllers/auth/validate');

// All auth routes are public (no requireAdmin middleware)
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.post('/refresh', refresh);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/update-password', updatePassword);
router.get('/validate', validate);

module.exports = router;
