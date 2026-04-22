const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middlewares/auth');

router.post('/rooms', auth, chatController.createRoom);
router.get('/rooms', auth, chatController.listRooms);
router.post('/messages', auth, chatController.sendMessage);
router.get('/messages/:roomId', auth, chatController.getMessages);

module.exports = router;