/**
 * ============================================================================
 * VLOGSTUDENTS MASTER REEL CONTROLLER v2.0.2
 * ALGORITMO DE DISTRIBUIÇÃO, UPLOAD BINÁRIO E GESTÃO DE RECOMPENSAS
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const reelController = {

    /**
     * Feed Algorithm (Infinite Scroll dinâmico)
     * Sincronizado com FeedProvider do Flutter
     */
    getFeed: async (req, res) => {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        try {
            console.log(`[FEED_ENGINE] Gerando feed para Aluno UID: ${userId} (Página: ${page})`);

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
                    r.views_count as reel_views_count_total,
                    r.likes_count as reel_likes_count_total,
                    r.comments_count as reel_comments_count_total,
                    r.reposts_count as reel_reposts_count_total,
                    r.created_at as reel_created_at_timestamp,
                    EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = r.id) as is_liked,
                    EXISTS(SELECT 1 FROM point_transactions WHERE user_id = $1 AND reference_id = r.id AND reason = 'REPOST_REWARD') as is_reposted
                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            res.status(200).json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });

        } catch (error) {
            console.error('[FEED_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Falha ao processar stream de vídeo.' });
        }
    },

    /**
     * Protocolo de Publicação de Reel
     * Integração atômica: Drive -> DB -> Voices Bonus
     */
    publishReel: async (req, res) => {
        const userId = req.user.id;
        const { title, description, duration } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Stream binário de vídeo ausente.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[REEL_ENGINE] Upload iniciado por UID: ${userId}`);

            // 1. Upload para Google Drive Cluster
            const driveFileId = await driveService.uploadFile(file, `REEL_ACADEMIC_U${userId}_${Date.now()}`);

            // 2. Registro do Reel no Neon PostgreSQL
            const reelRes = await client.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [userId, driveFileId, title, description, parseInt(duration) || 0]
            );
            const newReelId = reelRes.rows[0].id;

            // 3. GAMIFICAÇÃO: Crédito de +50 Voices pelo conteúdo
            const rewardPoints = 50;
            await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [rewardPoints, userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                [userId, rewardPoints, 'REEL_POST', newReelId]
            );

            await client.query('COMMIT');

            // 4. Notificação Global via Socket (req.app.get)
            const io = req.app.get('io');
            if (io) {
                io.emit('feed_event', { 
                    type: 'NEW_CONTENT', 
                    author: req.user.fullName,
                    reelId: newReelId 
                });
            }

            res.status(201).json({
                success: true,
                message: 'Seu Reel está no ar! +50 Voices creditados.',
                data: { id: newReelId, drive_id: driveFileId }
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[REEL_PUBLISH_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Erro no processamento da postagem.' });
        } finally {
            client.release();
        }
    },

    /**
     * Interação Social: Like/Unlike
     */
    toggleLike: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;

        try {
            const check = await db.query('SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);
            
            if (check.rows.length > 0) {
                // Remover Interação
                await db.query('DELETE FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [reelId]);
                return res.status(200).json({ success: true, action: 'unliked' });
            } else {
                // Adicionar Interação e Bônus Simbólico
                await db.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [reelId]);
                await db.query('UPDATE users SET points_total = points_total + 1 WHERE id = $1', [userId]);
                
                return res.status(200).json({ success: true, action: 'liked' });
            }
        } catch (error) {
            console.error('[LIKE_ERROR]', error.message);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Gestão de Comentários Acadêmicos
     */
    addComment: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        const { content } = req.body;

        try {
            const result = await db.query(
                `INSERT INTO comments (reel_id, author_id, content, created_at)
                 VALUES ($1, $2, $3, NOW()) RETURNING *`,
                [reelId, userId, content]
            );

            await db.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);
            await db.query('UPDATE users SET points_total = points_total + 2 WHERE id = $1', [userId]);

            res.status(201).json({
                success: true,
                message: 'Comentário publicado (+2 Voices).',
                data: result.rows[0]
            });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Registro de Visualização (Algoritmo de Retenção)
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
