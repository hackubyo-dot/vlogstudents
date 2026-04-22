// FILE: src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * Endpoints de Identidade e Autenticação
 * Rota base: /api/auth
 */

router.post('/register', authController.register);
router.post('/login', authController.login);

// Exemplo de rota de health do módulo
router.get('/status', (req, res) => {
  res.status(200).json({ success: true, service: 'Identity Service Operational' });
});

module.exports = router;