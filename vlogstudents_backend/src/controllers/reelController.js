/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REEL CONTROLLER v4.0.0 (FINAL)
 * VIDEO PIPELINE + SUPABASE + NEON + ECONOMY SYSTEM
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
            // ===============================
            // 🔍 VALIDAÇÃO INICIAL
            // ===============================
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'O arquivo de vídeo é obrigatório.'
                });
            }

            // Validação com Zod
            const validated = reelSchema.parse(req.body);
            const { title, description, duration } = validated;

            console.log(`[REEL] Upload iniciado por user ${req.user.id}`);

            // ===============================
            // 📤 UPLOAD PARA SUPABASE
            // ===============================
            const upload = await storageService.uploadFile(req.file, 'reels');

            if (!upload || !upload.url) {
                throw new Error('Falha ao obter URL pública do vídeo.');
            }

            // ===============================
            // 🔐 TRANSAÇÃO BANCO (NEON)
            // ===============================
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

            // ===============================
            // 💰 SISTEMA DE RECOMPENSA
            // ===============================
            await pointsService.addPointsTransactional(
                client,
                req.user.id,
                75,
                'Publicação de Reel',
                newReel.id
            );

            await client.query('COMMIT');

            console.log(`[REEL SUCCESS] Reel ${newReel.id} criado`);

            return res.status(201).json({
                success: true,
                message: 'Reel publicado com sucesso.',
                data: newReel
            });

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[REEL CREATE ERROR]', error);

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
     * Feed paginado com métricas e estado do usuário
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
            console.error('[REEL FEED ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar feed.'
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
            console.error('[REEL GET ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar reel.'
            });
        }
    }

    /**
     * =========================================================================
     * 👁 POST /api/v1/reels/:id/view
     * =========================================================================
     */
    async trackView(req, res) {
        try {
            const { id } = req.params;

            await db.query(
                'UPDATE reels SET views_count = views_count + 1 WHERE id = $1',
                [id]
            );

            return res.json({ success: true });

        } catch (error) {
            console.error('[REEL VIEW ERROR]', error);

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
            console.error('[REEL DELETE ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao remover reel.'
            });
        }
    }
}

module.exports = new ReelController();
