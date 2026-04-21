/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v8.0.0
 * FULL IDENTITY, GAMIFICATION (VOICES) & STREAMING PROXY
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {

    /**
     * getMyProfile - Recuperação de Identidade Sincronizada
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        try {
            console.log(`[USER_CORE] Querying master profile for UID: ${userId}`);
            const query = `
                SELECT 
                    id as user_identification,
                    email as user_email_address,
                    full_name as user_full_name,
                    avatar_url as user_profile_picture_url,
                    university_name as user_university_name,
                    referral_code as user_referral_code,
                    points_total as user_points_balance,
                    theme_pref as user_theme_config,
                    phone_number as user_phone_number,
                    biography as user_biography_text,
                    isactive as user_account_status,
                    created_at as user_created_at_timestamp
                FROM users WHERE id = $1
            `;
            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Estudante não localizado.' });
            }

            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[USER_CORE_ERROR]', error.message);
            res.status(500).json({ success: false, message: 'Instabilidade no cluster de perfil.' });
        }
    },

    /**
     * updateProfile - Sincronização de Metadados Cadastrais
     */
    updateProfile: async (req, res) => {
        const userId = req.user.id;
        const { fullName, university, phone, bio } = req.body;
        try {
            const updateQuery = `
                UPDATE users 
                SET full_name = COALESCE($1, full_name),
                    university_name = COALESCE($2, university_name),
                    phone_number = COALESCE($3, phone_number),
                    biography = COALESCE($4, biography),
                    updated_at = NOW()
                WHERE id = $5 RETURNING *
            `;
            const result = await db.query(updateQuery, [fullName, university, phone, bio, userId]);
            res.status(200).json({ success: true, message: 'Perfil atualizado.', data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao persistir alterações.' });
        }
    },

    /**
     * streamMedia - PROXY DE VÍDEO (FIX: BUFFER & RANGE)
     * Essencial para o VideoPlayer do Flutter carregar instantaneamente.
     */
    streamMedia: async (req, res) => {
        const { fileId } = req.params;
        const range = req.headers.range;

        try {
            const metadata = await driveService.getFileMetadata(fileId);
            if (!metadata) return res.status(404).json({ message: 'Arquivo não encontrado.' });

            const fileSize = parseInt(metadata.size);
            const mimeType = metadata.mimeType || 'video/mp4';

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const driveStream = await driveService.getVideoStream(fileId);

                // Status 206: Partial Content (Essencial para streaming)
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-cache'
                });
                driveStream.data.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                });
                const driveStream = await driveService.getVideoStream(fileId);
                driveStream.data.pipe(res);
            }
        } catch (error) {
            console.error('[STREAM_ERROR]', error.message);
            if (!res.headersSent) res.status(500).send('Streaming fail');
        }
    },

    /**
     * uploadAvatar - Persistência de Identidade Visual no Google Drive
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ success: false, message: 'Imagem ausente.' });

        try {
            const driveFileId = await driveService.uploadFile(req.file, `AVATAR_UID_${userId}`);
            await db.query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [driveFileId, userId]);
            
            res.status(200).json({ success: true, data: { imageUrl: driveFileId } });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro no upload do avatar.' });
        }
    },

    /**
     * getPointsBalance - Saldo de Voices
     */
    getPointsBalance: async (req, res) => {
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [req.user.id]);
            res.status(200).json({ success: true, balance: result.rows[0].points_total || 0 });
        } catch (e) { res.status(500).json({ success: false }); }
    },

    /**
     * getPointsHistory - Extrato de Transações
     */
    getPointsHistory: async (req, res) => {
        try {
            const query = `
                SELECT id as point_transaction_identification, 
                       amount as point_amount_value, 
                       reason as point_reason_description, 
                       created_at as point_created_at_timestamp 
                FROM point_transactions WHERE user_id = $1 
                ORDER BY created_at DESC LIMIT 50
            `;
            const result = await db.query(query, [req.user.id]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (e) { res.status(500).json({ success: false }); }
    },

    /**
     * getSocialMetrics - Seguidores, Seguindo e Posts
     */
    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1 AND is_active = true) as posts
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({
                success: true,
                data: {
                    followers: parseInt(result.rows[0].followers),
                    following: parseInt(result.rows[0].following),
                    posts: parseInt(result.rows[0].posts)
                }
            });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * redeemPoints - Sistema de Recompensa com Transação Atômica
     */
    redeemPoints: async (req, res) => {
        const userId = req.user.id;
        const { rewardId, cost } = req.body;
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const userRes = await client.query('SELECT points_total FROM users WHERE id = $1 FOR UPDATE', [userId]);
            
            if (userRes.rows[0].points_total < cost) {
                return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
            }

            await client.query('UPDATE users SET points_total = points_total - $1 WHERE id = $2', [cost, userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                [userId, -cost, 'REWARD_REDEEM', rewardId]
            );

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Voices resgatados!' });
        } catch (error) {
            await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally { client.release(); }
    },

    /**
     * getUserProfile - Visualização Pública de Perfil
     */
    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        const myId = req.user.id;
        try {
            const query = `
                SELECT 
                    u.id as user_identification, u.full_name as user_full_name,
                    u.avatar_url as user_profile_picture_url, u.university_name as user_university_name,
                    u.biography as user_biography_text,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
                FROM users u WHERE u.id = $2
            `;
            const result = await db.query(query, [myId, targetId]);
            if (result.rows.length === 0) return res.status(404).json({ success: false });
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * updateSettings - Preferências de tema e conta
     */
    updateSettings: async (req, res) => {
        const { theme } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme, req.user.id]);
            res.status(200).json({ success: true });
        } catch (e) { res.status(500).json({ success: false }); }
    }
};

module.exports = userController;
