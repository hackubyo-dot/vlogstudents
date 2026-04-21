/**
 * ============================================================================
 * VLOGSTUDENTS MASTER USER CONTROLLER v2.0.0
 * GESTÃO DE IDENTIDADE, VOICES (POINTS) E SOCIAL METRICS
 * ============================================================================
 */

const db = require('../config/dbConfig'); // Assumindo Pool do Postgres
const driveService = require('../services/driveService');
const { io } = require('../../server');

const userController = {

    /**
     * Retorna o perfil completo do usuário logado
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id; // Extraído do JWT no middleware

        try {
            console.log(`[USER_QUERY] Buscando metadados para UID: ${userId}`);

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
                    u.isActive as user_account_status,
                    u.created_at as user_created_at_timestamp
                FROM users u
                WHERE u.id = $1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Estudante não localizado.' });
            }

            res.status(200).json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_CONTROLLER_ERROR] getMyProfile:', error.stack);
            res.status(500).json({ success: false, message: 'Erro ao processar consulta de perfil.' });
        }
    },

    /**
     * Upload de Avatar sincronizado com Cloud e DB
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Nenhum binário detectado no stream.' });
        }

        try {
            console.log(`[USER_UPLOAD] Iniciando troca de avatar para UID: ${userId}`);

            // 1. Upload para o Google Drive
            const driveFileId = await driveService.uploadFile(file, `AVATAR_USER_${userId}`);

            // 2. Atualiza o banco de dados
            const updateQuery = `
                UPDATE users
                SET avatar_url = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING avatar_url
            `;
            const result = await db.query(updateQuery, [driveFileId, userId]);

            // 3. Notifica em Realtime (Se necessário)
            io.to(`user_${userId}`).emit('avatar_updated', { imageUrl: driveFileId });

            res.status(200).json({
                success: true,
                message: 'Identidade visual atualizada.',
                data: {
                    imageUrl: driveFileId
                }
            });

        } catch (error) {
            console.error('[USER_UPLOAD_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Falha crítica no upload do avatar.' });
        }
    },

    /**
     * Atualização de dados cadastrais (Update Profile)
     */
    updateProfile: async (req, res) => {
        const userId = req.user.id;
        const { fullName, university, phone, bio } = req.body;

        try {
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

            const values = [fullName, university, phone, bio, userId];
            const result = await db.query(updateQuery, values);

            res.status(200).json({
                success: true,
                message: 'Perfil sincronizado.',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_UPDATE_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Erro ao atualizar dados acadêmicos.' });
        }
    },

    /**
     * Recuperação de saldo de Voices (Points)
     */
    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = 'SELECT points_total FROM users WHERE id = $1';
            const result = await db.query(query, [userId]);

            res.status(200).json({
                success: true,
                balance: result.rows[0].points_total
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao consultar carteira.' });
        }
    },

    /**
     * Histórico detalhado de transações (PointsProvider do Flutter)
     */
    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT
                    id as point_transaction_identification,
                    amount as point_amount_value,
                    reason as point_reason_description,
                    reference_id as point_reference_id,
                    created_at as point_created_at_timestamp
                FROM point_transactions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `;
            const result = await db.query(query, [userId]);

            res.status(200).json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao gerar extrato.' });
        }
    },

    /**
     * Social Metrics (Followers, Following, Posts count)
     */
    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1) as posts
            `;
            const result = await db.query(query, [userId]);

            res.status(200).json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao calcular métricas sociais.' });
        }
    },

    /**
     * Sistema de Resgate de Pontos
     */
    redeemPoints: async (req, res) => {
        const userId = req.user.id;
        const { rewardId, cost } = req.body;

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // 1. Verifica saldo
            const userRes = await client.query('SELECT points_total FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userRes.rows[0].points_total < cost) {
                throw new Error('Saldo insuficiente para resgate.');
            }

            // 2. Deduz pontos
            await client.query('UPDATE users SET points_total = points_total - $1 WHERE id = $2', [cost, userId]);

            // 3. Registra transação
            await client.query(
                'INSERT INTO point_transactions (user_id, amount, reason, reference_id) VALUES ($1, $2, $3, $4)',
                [userId, -cost, 'REWARD_REDEEM', rewardId]
            );

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Resgate processado com sucesso!' });

        } catch (error) {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, message: error.message });
        } finally {
            client.release();
        }
    },

    /**
     * Atualização de Preferências de Tema (Visual Sync)
     */
    updateSettings: async (req, res) => {
        const userId = req.user.id;
        const { theme } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme, userId]);
            res.status(200).json({ success: true, message: 'Preferências visuais salvas.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = userController;