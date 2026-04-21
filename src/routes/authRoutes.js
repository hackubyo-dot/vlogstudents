/**
 * ============================================================================
 * VLOGSTUDENTS MASTER IDENTITY ROUTES v4.0.0
 * MAPEAMENTO DE ACESSOS E PROTEÇÃO DE ENDPOINTS
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * PREFIXO GLOBAL: /api/v1/auth
 */

// --- ACESSO PÚBLICO (NÃO PROTEGIDO) ---

// Login convencional
router.post('/login', authController.login);

// Registro (Onboarding com Referral)
router.post('/register', authController.register);

// Autenticação Google Cloud
router.post('/google', authController.googleAuth);

// Recuperação de Conta (Fluxo de E-mail)
router.post('/recovery/request', authController.requestRecovery);
router.post('/recovery/verify', authController.verifyRecoveryCode);
router.post('/recovery/reset', authController.resetPassword);

// --- ACESSO RESTRITO (EXIGE JWT TOKEN) ---

// Validação de Sessão (Heartbeat)
router.get('/validate-session', authMiddleware, authController.validateSession);

// Logout Seguro
router.post('/logout', authMiddleware, authController.logout);

/**
 * EXPORTAÇÃO MASTER DO MÓDULO DE ROTAS
 */
module.exports = router;
