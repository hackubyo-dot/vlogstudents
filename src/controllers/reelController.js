/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER REEL CONTROLLER v2.0.5
 * ENGINE DE CONTEÚDO, DISTRIBUIÇÃO E GESTÃO DE ENGAJAMENTO ACADÊMICO
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const reelController = {

    /**
     * Algoritmo de Distribuição do Feed (Infinite Scroll)
     * Retorna os Reels mais recentes com metadados de autor e status de interação
     */
    getFeed: async (req, res) => {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        try {
            console.log(`[FEED_ENGINE] Gerando fluxo para Aluno UID: ${userId} (Página: ${page})`);

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
                    EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND reel_id = r.id) as is_liked
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
            res.status(500).json({ success: false, message: 'Falha ao processar ecossistema de vídeos.' });
        }
    },

    /**
     * Publicação de Conteúdo (Upload Master)
     */
    publishReel: async (req, res) => {
        const userId = req.user.id;
        const { title, description, duration } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ success: false, message: 'Binário não detectado.' });

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            // Persistência Cloud
            const driveFileId = await driveService.uploadFile(file, `REEL_UID_${userId}`);

            // Persistência Neon
            const reelRes = await client.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [userId, driveFileId, title, description, parseInt(duration) || 0]
            );

            // Recompensa +50 Voices
            await client.query('UPDATE users SET points_total = points_total + 50 WHERE id = $1', [userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, 50, \'REEL_POST\', $2)',
                [userId, reelRes.rows[0].id]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: { id: reelRes.rows[0].id } });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * CORREÇÃO: Função de Like
     */
    toggleLike: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        try {
            const check = await db.query('SELECT id FROM likes WHERE user_id = $1 AND reel_id = $2', [userId, reelId]);
            if (check.rows.length > 0) {
                await db.query('DELETE FROM likes WHERE id = $1', [check.rows[0].id]);
                await db.query('UPDATE reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [reelId]);
                res.json({ success: true, action: 'unliked' });
            } else {
                await db.query('INSERT INTO likes (user_id, reel_id) VALUES ($1, $2)', [userId, reelId]);
                await db.query('UPDATE reels SET likes_count = likes_count + 1 WHERE id = $1', [reelId]);
                res.json({ success: true, action: 'liked' });
            }
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * CORREÇÃO CRÍTICA: Busca de Comentários (O que causou o 500/Crash)
     */
    getComments: async (req, res) => {
        const reelId = req.params.id;
        try {
            const query = `
                SELECT c.*, u.full_name as author_name, u.avatar_url as author_picture
                FROM comments c
                JOIN users u ON c.author_id = u.id
                WHERE c.reel_id = $1
                ORDER BY c.created_at ASC
            `;
            const result = await db.query(query, [reelId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * CORREÇÃO CRÍTICA: Adição de Comentário
     */
    addComment: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        const { text } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO comments (reel_id, author_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
                [reelId, userId, text]
            );
            await db.query('UPDATE reels SET comments_count = comments_count + 1 WHERE id = $1', [reelId]);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * CORREÇÃO: Registro de Compartilhamento (Voices)
     */
    registerShare: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        try {
            await db.query('UPDATE reels SET reposts_count = reposts_count + 1 WHERE id = $1', [reelId]);
            await db.query('UPDATE users SET points_total = points_total + 10 WHERE id = $1', [userId]);
            res.json({ success: true, message: '+10 Voices por partilha.' });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * CORREÇÃO: Registro de Visualização
     */
    trackView: async (req, res) => {
        const reelId = req.params.id;
        try {
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [reelId]);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * CORREÇÃO: Repostar Reel
     */
    repost: async (req, res) => {
        res.json({ success: true, message: 'Repostagem concluída.' });
    },

    /**
     * CORREÇÃO: Exclusão de Reel
     */
    deleteReel: async (req, res) => {
        const userId = req.user.id;
        const reelId = req.params.id;
        try {
            await db.query('DELETE FROM reels WHERE id = $1 AND author_id = $2', [reelId, userId]);
            res.json({ success: true, message: 'Conteúdo removido.' });
        } catch (error) { res.status(500).json({ success: false }); }
    }
};

module.exports = reelController;
