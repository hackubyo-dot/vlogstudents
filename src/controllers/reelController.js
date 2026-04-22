const db = require('../config/db');
const storageService = require('../services/storageService');
const { reelSchema } = require('../utils/validators');

class ReelController {
    async create(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'O arquivo de vídeo é obrigatório.' });
            }

            const { title, description } = reelSchema.parse(req.body);

            // 1. Upload do vídeo para Supabase Storage
            const uploadResult = await storageService.uploadFile(req.file, 'reels');

            // 2. Salvar metadados no Neon
            const result = await db.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [req.user.id, uploadResult.url, title, description]
            );

            // 3. Sistema de Pontos: +10 pontos por postar um Reel
            await db.query(
                'UPDATE users SET points_total = points_total + 10 WHERE id = $1',
                [req.user.id]
            );

            await db.query(
                'INSERT INTO point_transactions (user_id, amount, reason) VALUES ($1, 10, $2)',
                [req.user.id, 'Publicação de Reel']
            );

            res.status(201).json({
                success: true,
                reel: result.rows[0]
            });
        } catch (error) {
            next(error);
        }
    }

    async getFeed(req, res, next) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT r.*, u.full_name as author_name, u.avatar_url as author_avatar
                 FROM reels r
                 JOIN users u ON r.author_id = u.id
                 WHERE r.is_active = true
                 ORDER BY r.created_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );

            res.json({
                success: true,
                page: parseInt(page),
                count: result.rowCount,
                reels: result.rows
            });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const { id } = req.params;
            const result = await db.query(
                `SELECT r.*, u.full_name as author_name FROM reels r
                 JOIN users u ON r.author_id = u.id WHERE r.id = $1`,
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Reel não encontrado.' });
            }

            res.json({ success: true, reel: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.params;

            // Verificar propriedade
            const check = await db.query('SELECT author_id FROM reels WHERE id = $1', [id]);
            if (check.rowCount === 0) return res.status(404).json({ message: 'Não encontrado' });

            if (check.rows[0].author_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Sem permissão.' });
            }

            await db.query('DELETE FROM reels WHERE id = $1', [id]);
            res.json({ success: true, message: 'Reel removido.' });
        } catch (error) {
            next(error);
        }
    }

    async incrementView(req, res, next) {
        try {
            const { id } = req.params;
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ReelController();