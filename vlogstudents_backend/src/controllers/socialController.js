/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SOCIAL CONTROLLER v6.0.0 (FULL FINAL)
 * Likes | Comments | Follows | Transactions | Gamification | Performance
 * ============================================================================
 */

const db = require('../config/db');
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

            if (!reelId) {
                return res.status(400).json({
                    success: false,
                    message: 'reelId é obrigatório.'
                });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [userId, reelId]
            );

            let isLiked = false;

            if (check.rowCount > 0) {
                // ❌ UNLIKE
                await client.query(
                    'DELETE FROM likes WHERE id = $1',
                    [check.rows[0].id]
                );

                await client.query(
                    `UPDATE reels 
                     SET likes_count = GREATEST(0, likes_count - 1) 
                     WHERE id = $1`,
                    [reelId]
                );

                isLiked = false;

            } else {
                // ❤️ LIKE
                await client.query(
                    'INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)',
                    [userId, reelId]
                );

                await client.query(
                    `UPDATE reels 
                     SET likes_count = likes_count + 1 
                     WHERE id = $1`,
                    [reelId]
                );

                // 🎁 recompensa
                await pointsService.addPointsTransactional(
                    client,
                    userId,
                    5,
                    'Like em conteúdo',
                    reelId
                );

                isLiked = true;
            }

            await client.query('COMMIT');

            return res.json({
                success: true,
                isLiked,
                message: isLiked ? 'Curtido.' : 'Curtida removida.'
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[LIKE_ERROR]', error);

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
     * 💬 ADD COMMENT (TRANSACTION + VALIDAÇÃO + REWARD)
     * =========================================================================
     */
    async addComment(req, res) {
        const client = await db.getClient();

        try {
            const validated = commentSchema.safeParse(req.body);

            if (!validated.success) {
                return res.status(400).json({
                    success: false,
                    message: validated.error.errors[0].message
                });
            }

            const { reelId, content } = validated.data;

            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO comments (reel_id, user_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING id, content, created_at`,
                [reelId, req.user.id, content]
            );

            const comment = result.rows[0];

            await client.query(
                `UPDATE reels 
                 SET comments_count = comments_count + 1 
                 WHERE id = $1`,
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

            console.error('[COMMENT_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao comentar.'
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET COMMENTS (PAGINAÇÃO + PERFORMANCE)
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
                    c.id,
                    c.content,
                    c.created_at,
                    u.id as user_id,
                    u.full_name as user_name,
                    u.avatar_url as user_avatar
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
            console.error('[GET_COMMENTS_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar comentários.'
            });
        }
    }

    /**
     * =========================================================================
     * 🤝 TOGGLE FOLLOW (TRANSACTION + ANTI-SELF + REWARD)
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
                    message: 'targetUserId é obrigatório.'
                });
            }

            if (myId == targetUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Não podes seguir a ti mesmo.'
                });
            }

            await client.query('BEGIN');

            const check = await client.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [myId, targetUserId]
            );

            let following = false;

            if (check.rowCount > 0) {
                // ❌ UNFOLLOW
                await client.query(
                    'DELETE FROM follows WHERE id = $1',
                    [check.rows[0].id]
                );

                following = false;

            } else {
                // ✅ FOLLOW
                await client.query(
                    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
                    [myId, targetUserId]
                );

                // 🎁 recompensa
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
                message: following ? 'Seguindo usuário.' : 'Deixou de seguir.'
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[FOLLOW_ERROR]', error);

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
