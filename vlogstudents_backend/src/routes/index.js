/**
 * ============================================================================
 * VLOGSTUDENTS MASTER ROUTER ORCHESTRATOR v26.0.0 (FINAL ENTERPRISE)
 * ZERO 404 | ZERO MISMATCH | FULL BACKEND INTEGRATION
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
const chatCtrl = require('../controllers/chatController');
const economyCtrl = require('../controllers/economyController');

// ============================================================================
// 🔓 AUTH MODULE (PUBLIC)
// ============================================================================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/recovery/request', authCtrl.requestRecovery);
router.post('/auth/recovery/reset', authCtrl.resetPassword); // ✅ corrigido

// ============================================================================
// 👤 USERS MODULE (PROTECTED)
// ============================================================================
router.get('/users/me', auth, userCtrl.getMe);

// 🔥 suporta "me" ou ID real
router.get('/users/social/metrics/:userId', auth, userCtrl.getSocialMetrics);

// 🔍 SEARCH
router.get('/users/search', auth, userCtrl.searchUsers);

// ✏️ UPDATE PROFILE
router.patch('/users/update', auth, userCtrl.updateProfile);

// 📸 AVATAR
router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

// ❌ SOFT DELETE
router.delete('/users/delete', auth, userCtrl.deleteAccount);

// 🎯 REFERRAL STATS
router.get('/users/referrals/stats', auth, economyCtrl.getReferralStats);

// ============================================================================
// 🎬 REELS MODULE (PROTECTED)
// ============================================================================
router.get('/reels', auth, reelCtrl.getFeed);

// 🔥 PERFIL → REELS DO USUÁRIO
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
// ❤️ SOCIAL MODULE
// ============================================================================
router.post('/social/like', auth, socialCtrl.toggleLike);

router.post('/social/comment', auth, socialCtrl.addComment);

router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

router.post('/social/follow', auth, socialCtrl.toggleFollow);

// ============================================================================
// 💬 CHAT MODULE
// ============================================================================
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

// 🔥 ENVIO DE MENSAGEM (ESSENCIAL PARA FLUTTER)
router.post('/chat/messages', auth, chatCtrl.sendMessage);

// ============================================================================
// 💰 ECONOMY MODULE
// ============================================================================
router.get('/economy/history', auth, economyCtrl.getHistory);

router.get('/economy/leaderboard', auth, economyCtrl.getLeaderboard);

// ============================================================================
// 🧪 HEALTH CHECK
// ============================================================================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'VLOGSTUDENTS API ONLINE 🚀',
        version: '26.0.0',
        timestamp: new Date()
    });
});

// ============================================================================
// ⚠️ GLOBAL 404 HANDLER
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
