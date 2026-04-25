/**
 * ============================================================================
 * VLOGSTUDENTS MASTER ROUTER ORCHESTRATOR v28.0.0 (FINAL ENTERPRISE)
 * ZERO 404 | ZERO MISMATCH | FULL BACKEND INTEGRATION | READY FOR FLUTTER
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
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
const statusCtrl = require('../controllers/statusController');

// ============================================================================
// 🔓 AUTH MODULE (PUBLIC)
// ============================================================================
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/recovery/request', authCtrl.requestRecovery);
router.post('/auth/recovery/reset', authCtrl.resetPassword);

// ============================================================================
// 👤 USERS MODULE (PROTECTED)
// ============================================================================
router.get('/users/me', auth, userCtrl.getMe);

// 🔥 Suporta "me" ou ID real para visualização de perfil
router.get('/users/profile/:userId', auth, userCtrl.getProfile);

// 📊 Métricas Sociais (Followers/Following/Likes)
router.get('/users/social/metrics/:userId', auth, userCtrl.getSocialMetrics);

// 🔍 SEARCH USERS (Global Campus Search)
router.get('/users/search', auth, userCtrl.searchUsers);

// ✏️ UPDATE PROFILE (Metadata)
router.patch('/users/update', auth, userCtrl.updateProfile);

// 📸 AVATAR UPLOAD (Multipart)
router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

// ❌ ACCOUNT DELETION (Soft Delete)
router.delete('/users/delete', auth, userCtrl.deleteAccount);

// 🎯 REFERRAL STATS
router.get('/users/referrals/stats', auth, economyCtrl.getReferralStats);

// ============================================================================
// 🎬 REELS MODULE (VIDEO CONTENT)
// ============================================================================
router.get('/reels', auth, reelCtrl.getFeed);

// 🎥 Listar Reels de um usuário específico
router.get('/reels/user/:userId', auth, reelCtrl.getUserReels);

// 📄 Detalhes de um Reel específico
router.get('/reels/:id', auth, reelCtrl.getById);

// 🚀 CREATE REEL (Upload Industrial)
router.post(
    '/reels/create',
    auth,
    upload.single('file'),
    reelCtrl.create
);

// ✏️ UPDATE REEL (Título/Legenda)
router.patch('/reels/update/:id', auth, reelCtrl.update);

// ❌ DELETE REEL
router.delete('/reels/delete/:id', auth, reelCtrl.delete);

// 👁 TRACK VIEW (Neon DB Counter Sync)
router.post('/reels/:id/view', auth, reelCtrl.incrementView);

// ============================================================================
// ❤️ SOCIAL MODULE (INTERACTIONS)
// ============================================================================
// Like/Unlike em Reels
router.post('/social/like', auth, socialCtrl.toggleLike);

// Comentários (Suporta Texto e Áudio Voices via Multipart)
router.post(
    '/social/comment', 
    auth, 
    upload.single('file'), 
    socialCtrl.addComment
);

// Listar Comentários de um Reel
router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

// Reações em Comentários (🔥, 👏, 🧠)
router.post('/social/comment/react', auth, socialCtrl.toggleReaction);

// Networking (Follow/Unfollow)
router.post('/social/follow', auth, socialCtrl.toggleFollow);

// ============================================================================
// ⏳ STATUS MODULE (CAMPUS STORIES)
// ============================================================================
// Buscar todos os status ativos (dentro de 24h)
router.get('/status/active', auth, statusCtrl.getActive);

// Criar novo Status (Suporta Texto, Link e Mídia via Multipart)
router.post(
    '/status/create', 
    auth, 
    upload.single('file'), 
    statusCtrl.create
);

// ============================================================================
// 💬 CHAT MODULE (REALTIME COMMUNICATION)
// ============================================================================
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

router.post('/chat/messages', auth, chatCtrl.sendMessage);

// ============================================================================
// 💰 ECONOMY MODULE (GAMIFICATION)
// ============================================================================
router.get('/economy/history', auth, economyCtrl.getHistory);

router.get('/economy/leaderboard', auth, economyCtrl.getLeaderboard);

// ============================================================================
// 📦 GENERIC UPLOAD
// ============================================================================
router.post('/upload', auth, upload.single('file'), (req, res) => {
    return res.json({
        success: true,
        message: "Ficheiro recebido com sucesso no núcleo.",
        file: req.file || null
    });
});

// ============================================================================
// 🧪 HEALTH CHECK
// ============================================================================
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'VLOGSTUDENTS ENTERPRISE API ONLINE 🚀',
        version: '28.0.0',
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
        message: `Endpoint não encontrado no campus: ${req.method} ${req.originalUrl}`
    });
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = router;
