/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REEL CONTROLLER v6.0.0 (FULL FINAL)
 * VIDEO PIPELINE + FEED + PROFILE + METRICS + ECONOMY + PERFORMANCE
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { reelSchema } = require('../utils/validators');

class ReelController {

    /**
     * =========================================================================
     * 🚀 CREATE REEL (UPLOAD + TRANSACTION + REWARD)
     * =========================================================================
     */
    async create(req, res) {
        const client = await db.getClient();

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Arquivo de vídeo obrigatório.'
                });
            }

            const validated = reelSchema.safeParse(req.body);
            if (!validated.success) {
                return res.status(400).json({
                    success: false,
                    message: validated.error.errors[0].message
                });
            }

            const { title, description, duration } = validated.data;

            console.log(`[REEL_CREATE] User ${req.user.id}`);

            const upload = await storageService.uploadFile(req.file, 'reels');

            if (!upload?.url) {
                throw new Error('Falha no upload do vídeo.');
            }

            await client.query('BEGIN');

            const result = await client.query(
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

            const reel = result.rows[0];

            // 🎁 recompensa
            await pointsService.addPointsTransactional(
                client,
                req.user.id,
                75,
                'Publicação de Reel',
                reel.id
            );

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Reel publicado com sucesso.',
                data: reel
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[REEL_CREATE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao publicar reel.',
                error: error.message
            });

        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 📥 FEED GLOBAL (PAGINADO + OTIMIZADO)
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

                    r.likes_count,
                    r.comments_count,

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
     * 👤 REELS DO USUÁRIO (SUPORTE "me")
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
     * 🔍 GET REEL BY ID
     * =========================================================================
     */
    async getById(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT 
                    r.*,
                    u.full_name AS author_name,
                    u.avatar_url AS author_picture,
                    u.university_name AS author_university
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
     * ✏️ UPDATE REEL
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
                    message: 'Não autorizado.'
                });
            }

            return res.json({
                success: true,
                message: 'Reel atualizado.',
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
     * 👁 VIEW TRACK (ANTI-SPAM READY)
     * =========================================================================
     */
    async incrementView(req, res) {
        try {
            const { id } = req.params;

            await db.query(
                `UPDATE reels 
                 SET views_count = views_count + 1 
                 WHERE id = $1`,
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
     * 🗑 DELETE (SOFT DELETE ENTERPRISE)
     * =========================================================================
     */
    async delete(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `UPDATE reels 
                 SET is_active = false, updated_at = NOW()
                 WHERE id = $1 AND author_id = $2
                 RETURNING id`,
                [id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Não autorizado ou inexistente.'
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
