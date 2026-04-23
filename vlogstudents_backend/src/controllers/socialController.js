/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SOCIAL INTERACTIONS CONTROLLER v5.0.0 (FINAL)
 * Likes | Comentários | Follows | Gamificação | Consistência Transacional
 * ============================================================================
 */

const db = require('../config/db');
const pointsService = require('../services/pointsService');
const { commentSchema } = require('../utils/validators');

class SocialController {

    /**
     * =========================================================================
     * ❤️ POST /api/v1/social/like
     * Toggle Like com consistência + recompensa
     * =========================================================================
     */
    async toggleLike(req, res) {
        const client = await db.getClient();

        try {
            const { reelId } = req.body;
            const userId = req.user.id;

            if (!reelId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do Reel é obrigatório.'
                });
            }

            await client.query('BEGIN');

            // Verifica se já curtiu
            const check = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [userId, reelId]
            );

            let isLiked = false;

            if (check.rowCount > 0) {
                // UNLIKE
                await client.query(
                    'DELETE FROM likes WHERE id = $1',
                    [check.rows[0].id]
                );

                await client.query(
                    'UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
                    [reelId]
                );

                isLiked = false;

            } else {
                // LIKE
                await client.query(
                    'INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)',
                    [userId, reelId]
                );

                await client.query(
                    'UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1',
                    [reelId]
                );

                // 🎁 recompensa
                await pointsService.addPointsTransactional(
                    client,
                    userId,
                    5,
                    'Interação: Like',
                    reelId
                );

                isLiked = true;
            }

            await client.query('COMMIT');

            return res.json({
                success: true,
                isLiked,
                message: isLiked ? 'Curtido com sucesso.' : 'Curtida removida.'
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[SOCIAL_LIKE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao processar like.'
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 💬 POST /api/v1/social/comment
     * Criação de comentário com validação + recompensa
     * =========================================================================
     */
    async addComment(req, res) {
        const client = await db.getClient();

        try {
            // 🔒 validação com schema
            const validated = commentSchema.parse(req.body);
            const { reelId, content } = validated;

            await client.query('BEGIN');

            // Inserir comentário
            const result = await client.query(
                `INSERT INTO comments (reel_id, user_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING id, content, created_at`,
                [reelId, req.user.id, content]
            );

            const comment = result.rows[0];

            // Atualizar contador
            await client.query(
                'UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1',
                [reelId]
            );

            // 🎁 recompensa
            await pointsService.addPointsTransactional(
                client,
                req.user.id,
                10,
                'Comentário criado',
                comment.id
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Comentário publicado.',
                data: {
                    ...comment,
                    user_name: req.user.full_name,
                    user_avatar: req.user.avatar_url
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[SOCIAL_COMMENT_ERROR]', error);

            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Erro ao adicionar comentário.'
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET /api/v1/social/comments/:reelId
     * Lista comentários (paginado)
     * =========================================================================
     */
    async getComments(req, res) {
        try {
            const { reelId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT 
                    c.*,
                    u.full_name AS user_name,
                    u.avatar_url AS user_avatar
                 FROM comments c
                 JOIN users u ON c.user_id = u.id
                 WHERE c.reel_id = $1
                 ORDER BY c.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [reelId, limit, offset]
            );

            return res.json({
                success: true,
                page,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[SOCIAL_GET_COMMENTS_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar comentários.'
            });
        }
    }

    /**
     * =========================================================================
     * 🤝 POST /api/v1/social/follow
     * Follow / Unfollow com recompensa
     * =========================================================================
     */
    async toggleFollow(req, res) {
        const client = await db.getClient();

        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (!targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do usuário alvo é obrigatório.'
                });
            }

            if (myId == targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Não pode seguir a si mesmo.'
                });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [myId, targetUserId]
            );

            let following = false;

            if (check.rowCount > 0) {
                // UNFOLLOW
                await client.query(
                    'DELETE FROM follows WHERE id = $1',
                    [check.rows[0].id]
                );

                following = false;

            } else {
                // FOLLOW
                await client.query(
                    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
                    [myId, targetUserId]
                );

                // 🎁 recompensa networking
                await pointsService.addPointsTransactional(
                    client,
                    myId,
                    15,
                    'Novo follow',
                    targetUserId
                );

                following = true;
            }

            await client.query('COMMIT');

            return res.json({
                success: true,
                following,
                message: following ? 'Agora estás a seguir.' : 'Deixaste de seguir.'
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[SOCIAL_FOLLOW_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao processar follow.'
            });

        } finally {
            client.release();
        }
    }
}

module.exports = new SocialController();
