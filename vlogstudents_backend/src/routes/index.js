/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - MASTER ROUTER v3.0.0 (FULL ALIGNMENT)
 * Compatível com Flutter + API + Realtime + Economy + Social
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================================================
// 🔐 MIDDLEWARES
// ============================================================================
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// ============================================================================
// 🎯 CONTROLLERS
// ============================================================================
const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');
const reelCtrl = require('../controllers/reelController');
const socialCtrl = require('../controllers/socialController');
const economyCtrl = require('../controllers/economyController');
const chatCtrl = require('../controllers/chatController');

// ============================================================================
// 🔓 AUTH (PUBLIC)
// ============================================================================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/recovery/request', authCtrl.requestRecovery);

// ============================================================================
// 👤 USERS (PROTECTED)
// ============================================================================
router.get('/users/me', auth, userCtrl.getMe);

// 🔥 FIX: aceita "me" ou ID real
router.get('/users/social/metrics/:userId', auth, userCtrl.getSocialMetrics);

// 🔍 SEARCH USERS
router.get('/users/search', auth, userCtrl.searchUsers);

// ✏️ UPDATE PROFILE
router.patch('/users/update', auth, userCtrl.updateProfile);

// 📸 AVATAR UPLOAD
router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

// ❌ DELETE ACCOUNT
router.delete('/users/delete', auth, userCtrl.deleteAccount);

// ============================================================================
// 🎬 REELS (PROTECTED)
// ============================================================================
router.get('/reels', auth, reelCtrl.getFeed);

// 🔥 FIX: reels por usuário (me ou id)
router.get('/reels/user/:userId', auth, reelCtrl.getUserReels);

// 📄 DETALHE
router.get('/reels/:id', auth, reelCtrl.getById);

// 🚀 CREATE
router.post(
    '/reels/create',
    auth,
    upload.single('file'),
    reelCtrl.create
);

// ✏️ UPDATE
router.patch('/reels/update/:id', auth, reelCtrl.update);

// ❌ DELETE
router.delete('/reels/delete/:id', auth, reelCtrl.delete);

// 👁 VIEW TRACK
router.post('/reels/:id/view', auth, reelCtrl.trackView);

// ============================================================================
// ❤️ SOCIAL
// ============================================================================
router.post('/social/like', auth, socialCtrl.toggleLike);

router.post('/social/comment', auth, socialCtrl.addComment);

router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

router.post('/social/follow', auth, socialCtrl.toggleFollow);

// ============================================================================
// 💰 ECONOMY (FIX 404)
// ============================================================================
router.get('/economy/history', auth, economyCtrl.getHistory);

router.get('/economy/leaderboard', auth, economyCtrl.getLeaderboard);

// ============================================================================
// 💬 CHAT / REALTIME
// ============================================================================
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

// ============================================================================
// 🧪 TEST / HEALTH INTERNAL
// ============================================================================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'VLOGSTUDENTS API ONLINE 🚀',
        version: '3.0.0',
        timestamp: new Date()
    });
});

// ============================================================================
// ⚠️ 404 HANDLER LOCAL
// ============================================================================
router.use((req, res) => {
    console.warn(`[ROUTE_404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Endpoint não encontrado: ${req.method} ${req.originalUrl}`
    });
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = router;
