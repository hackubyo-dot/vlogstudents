/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SOCIAL CONTROLLER v8.0.0
 * LIKES | COMMENTS | AUDIO VOICES | REACTIONS | FOLLOWS | GAMIFICATION
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Hybrid Comments: Suporte nativo para Texto e Áudio (Vozes do Campus).
 * - Reaction Engine: Sistema de toggle para reações em comentários.
 * - Transactional Integrity: BEGIN/COMMIT/ROLLBACK em todas as operações críticas.
 * - Atomic Point Rewards: Recompensas automáticas via PointsService.
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { commentSchema } = require('../utils/validators');

class SocialController {

    /**
     * =========================================================================
     * ❤️ TOGGLE LIKE (TRANSACTION + CONSISTÊNCIA)
     * =========================================================================
     */
    async toggleLike(req, res) {
        const client = await db.getClient();
        try {
            const { reelId } = req.body;
            const userId = req.user.id;

            if (!reelId) return res.status(400).json({ success: false, message: 'reelId é obrigatório.' });

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [userId, reelId]
            );

            let isLiked = false;

            if (check.rowCount > 0) {
                // ❌ UNLIKE
                await client.query('DELETE FROM likes WHERE id = $1', [check.rows[0].id]);
                await client.query(
                    `UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`,
                    [reelId]
                );
                isLiked = false;
            } else {
                // ❤️ LIKE
                await client.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await client.query(`UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1`, [reelId]);

                // 🎁 Recompensa: 5 Pontos
                await pointsService.addPointsTransactional(client, userId, 5, 'Like em conteúdo', reelId);
                isLiked = true;
            }

            await client.query('COMMIT');
            return res.json({ success: true, isLiked });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_LIKE_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar like.' });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 💬 ADD COMMENT (TEXT & AUDIO VOICES)
     * FIX: Suporte a Áudio + Persistência Neon
     * =========================================================================
     */
    async addComment(req, res) {
        const client = await db.getClient();
        try {
            // Conversão de ID para Integer para evitar conflitos de tipos
            const reelId = parseInt(req.body.reelId);
            const content = req.body.content || "";
            const type = req.body.type || 'text'; // 'text' ou 'audio'
            const userId = req.user.id;

            if (!reelId) return res.status(400).json({ success: false, message: 'ID do Reel inválido.' });

            await client.query('BEGIN');
            
            let mediaUrl = null;

            // Engine de Upload para Vozes Acadêmicas (Áudio)
            if (req.file && type === 'audio') {
                const upload = await storageService.uploadFile(req.file, 'comments_audio');
                mediaUrl = upload.url;
            }

            const result = await client.query(
                `INSERT INTO comments (reel_id, user_id, content, type, media_url)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, content, type, media_url, created_at`,
                [reelId, userId, content, type, mediaUrl]
            );

            const comment = result.rows[0];

            // Atualiza contador no Reel
            await client.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);

            // 🎁 Recompensa: 15 Pontos (Voices ganham mais prestígio)
            await pointsService.addPointsTransactional(client, userId, 15, 'Voice de Áudio/Texto', comment.id);

            await client.query('COMMIT');
            
            return res.status(201).json({ 
                success: true, 
                data: { 
                    ...comment, 
                    user_name: req.user.full_name, 
                    user_avatar: req.user.avatar_url 
                } 
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_COMMENT_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Falha ao processar comentário.' });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET COMMENTS (WITH REACTIONS COUNT)
     * =========================================================================
     */
    async getComments(req, res) {
        try {
            const { reelId } = req.params;
            
            const result = await db.query(
                `SELECT 
                    c.*, 
                    u.full_name as user_name, 
                    u.avatar_url as user_avatar,
                    (SELECT COUNT(*) FROM comment_reactions WHERE comment_id = c.id) as reactions_count
                 FROM comments c 
                 JOIN users u ON c.user_id = u.id
                 WHERE c.reel_id = $1 
                 ORDER BY c.created_at DESC`, 
                [reelId]
            );

            return res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[GET_COMMENTS_ERROR]', error);
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🔥 TOGGLE REACTION (REACÇÕES EM COMENTÁRIOS)
     * =========================================================================
     */
    async toggleReaction(req, res) {
        try {
            const { commentId, reaction } = req.body;
            const userId = req.user.id;

            // Verifica se o aluno já reagiu
            const check = await db.query(
                'SELECT id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
                [commentId, userId]
            );

            if (check.rowCount > 0) {
                // Remove a reação existente
                await db.query('DELETE FROM comment_reactions WHERE id = $1', [check.rows[0].id]);
                return res.json({ success: true, action: 'removed' });
            } else {
                // Adiciona nova reação (🔥, 👏, 🧠, etc)
                await db.query(
                    'INSERT INTO comment_reactions (comment_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                    [commentId, userId, reaction]
                );
                return res.json({ success: true, action: 'added' });
            }
        } catch (error) {
            console.error('[REACTION_ERROR]', error);
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🤝 TOGGLE FOLLOW (TRANSACTION + ANTI-SELF)
     * =========================================================================
     */
    async toggleFollow(req, res) {
        const client = await db.getClient();
        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (!targetUserId || myId == targetUserId) {
                return res.status(400).json({ success: false, message: 'Operação inválida.' });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [myId, targetUserId]
            );

            let following = false;

            if (check.rowCount > 0) {
                await client.query('DELETE FROM follows WHERE id = $1', [check.rows[0].id]);
                following = false;
            } else {
                await client.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [myId, targetUserId]);
                // 🎁 Recompensa: 15 Pontos por Networking
                await pointsService.addPointsTransactional(client, myId, 15, 'Novo Follow', targetUserId);
                following = true;
            }

            await client.query('COMMIT');
            return res.json({ success: true, following });

        } catch (error) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }
}

module.exports = new SocialController();
