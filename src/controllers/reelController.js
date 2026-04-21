/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER REEL CONTROLLER v4.0.0
 * ENGINE DE CONTEÚDO, ALGORITMO DE DISTRIBUIÇÃO E GESTÃO BINÁRIA
 * 
 * DESIGNED FOR: HIGH-TRAFFIC VIDEO STREAMING
 * SYNC STATUS: 100% MOBILE ALIGNED
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

/**
 * REEL CONTROLLER MASTER
 */
const reelController = {

    /**
     * ALGORITMO DE FEED (Infinite Scroll)
     * Recupera Reels com metadados de autor, universidade e status de interação.
     */
    getFeed: async (req, res) => {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        try {
            console.log(`[FEED_ENGINE] Gerando fluxo para Aluno UID: ${userId} | Página: ${page}`);

            // Query otimizada com sub-selects para performance no Neon PostgreSQL
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
                    EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = r.id) as is_liked
                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            console.log(`[FEED_SUCCESS] ${result.rows.length} Reels entregues ao dispositivo.`);

            return res.status(200).json({
                success: true,
                count: result.rows.length,
                page: parseInt(page),
                data: result.rows
            });

        } catch (error) {
            console.error('[CRITICAL_FEED_ERROR]', error.stack);
            return res.status(500).json({ 
                success: false, 
                message: 'Falha ao processar ecossistema de vídeos.' 
            });
        }
    },

    /**
     * PUBLICAÇÃO MASTER (UPLOAD DE REEL)
     * Protocolo: Stream Binário -> Cloud Storage -> Neon DB -> Voices Bonus
     */
    publishReel: async (req, res) => {
        const userId = req.user.id;
        const { title, description, duration } = req.body;
        const file = req.file;

        if (!file) {
            console.error('[UPLOAD_FAIL] Binário de vídeo não detectado no stream.');
            return res.status(400).json({ success: false, message: 'Nenhum vídeo foi enviado.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[REEL_PROTOCOL] Iniciando persistência para UID: ${userId}`);

            // 1. Upload para o cluster Google Drive (Com sanitização RSA inclusa)
            const driveFileId = await driveService.uploadFile(file, `REEL_ACADEMIC_U${userId}`);

            // 2. Registro do Reel no banco de dados
            const insertQuery = `
                INSERT INTO reels (author_id, drive_file_id, title, description, duration, created_at, is_active)
                VALUES ($1, $2, $3, $4, $5, NOW(), true)
                RETURNING id
            `;
            const reelRes = await client.query(insertQuery, [
                userId, 
                driveFileId, 
                title ? title.trim() : 'Sem título', 
                description ? description.trim() : '', 
                parseInt(duration) || 0
            ]);

            const newReelId = reelRes.rows[0].id;

            // 3. SISTEMA DE RECOMPENSA (Gamificação +50 Voices)
            const rewardPoints = 50;
            await client.query('UPDATE users SET points_total = points_total + $1 WHERE id = $2', [rewardPoints, userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, \'REEL_POST\', $3)',
                [userId, rewardPoints, newReelId]
            );

            await client.query('COMMIT');

            // 4. Notificação Realtime para o Feed Global
            const io = req.app.get('io');
            if (io) {
                io.emit('new_content_alert', { author: req.user.fullName, reelId: newReelId });
            }

            console.log(`[UPLOAD_SUCCESS] Reel ${newReelId} publicado. +50 Voices creditados.`);

            return res.status(201).json({
                success: true,
                message: 'Seu conteúdo está no ar! +50 Voices ganhos.',
                data: { id: newReelId, drive_id: driveFileId }
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[REEL_PUBLISH_FATAL]', error.stack);
            return res.status(500).json({ success: false, message: 'Erro no processamento da postagem.' });
        } finally {
            client.release();
        }
    },

    /**
     * INTERAÇÃO SOCIAL: LIKE / UNLIKE
     */
    toggleLike: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;

        try {
            const checkQuery = 'SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2';
            const check = await db.query(checkQuery, [userId, reelId]);
            
            if (check.rows.length > 0) {
                // Remover Interação
                await db.query('DELETE FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [reelId]);
                return res.status(200).json({ success: true, action: 'unliked' });
            } else {
                // Adicionar Interação
                await db.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [reelId]);
                
                // Pequena recompensa por engajamento (+1 Voice)
                await db.query('UPDATE users SET points_total = points_total + 1 WHERE id = $1', [userId]);

                return res.status(200).json({ success: true, action: 'liked' });
            }
        } catch (error) {
            console.error('[LIKE_ERROR]', error.message);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * BUSCA DE COMENTÁRIOS ACADÊMICOS
     */
    getComments: async (req, res) => {
        const reelId = req.params.id;
        try {
            const query = `
                SELECT 
                    c.id as comment_identification,
                    c.content as comment_text_content,
                    c.created_at as comment_created_at_timestamp,
                    u.id as user_id,
                    u.full_name as author_name,
                    u.avatar_url as author_picture
                FROM comments c
                JOIN users u ON c.author_id = u.id
                WHERE c.reel_id = $1
                ORDER BY c.created_at DESC
            `;
            const result = await db.query(query, [reelId]);
            return res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * ADIÇÃO DE COMENTÁRIO
     */
    addComment: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Comentário vazio.' });
        }

        try {
            const query = `
                INSERT INTO comments (reel_id, author_id, content, created_at)
                VALUES ($1, $2, $3, NOW()) RETURNING *
            `;
            const result = await db.query(query, [reelId, userId, text.trim()]);
            
            await db.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);
            
            return res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[COMMENT_ERROR]', error.stack);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * REGISTRO DE VISUALIZAÇÃO (Retention Engine)
     */
    trackView: async (req, res) => {
        const reelId = req.params.id;
        try {
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [reelId]);
            return res.status(200).json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * REPOSTAGEM DE CONTEÚDO (Bônus de influência)
     */
    repost: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        try {
            await db.query('UPDATE reels SET reposts_count = reposts_count + 1 WHERE id = $1', [reelId]);
            await db.query('UPDATE users SET points_total = points_total + 10 WHERE id = $1', [userId]);
            return res.status(200).json({ success: true, message: 'Conteúdo compartilhado! +10 Voices.' });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * EXCLUSÃO DE REEL (Segurança de autor)
     */
    deleteReel: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;

        try {
            // Busca o FileID para remover do Google Drive também
            const findRes = await db.query('SELECT drive_file_id FROM reels WHERE id = $1 AND author_id = $2', [reelId, userId]);
            
            if (findRes.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Permissão negada ou conteúdo inexistente.' });
            }

            const driveId = findRes.rows[0].drive_file_id;

            // 1. Remove do Neon DB
            await db.query('DELETE FROM reels WHERE id = $1', [reelId]);

            // 2. Remove do Google Cloud Cluster (Async)
            driveService.deleteFile(driveId).catch(err => console.error('[CLEANUP_FAIL]', err.message));

            console.log(`[CONTENT_PURGE] Reel ${reelId} removido pelo autor.`);

            return res.status(200).json({ success: true, message: 'Conteúdo removido permanentemente.' });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    }
};

module.exports = reelController;
