const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * ============================================================================
 * ROTAS DE REELS - CONFIGURAÇÃO SINCRONIZADA
 * ============================================================================
 */

// Feed e Upload
router.get('/', authMiddleware, reelController.getFeed);
router.post('/upload', authMiddleware, uploadMiddleware.single('file'), reelController.publishReel);

// Interações (Likes, Comentários, Views)
router.post('/:id/like', authMiddleware, reelController.toggleLike);
router.get('/:id/comments', authMiddleware, reelController.getComments);
router.post('/:id/comments', authMiddleware, reelController.addComment);

// Engajamento e Voices
router.post('/:id/share', authMiddleware, reelController.registerShare);
router.post('/:id/view', authMiddleware, reelController.trackView);
router.post('/:id/repost', authMiddleware, reelController.repost);

// Gestão de Conteúdo
router.delete('/:id', authMiddleware, reelController.deleteReel);

module.exports = router;
