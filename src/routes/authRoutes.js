const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * ============================================================================
 * ROTAS DE AUTENTICAÇÃO - SINCRONIZAÇÃO TOTAL COM CONTROLLER
 * ============================================================================
 */

// Endpoints Públicos
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/google', authController.googleAuth);

// Fluxo de Recuperação (Verifique se os nomes batem com o controller acima)
router.post('/recovery/request', authController.requestRecovery);
router.post('/recovery/verify', authController.verifyRecoveryCode);
router.post('/recovery/reset', authController.resetPassword);

// Endpoints Protegidos
router.get('/validate-session', authMiddleware, authController.validateSession);

module.exports = router;
