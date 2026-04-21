const express = require('express');
const router = express.Router();
const pointController = require('../controllers/pointController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * ============================================================================
 * ROTAS DE VOICES E RANKING
 * PREFIXO: /api/v1/points
 * ============================================================================
 */

router.get('/leaderboard/university', authMiddleware, pointController.getUniversityLeaderboard);
router.get('/leaderboard/global', authMiddleware, pointController.getGlobalLeaderboard);
router.get('/referrals/stats', authMiddleware, pointController.getReferralStats);

// Rota Administrativa (Protegida)
router.post('/admin/credit', authMiddleware, pointController.adminCreditPoints);

module.exports = router;