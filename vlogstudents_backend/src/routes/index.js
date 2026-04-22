const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const reelController = require('../controllers/reelController');
const socialController = require('../controllers/socialController');
const chatController = require('../controllers/chatController');
const economyController = require('../controllers/economyController');
const recoveryController = require('../controllers/recoveryController');

// Middlewares
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

/**
 * AUTH & RECOVERY
 */
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/recovery/request', recoveryController.requestRecovery);
router.post('/auth/recovery/reset', recoveryController.resetPassword);

/**
 * USERS
 */
router.get('/users/me', auth, userController.getMe);
router.patch('/users/update', auth, userController.updateProfile);
router.post('/users/profile/avatar', auth, upload.single('file'), userController.updateAvatar);
router.delete('/users/delete', auth, userController.deleteAccount);

/**
 * REELS
 */
router.get('/reels', auth, reelController.getFeed);
router.get('/reels/:id', auth, reelController.getById);
router.post('/reels/create', auth, upload.single('file'), reelController.create);
router.patch('/reels/update/:id', auth, reelController.update);
router.delete('/reels/delete/:id', auth, reelController.delete);
router.post('/reels/:id/view', auth, reelController.incrementView);

/**
 * SOCIAL
 */
router.post('/social/like', auth, socialController.toggleLike);
router.post('/social/comment', auth, socialController.addComment);
router.post('/social/follow', auth, socialController.toggleFollow);

/**
 * CHAT
 */
router.get('/chat/rooms', auth, chatController.getMyRooms);
router.post('/chat/rooms/create', auth, chatController.createOrGetRoom);
router.get('/chat/rooms/:roomId/messages', auth, chatController.getMessages);
router.post('/chat/messages', auth, chatController.sendMessage);

/**
 * ECONOMY
 */
router.get('/economy/history', auth, economyController.getHistory);
router.get('/economy/leaderboard', auth, economyController.getLeaderboard);

/**
 * GENERIC UPLOAD (Para outros fins)
 */
router.post('/upload', auth, upload.single('file'), (req, res) => {
    // Implementação genérica se necessário
    res.json({ success: true, message: "Ficheiro recebido" });
});

module.exports = router;