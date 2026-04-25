/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REEL CONTROLLER v7.0.0 (FINAL PERSISTENCE)
 * VIDEO PIPELINE + FEED INTEGRITY + SOCIAL SYNC + ECONOMY
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Smart Feed Engine: SQL Master Query com subqueries para métricas reais.
 * - Follow Relationship Sync: Verificação atômica de amizade autor/visitante.
 * - Transactional Integrity: BEGIN/COMMIT/ROLLBACK para criação e pontos.
 * - Soft Delete Enterprise: Preservação de dados para auditoria.
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { reelSchema } = require('../utils/validators');

class ReelController {

    /**
     * =========================================================================
     * 📥 GET FEED (DYNAMIC PERSISTENCE)
     * FIX: Suporte real para 'is_followed' e 'is_liked' dinâmico
     * =========================================================================
     */
    async getFeed(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const myUserId = req.user.id;

            // QUERY MASTER: Sincronização de Dados Sociais em tempo real
            const result = await db.query(
                `SELECT 
                    r.*,
                    u.full_name AS author_name,
                    u.avatar_url AS author_picture,
                    u.university_name AS author_university,

                    -- Contagem atômica de interações
                    (SELECT COUNT(*) FROM likes WHERE reel_id = r.id) AS likes_count,
                    (SELECT COUNT(*) FROM comments WHERE reel_id = r.id) AS comments_count,

                    -- Verificação de estado para o utilizador logado
                    EXISTS(
                        SELECT 1 FROM likes 
                        WHERE reel_id = r.id AND user_id = $1
                    ) AS is_liked,

                    EXISTS(
                        SELECT 1 FROM follows 
                        WHERE follower_id = $1 AND following_id = r.author_id
                    ) AS is_followed

                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3`,
                [myUserId, limit, offset]
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
                message: 'Erro ao carregar feed persistente.'
            });
        }
    }

    /**
     * =========================================================================
     * 🚀 CREATE REEL (UPLOAD + TRANSACTION + REWARD)
     * =========================================================================
     */
    async create(req, res) {
        const client = await db.getClient();
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Vídeo obrigatório.' });
            }

            const validated = reelSchema.safeParse(req.body);
            if (!validated.success) {
                return res.status(400).json({ 
                    success: false, 
                    message: validated.error.errors[0].message 
                });
            }

            const { title, description, duration } = validated.data;

            // Upload via Storage Service (Supabase/S3)
            const upload = await storageService.uploadFile(req.file, 'reels');
            if (!upload?.url) throw new Error('Falha no upload do binário.');

            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration)
                VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [req.user.id, upload.url, title, description, parseInt(duration || 0)]
            );

            const reel = result.rows[0];

            // 🎁 Recompensa Acadêmica (Points Engine)
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
            return res.status(500).json({ success: false, message: 'Erro ao criar reel.' });
        } finally {
            client.release();
        }
    }

    /**
     * =========================================================================
     * 👤 GET USER REELS
     * =========================================================================
     */
    async getUserReels(req, res) {
        try {
            let targetUserId = req.params.userId === 'me' ? req.user.id : req.params.userId;

            const result = await db.query(
                `SELECT 
                    r.*, 
                    u.full_name AS author_name, 
                    u.avatar_url AS author_picture,
                    EXISTS(
                        SELECT 1 FROM follows 
                        WHERE follower_id = $2 AND following_id = r.author_id
                    ) as is_followed
                FROM reels r 
                JOIN users u ON r.author_id = u.id
                WHERE r.author_id = $1 AND r.is_active = true 
                ORDER BY r.created_at DESC`,
                [targetUserId, req.user.id]
            );

            return res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[REEL_USER_ERROR]', error);
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🔍 GET BY ID
     * =========================================================================
     */
    async getById(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    r.*, 
                    u.full_name AS author_name 
                FROM reels r 
                JOIN users u ON r.author_id = u.id 
                WHERE r.id = $1`,
                [req.params.id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Reel inexistente.' });
            }

            return res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 👁️ VIEW ENGINE
     * =========================================================================
     */
    async incrementView(req, res) {
        try {
            await db.query(
                'UPDATE reels SET views_count = views_count + 1 WHERE id = $1', 
                [req.params.id]
            );
            return res.json({ success: true });
        } catch (e) {
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * ✏️ UPDATE METADATA
     * =========================================================================
     */
    async update(req, res) {
        try {
            const { title, description } = req.body;
            const result = await db.query(
                `UPDATE reels 
                 SET title = COALESCE($1, title), 
                     description = COALESCE($2, description),
                     updated_at = NOW()
                 WHERE id = $3 AND author_id = $4 
                 RETURNING *`,
                [title, description, req.params.id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({ success: false, message: 'Não autorizado.' });
            }

            return res.json({ success: true, data: result.rows[0] });
        } catch (e) {
            return res.status(500).json({ success: false });
        }
    }

    /**
     * =========================================================================
     * 🗑️ SOFT DELETE
     * =========================================================================
     */
    async delete(req, res) {
        try {
            const result = await db.query(
                'UPDATE reels SET is_active = false WHERE id = $1 AND author_id = $2 RETURNING id',
                [req.params.id, req.user.id]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({ success: false, message: 'Não autorizado ou já removido.' });
            }

            return res.json({ success: true, message: 'Reel arquivado.' });
        } catch (e) {
            return res.status(500).json({ success: false });
        }
    }
}

module.exports = new ReelController();
