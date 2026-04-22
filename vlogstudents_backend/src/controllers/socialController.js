/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SOCIAL INTERACTIONS CONTROLLER
 * Likes, Comentários, Follows e Gestão de Engajamento Acadêmico
 * ============================================================================
 */
const db = require('../config/db');
const pointsService = require('../services/pointsService');
const { commentSchema } = require('../utils/validators');

class SocialController {
    /**
     * @route   POST /api/v1/social/like
     * @desc    Sistema de Toggle Like (Curtir/Descurtir) com contadores atômicos
     */
    async toggleLike(req, res) {
        const client = await db.getClient();
        try {
            const { reelId } = req.body;
            const userId = req.user.id;

            if (!reelId) return res.status(400).json({ success: false, message: 'ID do Reel é obrigatório.' });

            await client.query('BEGIN');

            // 1. Verificar se o Like já existe
            const checkLike = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [userId, reelId]
            );

            let isLiked = false;

            if (checkLike.rowCount > 0) {
                // 2. Remover Like (Unlike)
                await client.query('DELETE FROM likes WHERE id = $1', [checkLike.rows[0].id]);
                
                // 3. Decrementar contador no Reel
                await client.query(
                    'UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1',
                    [reelId]
                );
                isLiked = false;
            } else {
                // 4. Adicionar Like
                await client.query(
                    'INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)',
                    [userId, reelId]
                );
                
                // 5. Incrementar contador no Reel
                await client.query(
                    'UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1',
                    [reelId]
                );

                // 6. Recompensa Social: +5 Voices por interagir
                await pointsService.addPointsTransactional(client, userId, 5, 'Interação Social: Like em conteúdo', reelId);
                
                isLiked = true;
            }

            await client.query('COMMIT');

            return res.json({
                success: true,
                message: isLiked ? 'Conteúdo curtido.' : 'Curtida removida.',
                isLiked: isLiked
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_LIKE_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar interação de curtida.' });
        } finally {
            client.release();
        }
    }

    /**
     * @route   POST /api/v1/social/comment
     * @desc    Adiciona comentário e bonifica o autor da interação
     */
    async addComment(req, res) {
        const client = await db.getClient();
        try {
            // Validação de entrada
            const { reelId, content } = req.body;
            if (!content || content.length < 1) {
                return res.status(400).json({ success: false, message: 'O conteúdo do comentário não pode estar vazio.' });
            }

            await client.query('BEGIN');

            // 1. Inserir Comentário
            const commentResult = await client.query(
                `INSERT INTO comments (reel_id, user_id, content) 
                 VALUES ($1, $2, $3) 
                 RETURNING id, content, created_at`,
                [reelId, req.user.id, content]
            );

            const newComment = commentResult.rows[0];

            // 2. Atualizar contador no Reel
            await client.query(
                'UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1',
                [reelId]
            );

            // 3. Recompensa: +10 Voices por contribuir com a discussão
            await pointsService.addPointsTransactional(client, req.user.id, 10, 'Engajamento: Comentário acadêmico', newComment.id);

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Comentário publicado.',
                data: {
                    ...newComment,
                    user_name: req.user.full_name,
                    user_avatar: req.user.avatar_url
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_COMMENT_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Falha ao registrar comentário.' });
        } finally {
            client.release();
        }
    }

    /**
     * @route   GET /api/v1/social/comments/:reelId
     * @desc    Busca lista de comentários de um Reel (Paginado)
     */
    async getComments(req, res) {
        try {
            const { reelId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT c.*, u.full_name as user_name, u.avatar_url as user_avatar
                 FROM comments c
                 JOIN users u ON c.user_id = u.id
                 WHERE c.reel_id = $1
                 ORDER BY c.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [reelId, limit, offset]
            );

            return res.json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });
        } catch (error) {
            console.error('[SOCIAL_GET_COMMENTS_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro ao carregar comentários.' });
        }
    }

    /**
     * @route   POST /api/v1/social/follow
     * @desc    Sistema de Follow/Unfollow entre estudantes
     */
    async toggleFollow(req, res) {
        const client = await db.getClient();
        try {
            const { targetUserId } = req.body;
            const myId = req.user.id;

            if (myId == targetUserId) return res.status(400).json({ message: "Você não pode seguir a si mesmo." });

            await client.query('BEGIN');

            const checkFollow = await client.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [myId, targetUserId]
            );

            let following = false;

            if (checkFollow.rowCount > 0) {
                // Unfollow
                await client.query('DELETE FROM follows WHERE id = $1', [checkFollow.rows[0].id]);
                following = false;
            } else {
                // Follow
                await client.query(
                    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
                    [myId, targetUserId]
                );
                
                // Bônus por Networking: +15 Voices
                await pointsService.addPointsTransactional(client, myId, 15, 'Networking: Novo aluno seguido', targetUserId);
                
                following = true;
            }

            await client.query('COMMIT');

            return res.json({
                success: true,
                message: following ? 'Seguindo aluno.' : 'Deixou de seguir.',
                following: following
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[SOCIAL_FOLLOW_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar conexão social.' });
        } finally {
            client.release();
        }
    }
}

module.exports = new SocialController();
