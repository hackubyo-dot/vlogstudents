const db = require('../config/db');
const pointsService = require('../services/pointsService');

class SocialController {
    /**
     * POST /social/like
     */
    async toggleLike(req, res) {
        try {
            const { reelId } = req.body;

            const check = await db.query('SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2', [req.user.id, reelId]);

            if (check.rowCount > 0) {
                await db.query('DELETE FROM likes WHERE id = $1', [check.rows[0].id]);
                return res.json({ success: true, liked: false });
            } else {
                await db.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [req.user.id, reelId]);
                // Ganha 2 pontos por interagir
                await pointsService.addPoints(req.user.id, 2, 'Like em Reel', reelId);
                return res.json({ success: true, liked: true });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao processar like.' });
        }
    }

    /**
     * POST /social/comment
     */
    async addComment(req, res) {
        try {
            const { reelId, content } = req.body;
            const result = await db.query(
                'INSERT INTO comments (reel_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
                [reelId, req.user.id, content]
            );
            // Ganha 5 pontos por comentar
            await pointsService.addPoints(req.user.id, 5, 'Comentário em Reel', result.rows[0].id);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao comentar.' });
        }
    }

    /**
     * POST /social/follow
     */
    async toggleFollow(req, res) {
        try {
            const { targetId } = req.body;
            if (req.user.id == targetId) return res.status(400).json({ message: "Auto-follow não permitido." });

            const check = await db.query('SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, targetId]);

            if (check.rowCount > 0) {
                await db.query('DELETE FROM follows WHERE id = $1', [check.rows[0].id]);
                return res.json({ success: true, following: false });
            } else {
                await db.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [req.user.id, targetId]);
                return res.json({ success: true, following: true });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao seguir.' });
        }
    }
}

module.exports = new SocialController();