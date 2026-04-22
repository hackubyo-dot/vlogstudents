/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER ROUTER
 * Definição exaustiva de endpoints e injeção de Middlewares
 * ============================================================================
 */
const express = require('express');
const router = express.Router();

// Middlewares Master
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Controllers Master
const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');
const reelCtrl = require('../controllers/reelController');
const socialCtrl = require('../controllers/socialController');
const chatCtrl = require('../controllers/chatController');

/**
 * ---------------------------------------------------------
 * SUB-MODULO: IDENTIDADE E ACESSO (AUTH)
 * ---------------------------------------------------------
 */
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/recovery/request', authCtrl.requestRecovery);

/**
 * ---------------------------------------------------------
 * SUB-MODULO: USUÁRIOS E PERFIL (USERS)
 * ---------------------------------------------------------
 */
router.get('/users/me', auth, userCtrl.getMe);
router.patch('/users/update', auth, userCtrl.updateProfile);
router.post('/users/profile/avatar', auth, upload.single('file'), userCtrl.updateAvatar);
router.delete('/users/delete', auth, userCtrl.deleteAccount);

/**
 * ---------------------------------------------------------
 * SUB-MODULO: VÍDEOS E CONTEÚDO (REELS)
 * ---------------------------------------------------------
 */
router.get('/reels', auth, reelCtrl.getFeed);
router.get('/reels/:id', auth, reelCtrl.getById);
router.post('/reels/create', auth, upload.single('file'), reelCtrl.create);
router.post('/reels/:id/view', auth, reelCtrl.trackView);
router.delete('/reels/delete/:id', auth, reelCtrl.delete);

/**
 * ---------------------------------------------------------
 * SUB-MODULO: INTERAÇÕES SOCIAIS (SOCIAL)
 * ---------------------------------------------------------
 */
// Implementar lógica de controller para social se necessário ou rotas diretas
// Exemplo:
// router.post('/social/like', auth, socialCtrl.toggleLike);

/**
 * ---------------------------------------------------------
 * SUB-MODULO: COMUNICAÇÃO REAL-TIME (CHAT)
 * ---------------------------------------------------------
 */
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);
router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);
router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

module.exports = router;
