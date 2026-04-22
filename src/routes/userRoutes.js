const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/me', auth, userController.getMe);
router.patch('/update', auth, userController.updateProfile);
router.post('/avatar', auth, upload.single('file'), userController.updateAvatar);
router.delete('/delete', auth, userController.deleteAccount);

module.exports = router;