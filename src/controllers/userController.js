/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v5.5.0
 * ORQUESTRADOR DE IDENTIDADE, ECONOMIA DE VOICES E STREAMING BINÁRIO
 * 
 * STATUS: ALFA OMEGA ACTIVE
 * CORREÇÃO: PROTOCOLO DE STREAMING PARA VÍDEOS REELS (GIRO INFINITO FIX)
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

/**
 * USER CONTROLLER MASTER OBJECT
 */
const userController = {

    /**
     * getMyProfile - Recuperação de Identidade
     * Sincronizado com VlogUser.fromJson do Flutter
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        
        try {
            console.log(`[USER_CORE] Querying master profile for UID: ${userId}`);
            
            const query = `
                SELECT 
                    u.id as user_identification,
                    u.email as user_email_address,
                    u.full_name as user_full_name,
                    u.avatar_url as user_profile_picture_url,
                    u.university_name as user_university_name,
                    u.referral_code as user_referral_code,
                    u.points_total as user_points_balance,
                    u.theme_pref as user_theme_config,
                    u.phone_number as user_phone_number,
                    u.biography as user_biography_text,
                    u.isactive as user_account_status,
                    u.created_at as user_created_at_timestamp
                FROM users u
                WHERE u.id = $1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                console.error(`[USER_CORE_FAIL] Profile not found for UID: ${userId}`);
                return res.status(404).json({ 
                    success: false, 
                    message: 'Estudante não localizado no cluster.' 
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Identidade sincronizada.',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_CONTROLLER_ERROR] getMyProfile:', error.stack);
            return res.status(500).json({ 
                success: false, 
                message: 'Instabilidade fatal no processamento de perfil.' 
            });
        }
    },

    /**
     * updateProfile - Sincronização de Dados Cadastrais
     */
    updateProfile: async (req, res) => {
        const userId = req.user.id;
        const { fullName, university, phone, bio } = req.body;

        try {
            console.log(`[USER_SYNC] Updating metadata for UID: ${userId}`);

            const updateQuery = `
                UPDATE users 
                SET 
                    full_name = COALESCE($1, full_name),
                    university_name = COALESCE($2, university_name),
                    phone_number = COALESCE($3, phone_number),
                    biography = COALESCE($4, biography),
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const result = await db.query(updateQuery, [
                fullName ? fullName.trim() : null,
                university ? university.trim() : null,
                phone ? phone.trim() : null,
                bio ? bio.trim() : null,
                userId
            ]);

            console.log(`[USER_SYNC_SUCCESS] Metadata persists for UID: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Perfil acadêmico atualizado.',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_UPDATE_ERROR]', error.stack);
            return res.status(500).json({ success: false, message: 'Erro ao persistir alterações.' });
        }
    },

    /**
     * streamMedia - O CORAÇÃO DO STREAMING (FIX VÍDEO GIRANDO)
     * Atua como Proxy entre o Google Drive e o Flutter video_player
     */
    streamMedia: async (req, res) => {
        const { fileId } = req.params;
        const range = req.headers.range;

        try {
            console.log(`[MEDIA_STREAM] Requesting binary chunk for FileID: ${fileId} | Range: ${range}`);

            // 1. Busca metadados para saber o tamanho do arquivo
            const metadata = await driveService.getFileMetadata(fileId);
            if (!metadata) return res.status(404).send('Media not found');

            const fileSize = parseInt(metadata.size);
            const mimeType = metadata.mimeType || 'video/mp4';

            // 2. Se o cliente (Flutter) pedir uma parte específica (Range)
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const driveStream = await driveService.getVideoStream(fileId);

                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-cache'
                };

                res.writeHead(206, head);
                // O driveService deve retornar o stream vindo da API do Google
                driveStream.data.pipe(res);
            } else {
                // 3. Carregamento total se não houver range
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                };
                res.writeHead(200, head);
                const driveStream = await driveService.getVideoStream(fileId);
                driveStream.data.pipe(res);
            }

        } catch (error) {
            console.error('[STREAM_CRITICAL_ERROR]', error.message);
            if (!res.headersSent) {
                res.status(500).send('Streaming error');
            }
        }
    },

    /**
     * uploadAvatar - Troca de Identidade Visual
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Binário de imagem ausente.' });
        }

        try {
            console.log(`[IDENTITY_UPLOAD] Processing avatar for UID: ${userId}`);

            // 1. Upload Cloud
            const driveFileId = await driveService.uploadFile(file, `AVATAR_ACADEMIC_UID_${userId}`);

            // 2. Neon Update
            await db.query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [driveFileId, userId]);

            // 3. Realtime notify
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${userId}`).emit('avatar_update', { url: driveFileId });
            }

            return res.status(200).json({
                success: true,
                message: 'Foto de perfil atualizada.',
                data: { imageUrl: driveFileId }
            });

        } catch (error) {
            console.error('[AVATAR_ERROR]', error.stack);
            return res.status(500).json({ success: false, message: 'Falha no processamento da imagem.' });
        }
    },

    /**
     * getPointsBalance - Consulta de Saldo de Voices
     */
    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
            return res.status(200).json({
                success: true,
                balance: result.rows[0].points_total || 0
            });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * getPointsHistory - Histórico de Gamificação
     */
    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    id as point_transaction_identification,
                    amount as point_amount_value,
                    reason as point_reason_description,
                    created_at as point_created_at_timestamp
                FROM point_transactions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `;
            const result = await db.query(query, [userId]);
            return res.status(200).json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * getSocialMetrics - Seguidores e Engajamento
     */
    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            console.log(`[SOCIAL_METRICS] Calculating data for UID: ${userId}`);
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1 AND is_active = true) as posts
            `;
            const result = await db.query(query, [userId]);
            
            return res.status(200).json({
                success: true,
                data: {
                    followers: parseInt(result.rows[0].followers),
                    following: parseInt(result.rows[0].following),
                    posts: parseInt(result.rows[0].posts)
                }
            });
        } catch (error) {
            console.error('[METRICS_ERROR]', error.message);
            return res.status(500).json({ success: false });
        }
    },

    /**
     * getReferralStats - Crescimento e Convites
     */
    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    COUNT(id) as total_invites,
                    COALESCE(SUM(amount), 0) as total_earned
                FROM point_transactions
                WHERE user_id = $1 AND reason = 'USER_REFERRAL'
            `;
            const result = await db.query(query, [userId]);
            return res.status(200).json({
                success: true,
                data: {
                    total_invites: parseInt(result.rows[0].total_invites),
                    total_earned: parseInt(result.rows[0].total_earned)
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * redeemPoints - Sistema de Recompensas
     */
    redeemPoints: async (req, res) => {
        const userId = req.user.id;
        const { rewardId, cost } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            const userRes = await client.query('SELECT points_total FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows[0].points_total < cost) {
                return res.status(400).json({ success: false, message: 'Saldo de Voices insuficiente.' });
            }

            await client.query('UPDATE users SET points_total = points_total - $1 WHERE id = $2', [cost, userId]);
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                [userId, -cost, 'REWARD_REDEEM', rewardId]
            );

            await client.query('COMMIT');
            return res.status(200).json({ success: true, message: 'Voices resgatados com sucesso!' });

        } catch (error) {
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * updateSettings - Preferências Visuais
     */
    updateSettings: async (req, res) => {
        const userId = req.user.id;
        const { theme_config } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme_config, userId]);
            return res.status(200).json({ success: true, message: 'Configurações de tema salvas.' });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    /**
     * getUserProfile - Visualização Social de Terceiros
     */
    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        const myId = req.user.id;

        try {
            const query = `
                SELECT 
                    u.id as user_identification,
                    u.full_name as user_full_name,
                    u.avatar_url as user_profile_picture_url,
                    u.university_name as user_university_name,
                    u.biography as user_biography_text,
                    u.points_total as user_points_balance,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
                FROM users u
                WHERE u.id = $2
            `;
            const result = await db.query(query, [myId, targetId]);
            if (result.rows.length === 0) return res.status(404).json({ success: false });
            
            return res.status(200).json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    }
};

module.exports = userController;
