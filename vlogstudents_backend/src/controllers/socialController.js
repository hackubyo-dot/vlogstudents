/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SOCIAL CONTROLLER v10.0.0 (ULTIMATE STABLE)
 * LIKES | HYBRID COMMENTS | REACTIONS | FOLLOWS | POINT SYNC
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo e Resiliência:
 * - Atomic Comments: Inserção explícita de [user_id] e metadados de mídia.
 * - Zod Kernel: Coerção automática de tipos para IDs e validação de esquema.
 * - Transactional Points: Sincronização garantida entre interação e economia.
 * - Reaction Engine: Gestão de feedback social (🔥, 👏, 🧠) em discussões.
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { commentSchema } = require('../utils/validators');

class SocialController {

    /**
     * =========================================================================
     * ❤️ TOGGLE LIKE (TRANSACTION + ECONOMY SYNC)
     * =========================================================================
     */
    async toggleLike(req, res) {
        const client = await db.getClient();
        try {
            const { reelId } = req.body;
            const userId = req.user.id;

            if (!reelId) {
                return res.status(400).json({ success: false, message: 'ID do Reel é obrigatório.' });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [userId, reelId]
            );

            let liked = false;

            if (check.rowCount > 0) {
                // ❌ REMOVER CURTIDA
                await client.query('DELETE FROM likes WHERE id = $1', [check.rows[0].id]);
                await client.query(
                    `UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`,
                    [reelId]
                );
            } else {
                // ❤️ ADICIONAR CURTIDA
                await client.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await client.query(`UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1`, [reelId]);

                // 🎁 Recompensa: 5 Pontos
                await pointsService.addPointsTransactional(client, userId, 5, 'Like em conteúdo', reelId);
                liked = true;
            }

            await client.query('COMMIT');
            return res.json({ success: true, isLiked: liked });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_LIKE_ERROR]', error.message);
            return res.status(500).json({ success: false, message: 'Erro ao processar interação social.' });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 💬 ADD COMMENT (TEXT & AUDIO VOICES)
     * FIX: Integridade de User_ID e Sincronização de Pontos
     * =========================================================================
     */
    async addComment(req, res) {
        const client = await db.getClient();
        try {
            // Validação via Zod com coerção de tipos
            const validated = commentSchema.parse(req.body);
            const { reelId, content, type } = validated;
            const userId = req.user.id;

            await client.query('BEGIN');
            
            let mediaUrl = null;

            // Engine de Upload para Vozes de Áudio
            if (req.file && type === 'audio') {
                const upload = await storageService.uploadFile(req.file, 'comments_audio');
                mediaUrl = upload.url;
            }

            // Inserção atômica garantindo a relação com o usuário
            const result = await client.query(
                `INSERT INTO comments (reel_id, user_id, content, type, media_url)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, content, type, media_url, created_at`,
                [reelId, userId, content || "", type, mediaUrl]
            );

            const comment = result.rows[0];

            // Sincronização de métricas no Reel
            await client.query(
                'UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', 
                [reelId]
            );
            
            // 🎁 Recompensa Acadêmica: 10 Pontos por Voice
            await pointsService.addPointsTransactional(client, userId, 10, 'Voice de Engajamento', comment.id);

            await client.query('COMMIT');
            
            return res.status(201).json({ 
                success: true, 
                data: { 
                    ...comment, 
                    user_name: req.user.full_name, 
                    user_avatar: req.user.avatar_url,
                    reactions_count: 0
                } 
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_COMMENT_FATAL]', error.message);
            return res.status(400).json({ 
                success: false, 
                message: 'Erro crítico ao salvar sua Voice. Verifique os dados.' 
            });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET COMMENTS (REAL-TIME SYNC)
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
            console.error('[GET_COMMENTS_ERROR]', error.message);
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🔥 TOGGLE REACTION (FEEDBACK SOCIAL EM COMENTÁRIOS)
     * =========================================================================
     */
    async toggleReaction(req, res) {
        try {
            const { commentId, reaction } = req.body;
            const userId = req.user.id;

            const check = await db.query(
                'SELECT id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
                [commentId, userId]
            );

            if (check.rowCount > 0) {
                // Remover reação existente
                await db.query('DELETE FROM comment_reactions WHERE id = $1', [check.rows[0].id]);
                return res.json({ success: true, action: 'removed' });
            } else {
                // Adicionar nova reação (🔥, 👏, 🧠)
                await db.query(
                    'INSERT INTO comment_reactions (comment_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                    [commentId, userId, reaction]
                );
                return res.json({ success: true, action: 'added' });
            }
        } catch (error) {
            console.error('[REACTION_ERROR]', error.message);
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🤝 TOGGLE FOLLOW (NETWORKING HUB)
     * =========================================================================
     */
    async toggleFollow(req, res) {
        const client = await db.getClient();
        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (myId == targetUserId) {
                return res.status(400).json({ success: false, message: 'Operação de auto-seguimento inválida.' });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [myId, targetUserId]
            );

            let following = false;

            if (check.rowCount > 0) {
                // ❌ DEIXAR DE SEGUIR
                await client.query('DELETE FROM follows WHERE id = $1', [check.rows[0].id]);
            } else {
                // ✅ SEGUIR ESTUDANTE
                await client.query(
                    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
                    [myId, targetUserId]
                );
                // 🎁 Recompensa Networking: 15 Pontos
                await pointsService.addPointsTransactional(client, myId, 15, 'Networking: Follow', targetUserId);
                following = true;
            }

            await client.query('COMMIT');
            return res.json({ success: true, following });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[FOLLOW_ERROR]', error.message);
            return res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    }
}

module.exports = new SocialController();
