/**
 * ============================================================================
 * VLOGSTUDENTS MASTER REEL CONTROLLER v3.0.0
 * ENGINE DE CONTEÚDO E GESTÃO BINÁRIA DE VÍDEO
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const reelController = {

    /**
     * Publicação de Reel (Upload Binário)
     */
    publishReel: async (req, res) => {
        const userId = req.user.id;
        const { title, description, duration } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Stream binário de vídeo não detectado.' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            console.log(`[REEL_UPLOAD] Processando novo vídeo para UID: ${userId}`);

            // 1. Persistência no Google Cloud (Usando o serviço sanitizado)
            const driveFileId = await driveService.uploadFile(file, `REEL_U${userId}`);

            // 2. Registro no Banco Neon
            const reelRes = await client.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [userId, driveFileId, title || 'Sem título', description || '', parseInt(duration) || 0]
            );

            // 3. GAMIFICAÇÃO: +50 Voices
            await client.query('UPDATE users SET points_total = points_total + 50 WHERE id = $1', [userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, 50, \'REEL_POST\', $2)',
                [userId, reelRes.rows[0].id]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Seu conteúdo está no ar! +50 Voices creditados.',
                data: { id: reelRes.rows[0].id, file_id: driveFileId }
            });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[REEL_FATAL_ERROR]', error.message);
            res.status(500).json({ success: false, message: 'Falha no processamento do upload.' });
        } finally {
            client.release();
        }
    },

    /**
     * Feed Algorithm (Infinite Scroll)
     */
    getFeed: async (req, res) => {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        try {
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
                    r.likes_count as reel_likes_count_total,
                    r.comments_count as reel_comments_count_total,
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
            res.status(500).json({ success: false });
        }
    },

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
    }
};

module.exports = reelController;
