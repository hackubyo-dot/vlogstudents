const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { reelSchema } = require('../utils/validators');

class ReelController {
    async create(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Ficheiro ausente.' });
            const { title, description, duration } = reelSchema.parse(req.body);
            const upload = await storageService.uploadFile(req.file, 'reels');
            const result = await db.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [req.user.id, upload.url, title, description, parseInt(duration || 0)]
            );
            await pointsService.addPoints(req.user.id, 50, 'Publicação de Reel', result.rows[0].id);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro no upload.' });
        }
    }

    async getById(req, res) {
        try {
            const result = await db.query(
                `SELECT r.*, u.full_name as author_name FROM reels r
                 JOIN users u ON r.author_id = u.id WHERE r.id = $1`, [req.params.id]
            );
            if (result.rowCount === 0) return res.status(404).json({ message: 'Não encontrado' });
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }

    async update(req, res) {
        try {
            const { title, description } = req.body;
            const result = await db.query(
                'UPDATE reels SET title = $1, description = $2 WHERE id = $3 AND author_id = $4 RETURNING *',
                [title, description, req.params.id, req.user.id]
            );
            if (result.rowCount === 0) return res.status(403).json({ message: 'Ação não permitida' });
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }

    async delete(req, res) {
        try {
            const result = await db.query('DELETE FROM reels WHERE id = $1 AND author_id = $2', [req.params.id, req.user.id]);
            if (result.rowCount === 0) return res.status(403).json({ message: 'Ação não permitida' });
            res.json({ success: true, message: 'Deletado.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }

    async getFeed(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;
            const result = await db.query(
                `SELECT r.*, u.full_name as author_name, u.avatar_url as author_picture, u.university_name as author_university,
                (SELECT COUNT(*) FROM likes WHERE reel_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE reel_id = r.id) as comments_count,
                EXISTS(SELECT 1 FROM likes WHERE reel_id = r.id AND user_id = $1) as is_liked
                FROM reels r JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
                [req.user.id, limit, offset]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }

    async incrementView(req, res) {
        try {
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [req.params.id]);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
}

module.exports = new ReelController();