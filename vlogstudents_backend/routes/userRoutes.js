const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * ============================================================================
 * ROTAS DE USUÁRIO - SINCRONIZAÇÃO TOTAL COM FLUTTER
 * PREFIXO: /api/v1/users
 * ============================================================================
 */

// Perfil e Dados Cadastrais
router.get('/profile/me', authMiddleware, userController.getMyProfile);
router.get('/profile/:id', authMiddleware, userController.getUserProfile);
router.patch('/profile/update', authMiddleware, userController.updateProfile);

// Gestão de Avatar (Upload para Google Drive)
router.post('/profile/avatar',
    authMiddleware,
    uploadMiddleware.single('file'), // 'file' deve coincidir com o FormData do Flutter
    userController.uploadAvatar
);

// Notificações e Configurações
router.patch('/profile/settings', authMiddleware, userController.updateSettings);

// Social Metrics (Seguidores, Seguindo, Posts)
router.get('/social/metrics', authMiddleware, userController.getSocialMetrics);

// Saldo de Voices (Integração com PointsProvider)
router.get('/points/balance', authMiddleware, userController.getPointsBalance);
router.get('/points/history', authMiddleware, userController.getPointsHistory);
router.post('/points/redeem', authMiddleware, userController.redeemPoints);

// Sistema de Crescimento (Referral)
router.get('/referrals/stats', authMiddleware, userController.getReferralStats);

module.exports = router;