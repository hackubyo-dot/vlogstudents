const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * ============================================================================
 * ROTAS DE CHAT MASTER - CONFIGURAÇÃO SINCRONIZADA
 * ============================================================================
 */

router.get('/rooms', authMiddleware, chatController.getMyRooms);
router.post('/rooms', authMiddleware, chatController.createRoom); // NOVA ROTA
router.get('/rooms/:roomId/messages', authMiddleware, chatController.getMessages);
router.post('/rooms/:roomId/messages', authMiddleware, chatController.sendMessage);
router.patch('/rooms/:roomId/read', authMiddleware, chatController.markAsRead);

module.exports = router;
