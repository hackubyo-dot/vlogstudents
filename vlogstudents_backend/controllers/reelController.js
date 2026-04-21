/**
 * ============================================================================
 * VLOGSTUDENTS MASTER REEL CONTROLLER v2.0.0
 * ENGINE DE CONTEÚDO, DISTRIBUIÇÃO E ALGORITMO DE FEED
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');
const { io } = require('../../server');

const reelController = {

    /**
     * Algoritmo de Distribuição do Feed (Infinite Scroll)
     */
    getFeed: async (req, res) => {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user ? req.user.id : null;

        try {
            // Query complexa para retornar Reels com status de Like do usuário logado
            const query = `
                SELECT
                    r.id as reel_identification,
                    r.author_id as reel_author_user_id,
                    u.full_name as author_name,
                    u.avatar_url as author_picture,
                    u.university_name as author_university,
                    r.drive_file_id as reel_google_drive_file_id,
                    r.title as reel_title_text,
                    r.description as reel_description_content,
                    r.duration as reel_duration_seconds,
                    r.thumbnail_id as reel_thumbnail_drive_id,
                    r.views_count as reel_views_count_total,
                    r.likes_count as reel_likes_count_total,
                    r.comments_count as reel_comments_count_total,
                    r.reposts_count as reel_reposts_count_total,
                    r.created_at as reel_created_at_timestamp,
                    EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = r.id) as is_liked,
                    EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND reel_id = r.id) as is_reposted
                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            res.status(200).json({
                success: true,
                data: result.rows,
                page: parseInt(page),
                count: result.rows.length
            });

        } catch (error) {
            console.error('[REEL_FEED_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Erro ao carregar ecossistema de vídeos.' });
        }
    },

    /**
     * Publicação de Conteúdo (Upload de Reel)
     * Implementa ganho de Voices automático
     */
    publishReel: async (req, res) => {
        const userId = req.user.id;
        const { title, description, duration } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Nenhum vídeo detectado no stream.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[REEL_UPLOAD] Processando novo Reel para UID: ${userId}`);

            // 1. Upload do vídeo para Google Drive Cluster
            const driveFileId = await driveService.uploadFile(file, `REEL_U${userId}_${Date.now()}`);

            // 2. Inserção do Registro do Reel
            const reelQuery = `
                INSERT INTO reels (author_id, drive_file_id, title, description, duration, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING id
            `;
            const reelRes = await client.query(reelQuery, [userId, driveFileId, title, description, duration]);
            const newReelId = reelRes.rows[0].id;

            // 3. Sistema de Recompensa (+50 Voices por postagem)
            const pointsBonus = 50;
            await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [pointsBonus, userId]);

            // Registra transação de bônus
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                [userId, pointsBonus, 'REEL_POST', newReelId]
            );

            await client.query('COMMIT');

            // 4. Notificação Global via Socket (Feed Update)
            io.emit('new_reel_published', {
                reelId: newReelId,
                author: req.user.fullName
            });

            res.status(201).json({
                success: true,
                message: 'Seu conteúdo está no ar! +50 Voices creditados.',
                data: { reelId: newReelId, fileId: driveFileId }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REEL_PUBLISH_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Falha ao processar publicação.' });
        } finally {
            client.release();
        }
    },

    /**
     * Lógica de Like/Unlike Otimista
     */
    toggleLike: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;

        try {
            const checkLike = await db.query('SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);

            if (checkLike.rows.length > 0) {
                // Remover Like
                await db.query('DELETE FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = likes_count - 1 WHERE id = $1', [reelId]);
                return res.status(200).json({ success: true, action: 'unliked' });
            } else {
                // Adicionar Like
                await db.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [reelId]);

                // Recompensa pequena por interação (+1 Voice)
                await db.query('UPDATE users SET points_total = points_total + 1 WHERE id = $1', [userId]);

                return res.status(200).json({ success: true, action: 'liked' });
            }
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Gestão de Comentários
     */
    addComment: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        const { text, parentId } = req.body;

        try {
            const query = `
                INSERT INTO comments (reel_id, author_id, content, parent_node_id, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id, content, created_at
            `;
            const result = await db.query(query, [reelId, userId, text, parentId]);

            await db.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);

            res.status(201).json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Registro de Visualização (Algoritmo de Engajamento)
     */
    trackView: async (req, res) => {
        const reelId = req.params.id;
        try {
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [reelId]);
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = reelController;