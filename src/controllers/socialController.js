const db = require('../config/db');
const { commentSchema } = require('../utils/validators');

class SocialController {
    async toggleLike(req, res, next) {
        const client = await db.getClient();
        try {
            const { reelId } = req.body;
            await client.query('BEGIN');

            // 1. Verificar se já existe o like
            const check = await client.query(
                'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2',
                [req.user.id, reelId]
            );

            if (check.rowCount > 0) {
                // Remover Like
                await client.query('DELETE FROM likes WHERE id = $1', [check.rows[0].id]);
                await client.query('UPDATE reels SET likes_count = likes_count - 1 WHERE id = $1', [reelId]);
                await client.query('COMMIT');
                return res.json({ success: true, liked: false });
            } else {
                // Adicionar Like
                await client.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [req.user.id, reelId]);
                await client.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [reelId]);
                await client.query('COMMIT');
                return res.json({ success: true, liked: true });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    async addComment(req, res, next) {
        const client = await db.getClient();
        try {
            const { reelId, content } = req.body;
            commentSchema.parse({ content });

            await client.query('BEGIN');

            const result = await client.query(
                'INSERT INTO comments (reel_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
                [reelId, req.user.id, content]
            );

            await client.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);

            await client.query('COMMIT');
            res.status(201).json({ success: true, comment: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    async toggleFollow(req, res, next) {
        try {
            const { followingId } = req.body;
            if (req.user.id === followingId) return res.status(400).json({ message: "Não pode seguir a si mesmo" });

            const check = await db.query(
                'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
                [req.user.id, followingId]
            );

            if (check.rowCount > 0) {
                await db.query('DELETE FROM follows WHERE id = $1', [check.rows[0].id]);
                return res.json({ success: true, following: false });
            } else {
                await db.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [req.user.id, followingId]);
                return res.json({ success: true, following: true });
            }
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SocialController();