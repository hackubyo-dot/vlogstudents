const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * ============================================================================
 * ROTAS DE REELS - ENGINE DE CONTEÚDO TIKTOK-STYLE
 * PREFIXO: /api/v1/reels
 * ============================================================================
 */

// Feed Principal (Infinite Scroll)
router.get('/', authMiddleware, reelController.getFeed);

// Upload de Novo Reel (Sincronizado com UploadReelScreen)
router.post('/upload',
    authMiddleware,
    uploadMiddleware.single('file'), // O Flutter envia o vídeo no campo 'file'
    reelController.publishReel
);

// Interações de Engajamento
router.post('/:id/like', authMiddleware, reelController.toggleLike);
router.get('/:id/comments', authMiddleware, reelController.getComments);
router.post('/:id/comments', authMiddleware, reelController.addComment);
router.post('/:id/share', authMiddleware, reelController.registerShare);
router.post('/:id/view', authMiddleware, reelController.trackView);
router.post('/:id/repost', authMiddleware, reelController.repost);

// Gestão de Conteúdo Próprio
router.delete('/:id', authMiddleware, reelController.deleteReel);

module.exports = router;