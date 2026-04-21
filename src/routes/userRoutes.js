/**
 * ============================================================================
 * VLOGSTUDENTS MASTER USER ROUTES v4.2.0
 * MAPEAMENTO DE IDENTIDADE, LEADERBOARD E VOICES
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const pointController = require('../controllers/pointController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * PREFIXO: /api/v1/users
 */

// --- GESTÃO DE PERFIL ---
router.get('/profile/me', authMiddleware, userController.getMyProfile);
router.patch('/profile/update', authMiddleware, userController.updateProfile);
router.patch('/profile/settings', authMiddleware, userController.updateSettings);

// ROTA DE AVATAR (Google Drive Upload)
router.post('/profile/avatar', 
    authMiddleware, 
    uploadMiddleware.single('file'), 
    userController.uploadAvatar
);

// --- SOCIAL METRICS ---
router.get('/social/metrics', authMiddleware, userController.getSocialMetrics);

// --- SISTEMA DE VOICES (POINTS) ---
// Note: Flutter chama /api/v1/users/points/...
router.get('/points/balance', authMiddleware, userController.getPointsBalance);
router.get('/points/history', authMiddleware, userController.getPointsHistory);
router.post('/points/redeem', authMiddleware, userController.redeemPoints);
router.get('/media/stream/:fileId', userController.streamMedia);

// --- RANKINGS (LEADERBOARD) ---
// Note: Flutter chama /api/v1/users/leaderboard/...
router.get('/leaderboard/university', authMiddleware, pointController.getUniversityLeaderboard);
router.get('/leaderboard/global', authMiddleware, pointController.getGlobalLeaderboard);

// --- CRESCIMENTO (REFERRAL) ---
router.get('/referrals/stats', authMiddleware, userController.getReferralStats);

module.exports = router;
