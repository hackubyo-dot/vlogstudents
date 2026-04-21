/**
 * ============================================================================
 * VLOGSTUDENTS REEL PIPELINE ROUTES v4.0.0
 * MAPEAMENTO DE ENDPOINTS DE VÍDEO E ENGAJAMENTO
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadMiddleware = require('../middlewares/uploadMiddleware');

/**
 * PREFIXO: /api/v1/reels
 */

// --- GERENCIAMENTO DE FEED E CONTEÚDO ---

// Recuperar Feed Principal
router.get('/', authMiddleware, reelController.getFeed);

// Publicar Novo Reel (Multipart Form Data)
router.post('/upload', authMiddleware, uploadMiddleware.single('file'), reelController.publishReel);

// --- INTERAÇÕES SOCIAIS ---

// Curtir/Descurtir
router.post('/:id/like', authMiddleware, reelController.toggleLike);

// Comentários (Busca e Inserção)
router.get('/:id/comments', authMiddleware, reelController.getComments);
router.post('/:id/comments', authMiddleware, reelController.addComment);

// Engajamento (Views, Shares, Reposts)
router.post('/:id/view', authMiddleware, reelController.trackView);
router.post('/:id/share', authMiddleware, reelController.repost); // Sincronizado com o Controller

// --- GESTÃO DE CONTEÚDO ---

// Deletar Reel
router.delete('/:id', authMiddleware, reelController.deleteReel);

module.exports = router;
