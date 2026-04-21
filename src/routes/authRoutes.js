const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/google', authController.googleAuth);
router.get('/validate-session', authMiddleware, authController.validateSession);

module.exports = router;
