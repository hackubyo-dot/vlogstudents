const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/', auth, reelController.getFeed);
router.get('/:id', auth, reelController.getById);
router.post('/create', auth, upload.single('file'), reelController.create);
router.delete('/delete/:id', auth, reelController.delete);
router.post('/view/:id', auth, reelController.incrementView);

module.exports = router;