/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER ROUTER v2.0.0
 * Centralização de endpoints + Middlewares + Controllers
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

// ===============================
// MIDDLEWARES
// ===============================
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// ===============================
// CONTROLLERS
// ===============================
const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');
const reelCtrl = require('../controllers/reelController');
const socialCtrl = require('../controllers/socialController');
const chatCtrl = require('../controllers/chatController');

// ============================================================================
// 🔐 AUTH & IDENTITY
// ============================================================================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/recovery/request', authCtrl.requestRecovery);

// ============================================================================
// 👤 USER PROFILE
// ============================================================================
router.get('/users/me', auth, userCtrl.getMe);

router.patch('/users/update', auth, userCtrl.updateProfile);

router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

router.delete('/users/delete', auth, userCtrl.deleteAccount);

// ============================================================================
// 🎬 REELS / CONTENT
// ============================================================================
router.get('/reels', auth, reelCtrl.getFeed);

router.get('/reels/:id', auth, reelCtrl.getById);

router.post(
    '/reels/create',
    auth,
    upload.single('file'),
    reelCtrl.create
);

router.post('/reels/:id/view', auth, reelCtrl.trackView);

router.delete('/reels/delete/:id', auth, reelCtrl.delete);

// ============================================================================
// ❤️ SOCIAL INTERACTIONS
// ============================================================================
router.post('/social/like', auth, socialCtrl.toggleLike);

router.post('/social/comment', auth, socialCtrl.addComment);

router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

router.post('/social/follow', auth, socialCtrl.toggleFollow);

// ============================================================================
// 💬 CHAT / REALTIME
// ============================================================================
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

// ============================================================================
// 📊 TEST / DEBUG ROUTE
// ============================================================================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'VlogStudents API v2 funcionando 🚀',
        timestamp: new Date()
    });
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = router;
