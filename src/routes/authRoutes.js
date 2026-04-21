const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * ============================================================================
 * ROTAS DE USUÁRIO - SINCRONIZAÇÃO TOTAL COM CONTROLLER
 * ============================================================================
 */

router.get('/profile/me', authMiddleware, userController.getMyProfile);
router.get('/profile/:id', authMiddleware, userController.getUserProfile);
router.patch('/profile/update', authMiddleware, userController.updateProfile);

// Rota de configurações visuais (CORRIGIDA)
router.patch('/profile/settings', authMiddleware, userController.updateSettings);

// Rota de Avatar com Multer
router.post('/profile/avatar', authMiddleware, uploadMiddleware.single('file'), userController.uploadAvatar);

// Métricas e Gamificação
router.get('/social/metrics', authMiddleware, userController.getSocialMetrics);
router.get('/points/balance', authMiddleware, userController.getPointsBalance);
router.get('/points/history', authMiddleware, userController.getPointsHistory);
router.post('/points/redeem', authMiddleware, userController.redeemPoints);
router.get('/referrals/stats', authMiddleware, userController.getReferralStats);

module.exports = router;
