const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const pointController = require('../controllers/pointController'); // IMPORTAÇÃO OBRIGATÓRIA
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * ============================================================================
 * ROTAS DE USUÁRIO - SINCRONIZAÇÃO TOTAL COM FLUTTER
 * PREFIXO: /api/v1/users
 * ============================================================================
 */

// Perfil
router.get('/profile/me', authMiddleware, userController.getMyProfile);
router.patch('/profile/update', authMiddleware, userController.updateProfile);
router.patch('/profile/settings', authMiddleware, userController.updateSettings);
router.post('/profile/avatar', authMiddleware, uploadMiddleware.single('file'), userController.uploadAvatar);
router.get('/profile/:id', authMiddleware, userController.getUserProfile);

// Social e Mídia
router.get('/social/metrics', authMiddleware, userController.getSocialMetrics);
router.get('/media/stream/:fileId', userController.streamMedia);

// Voices e Pontos (Callbacks garantidos no userController)
router.get('/points/balance', authMiddleware, userController.getPointsBalance);
router.get('/points/history', authMiddleware, userController.getPointsHistory);
router.post('/points/redeem', authMiddleware, userController.redeemPoints);
router.get('/referrals/stats', authMiddleware, userController.getReferralStats);

// Leaderboard (Callbacks garantidos no pointController)
router.get('/leaderboard/university', authMiddleware, pointController.getUniversityLeaderboard);
router.get('/leaderboard/global', authMiddleware, pointController.getGlobalLeaderboard);

module.exports = router;
