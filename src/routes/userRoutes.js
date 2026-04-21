const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rotas de Perfil e Stream (Sincronizado com NetworkProvider do Flutter)
router.get('/profile/me', authMiddleware, userController.getMyProfile);
router.get('/media/stream/:fileId', userController.streamMedia); // PÚBLICO PARA PLAYER

// Rotas de Pontos e Recompensas
router.get('/points/balance', authMiddleware, userController.getPointsBalance);
router.get('/points/history', authMiddleware, userController.getPointsHistory);

// Rotas de Leaderboard (Mapeadas para bater com o log 404 anterior)
const pointController = require('../controllers/pointController');
router.get('/leaderboard/global', authMiddleware, pointController.getGlobalLeaderboard);
router.get('/leaderboard/university', authMiddleware, pointController.getUniversityLeaderboard);

module.exports = router;
