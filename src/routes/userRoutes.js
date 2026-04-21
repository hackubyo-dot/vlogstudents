/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER ROUTES v7.0.0
 * MAPEAMENTO DE IDENTIDADE, LEADERBOARD, VOICES E STREAMING
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

// Controladores
const userController = require('../controllers/userController');
const pointController = require('../controllers/pointController');

// Middlewares
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * PREFIXO BASE: /api/v1/users
 * Sincronizado com: NetworkProvider & ReelsProvider do Flutter
 */

// --- 1. GESTÃO DE PERFIL & IDENTIDADE ---
// Recupera perfil master (VlogUser)
router.get('/profile/me', authMiddleware, userController.getMyProfile);

// Atualização de dados cadastrais e biografias
router.patch('/profile/update', authMiddleware, userController.updateProfile);

// Preferências visuais (Tema, Configurações)
router.patch('/profile/settings', authMiddleware, userController.updateSettings);

// Upload de Avatar (Persistência via Google Drive)
router.post('/profile/avatar', 
    authMiddleware, 
    uploadMiddleware.single('file'), 
    userController.uploadAvatar
);


// --- 2. SOCIAL & MÉTRICAS ---
// Seguidores, seguindo e contagem de posts
router.get('/social/metrics', authMiddleware, userController.getSocialMetrics);

// Visualização de perfil de terceiros
router.get('/profile/:id', authMiddleware, userController.getUserProfile);


// --- 3. SISTEMA DE VOICES (PONTOS & ECONOMIA) ---
// Saldo atual de Voices
router.get('/points/balance', authMiddleware, userController.getPointsBalance);

// Extrato de transações de pontos
router.get('/points/history', authMiddleware, userController.getPointsHistory);

// Resgate de recompensas
router.post('/points/redeem', authMiddleware, userController.redeemPoints);


// --- 4. ENGINE DE STREAMING (PROXY BINÁRIO) ---
/**
 * ROTA PÚBLICA: Necessária para que o VideoPlayer do Flutter acesse
 * os bytes do Google Drive sem bloqueios de autorização JWT no header.
 * FIX: Giro infinito resolvido no Controller v7.0.0.
 */
router.get('/media/stream/:fileId', userController.streamMedia);


// --- 5. RANKINGS (LEADERBOARD) ---
// Ranking da mesma universidade do usuário
router.get('/leaderboard/university', authMiddleware, pointController.getUniversityLeaderboard);

// Ranking mundial de estudantes
router.get('/leaderboard/global', authMiddleware, pointController.getGlobalLeaderboard);


// --- 6. CRESCIMENTO (REFERRAL & INVITES) ---
// Estatísticas de convites e ganhos por indicação
router.get('/referrals/stats', authMiddleware, userController.getReferralStats);


module.exports = router;
