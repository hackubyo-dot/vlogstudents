const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * ============================================================================
 * ROTAS DE AUTENTICAÇÃO MASTER
 * PREFIXO: /api/v1/auth
 * ============================================================================
 */

// Acesso Público
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/google', authController.googleAuth);

// Recuperação de Conta (Fluxo de e-mail)
router.post('/recovery/request', authController.requestRecovery);
router.post('/recovery/verify', authController.verifyRecoveryCode);
router.post('/recovery/reset', authController.resetPassword);

// Acesso Protegido (Validação de Sessão)
router.get('/validate-session', authMiddleware, authController.validateSession);

// Logout (Opcional no backend, geralmente limpo no frontend)
router.post('/logout', authMiddleware, (req, res) => {
    res.status(200).json({ success: true, message: 'Sessão encerrada no Master Kernel.' });
});

module.exports = router;