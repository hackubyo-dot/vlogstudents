const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const auth = require('../middlewares/auth');

router.post('/like', auth, socialController.toggleLike);
router.post('/comment', auth, socialController.addComment);
router.post('/follow', auth, socialController.toggleFollow);

module.exports = router;