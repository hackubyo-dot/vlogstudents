/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REEL CONTROLLER v5.0.0
 * VIDEO PIPELINE + USER FEED + PROFILE REELS + ECONOMY SYSTEM
 * ============================================================================ 
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { reelSchema } = require('../utils/validators');

class ReelController {

    /**
     * =========================================================================
     * 🚀 POST /api/v1/reels/create
     * Upload + DB Transaction + Reward System
     * =========================================================================
     */
    async create(req, res) {
        const client = await db.getClient();

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'O arquivo de vídeo é obrigatório.'
                });
            }

            const validated = reelSchema.parse(req.body);
            const { title, description, duration } = validated;

            console.log(`[REEL] Upload iniciado por user ${req.user.id}`);

            // Upload Supabase
            const upload = await storageService.uploadFile(req.file, 'reels');

            if (!upload?.url) {
                throw new Error('Falha ao obter URL pública do vídeo.');
            }

            // TRANSAÇÃO
            await client.query('BEGIN');

            const insertResult = await client.query(
                `INSERT INTO reels 
                (author_id, drive_file_id, title, description, duration)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
                [
                    req.user.id,
                    upload.url,
                    title || 'Sem título',
                    description || '',
                    parseInt(duration || 0)
                ]
            );

            const newReel = insertResult.rows[0];

            // Sistema de pontos
            await pointsService.addPointsTransactional(
                client,
                req.user.id,
                75,
                'Publicação de Reel',
                newReel.id
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Reel publicado com sucesso.',
                data: newReel
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[REEL_CREATE_ERROR]', error);

            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Erro interno ao publicar reel.',
                details: error.message
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 GET /api/v1/reels
     * Feed global paginado
     * =========================================================================
     */
    async getFeed(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT 
                    r.*,
                    u.full_name AS author_name,
                    u.avatar_url AS author_picture,
                    u.university_name AS author_university,

                    (SELECT COUNT(*) FROM likes WHERE reel_id = r.id) AS likes_count,
                    (SELECT COUNT(*) FROM comments WHERE reel_id = r.id) AS comments_count,

                    EXISTS(
                        SELECT 1 FROM likes 
                        WHERE reel_id = r.id AND user_id = $1
                    ) AS is_liked

                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3`,
                [req.user.id, limit, offset]
            );

            return res.json({
                success: true,
                page,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[REEL_FEED_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar feed.'
            });
        }
    }

    /**
     * =========================================================================
     * 👤 GET /api/v1/reels/user/:userId
     * Reels do perfil (FIX: aceita "me")
     * =========================================================================
     */
    async getUserReels(req, res) {
        try {
            let userId = req.params.userId;

            if (userId === 'me') {
                userId = req.user.id;
            }

            const result = await db.query(
                `SELECT 
                    r.*,
                    u.full_name AS author_name,
                    u.avatar_url AS author_picture
                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.author_id = $1 AND r.is_active = true
                ORDER BY r.created_at DESC`,
                [userId]
            );

            return res.json({
                success: true,
                count: result.rowCount,
                data: result.rows
            });

        } catch (error) {
            console.error('[REEL_USER_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar reels do usuário.'
            });
        }
    }

    /**
     * =========================================================================
     * 🔍 GET /api/v1/reels/:id
     * =========================================================================
     */
    async getById(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    r.*, 
                    u.full_name AS author_name,
                    u.avatar_url AS author_picture
                 FROM reels r
                 JOIN users u ON r.author_id = u.id
                 WHERE r.id = $1`,
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel não encontrado.'
                });
            }

            return res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[REEL_GET_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar reel.'
            });
        }
    }

    /**
     * =========================================================================
     * ✏️ PATCH /api/v1/reels/update/:id
     * =========================================================================
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { title, description } = req.body;

            const result = await db.query(
                `UPDATE reels 
                 SET 
                    title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    updated_at = NOW()
                 WHERE id = $3 AND author_id = $4
                 RETURNING *`,
                [title, description, id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Não autorizado ou reel inexistente.'
                });
            }

            return res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[REEL_UPDATE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao atualizar reel.'
            });
        }
    }

    /**
     * =========================================================================
     * 👁 POST /api/v1/reels/:id/view
     * =========================================================================
     */
    async incrementView(req, res) {
        try {
            const { id } = req.params;

            await db.query(
                'UPDATE reels SET views_count = views_count + 1 WHERE id = $1',
                [id]
            );

            return res.json({ success: true });

        } catch (error) {
            console.error('[REEL_VIEW_ERROR]', error);

            return res.status(500).json({
                success: false
            });
        }
    }

    /**
     * =========================================================================
     * 🗑 DELETE /api/v1/reels/delete/:id
     * =========================================================================
     */
    async delete(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `DELETE FROM reels 
                 WHERE id = $1 AND author_id = $2 
                 RETURNING id`,
                [id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Não autorizado ou reel inexistente.'
                });
            }

            return res.json({
                success: true,
                message: 'Reel removido com sucesso.'
            });

        } catch (error) {
            console.error('[REEL_DELETE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao remover reel.'
            });
        }
    }
}

module.exports = new ReelController();
